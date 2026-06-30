'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMBAStore } from '@/store/mba-store';

const P = {
  bg:'#05050B', surface:'#0E0E1C', surface2:'#141428',
  red:'#C0001C', redB:'#FF1A3C',
  redGlow:'rgba(192,0,28,0.18)', redDim:'rgba(192,0,28,0.08)',
  border:'rgba(192,0,28,0.14)', borderHi:'rgba(192,0,28,0.35)',
  text:'#F2F2FA', textSec:'#9090AA', textDim:'#505068',
  green:'#00C063', orange:'#E06000', blue:'#3B82F6',
};
const INP = { width:'100%', padding:'9px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:13, outline:'none', fontFamily:"'JetBrains Mono',monospace" } as React.CSSProperties;
const LIMIT_DIARIO = 30;
const DELAY_MIN = 45000, DELAY_MAX = 90000;
const BUSINESS_KW = ['restaurante','restaurant','bar','hotel','café','cafe','hostel','shop','store','loja','boutique','spa','gym','academia','fitness','clínica','clinic','salon','salão','barbearia','snack','pizzaria','padaria','oficial','official','brand','marca','company','empresa','group','grupo','agency','agência','studio','estúdio','media','records','fashion','clothing','moda'];
const PROPOSTA = 'Olá,\nO meu nome é Jesuaine Cristiano e represento a Mwango Brain, uma agência criativa sediada em Luanda, Angola.\nTenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisição da sua conta.\n\nEstamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.\n\nAguardamos o seu contacto.\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';
const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECÇÃO'},{id:'messages',label:'MENSAGENS'},
  {id:'followups',label:'FOLLOW-UPS'},{id:'inbox',label:'CAIXA DE ENTRADA'},{id:'agent',label:'AGENTE IA'},
  {id:'campaigns',label:'CAMPANHAS'},{id:'analytics',label:'ANALYTICS'},{id:'activity',label:'ACTIVIDADE'},{id:'config',label:'CONFIGURAÇÃO'},
];
const storeGet = (k:string, d:string='') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k:string, v:string) => { try { localStorage.setItem(k, v); } catch {} };
const getSeenProfiles = () => { try { return new Set(JSON.parse(localStorage.getItem('mba_seen')||'[]')); } catch { return new Set(); } };
const saveSeenProfiles = (profiles:any[]) => { try { const s = getSeenProfiles(); profiles.forEach(i => s.add(i.id)); localStorage.setItem('mba_seen', JSON.stringify([...s])); } catch {} };
const getMsgCount = () => { try { const d = JSON.parse(storeGet('mba_msgs', '{}')); return d.date === new Date().toDateString() ? d.count || 0 : 0; } catch { return 0; } };
const incMsgCount = () => { try { const t = new Date().toDateString(); localStorage.setItem('mba_msgs', JSON.stringify({ date: t, count: getMsgCount() + 1 })); } catch {} };
const exportCSV = (profiles:any[])=>{if(!profiles.length)return;const h=['Handle','Nome','Seguidores','Score','Plataforma','URL'];const rows=profiles.map(p=>[p.username||p.handle,p.displayName,p.followers,p.score,p.platform,p.profileUrl]);const csv=[h,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,"'")}"`).join(',')).join('\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`MBA_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);};

function Sphere({ size=240, speed=1 }: { size?: number; speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null), raf = useRef<number>(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const DPR = window.devicePixelRatio || 2;
    cv.width = size * DPR; cv.height = size * DPR;
    ctx.scale(DPR, DPR);
    const cx = size/2, cy = size/2, R = size * 0.36;
    const pts = Array.from({ length: 240 }, () => {
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      return { ox: Math.sin(p)*Math.cos(t), oy: Math.sin(p)*Math.sin(t), oz: Math.cos(p), sz: Math.random()*1.8+0.3, hot: Math.random()<0.05 };
    });
    const TX = 0.28, cosX = Math.cos(TX), sinX = Math.sin(TX);
    let rot = 0;
    function draw() {
      ctx.clearRect(0, 0, size, size); rot += 0.004 * speed;
      const pulse = 1 + Math.sin(Date.now()/950) * 0.025;
      const cosY = Math.cos(rot), sinY = Math.sin(rot);
      const proj = pts.map(pt => {
        const x1 = pt.ox*cosY + pt.oz*sinY, y1 = pt.oy, z1 = -pt.ox*sinY + pt.oz*cosY;
        const y2 = y1*cosX - z1*sinX, z2 = y1*sinX + z1*cosX;
        const d = (z2+1.4)/2.4;
        return { sx: cx+x1*R*pulse, sy: cy+y2*R*pulse, z: z2, a: Math.max(0.04, d*0.9), sz: pt.sz*(0.4+d*0.75), hot: pt.hot };
      });
      proj.sort((a,b) => a.z - b.z);
      const amb = ctx.createRadialGradient(cx, cy, R*0.1, cx, cy, R*1.8);
      amb.addColorStop(0, 'rgba(192,0,28,0.14)'); amb.addColorStop(0.5, 'rgba(192,0,28,0.05)'); amb.addColorStop(1, 'transparent');
      ctx.fillStyle = amb; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < proj.length; i++) for (let j = i+1; j < proj.length; j++) {
        const dx = proj[i].sx-proj[j].sx, dy = proj[i].sy-proj[j].sy, dist = Math.sqrt(dx*dx+dy*dy), th = size*0.12;
        if (dist < th) { ctx.strokeStyle = 'rgba(192,0,28,'+((1-dist/th)*0.5*Math.min(proj[i].a,proj[j].a))+')'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(proj[i].sx, proj[i].sy); ctx.lineTo(proj[j].sx, proj[j].sy); ctx.stroke(); }
      }
      [[0.22,0.18,-0.2],[0.56,0.24,0.32],[0.9,0.15,-0.15]].forEach(([phi,a,rv]) => {
        const rr = R*Math.sin(phi*Math.PI*0.5+0.3)*pulse, ry = cy + Math.cos(phi*Math.PI*0.5+0.3)*R*0.25;
        ctx.beginPath(); ctx.ellipse(cx, ry, rr, rr*0.2, rot*rv, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(192,0,28,'+a+')'; ctx.lineWidth = 0.9; ctx.stroke();
      });
      proj.forEach(p => {
        const gr = p.sz*(p.hot?7:4.5), g = ctx.createRadialGradient(p.sx,p.sy,0,p.sx,p.sy,gr);
        g.addColorStop(0, 'rgba(220,0,35,'+(p.a*(p.hot?0.55:0.28))+')'); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.sx, p.sy, gr, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sz*(p.hot?2:1), 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,'+(p.hot?80:30)+','+(p.hot?60:50)+','+p.a+')'; ctx.fill();
      });
      const b = ctx.createRadialGradient(cx, cy, 0, cx, cy, R*0.2);
      b.addColorStop(0, 'rgba(220,0,40,'+(0.3+Math.sin(Date.now()/700)*0.1)+')'); b.addColorStop(1, 'transparent');
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R*0.2, 0, Math.PI*2); ctx.fill();
      raf.current = requestAnimationFrame(draw);
    }
    draw(); return () => cancelAnimationFrame(raf.current);
  }, [size, speed]);
  return <canvas ref={ref} style={{ width: size, height: size }} />;
}

function Panel({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:P.surface, border:'1px solid '+P.border, borderRadius:10, padding:16, ...style }}>{children}</div>;
}
function STitle({ children }: { children: React.ReactNode }) {
  return <div style={{ color:P.text, fontSize:13, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}><div style={{ width:3, height:14, background:P.red, borderRadius:2, flexShrink:0 }} />{children}</div>;
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ color:P.textSec, fontSize:10, fontWeight:600, letterSpacing:'.6px', textTransform:'uppercase', marginBottom:8 }}>{children}</div>;
}
function StatCard({ label, value, sub, color=P.red }: { label:string; value:string|number; sub?:string; color?:string }) {
  return <Panel style={{ flex:1, minWidth:140 }}><Lbl>{label}</Lbl><div style={{ color, fontSize:28, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{value}</div>{sub && <div style={{ color:P.textSec, fontSize:11, marginTop:6 }}>{sub}</div>}</Panel>;
}
function Btn({ children, onClick, disabled, variant='primary', size='md' }: { children:React.ReactNode; onClick?:()=>void; disabled?:boolean; variant?:string; size?:string }) {
  const pad = size==='sm'?'5px 12px':size==='lg'?'13px 28px':'9px 18px';
  const fs = size==='sm'?11:size==='lg'?13:12;
  const st:Record<string,React.CSSProperties> = {
    primary: { background:disabled?'rgba(192,0,28,0.06)':'rgba(192,0,28,0.15)', border:'1px solid '+(disabled?'rgba(192,0,28,0.2)':P.red), color:disabled?'rgba(192,0,28,0.35)':P.redB, boxShadow:disabled?'none':'0 0 14px rgba(192,0,28,0.18)' },
    ghost: { background:'transparent', border:'1px solid '+P.border, color:P.textSec },
    danger: { background:'rgba(255,60,60,0.08)', border:'1px solid rgba(255,60,60,0.3)', color:'#ff6b6b' },
  };
  return <button onClick={disabled?undefined:onClick} style={{ ...st[variant]||st.primary, padding:pad, fontSize:fs, fontWeight:600, cursor:disabled?'not-allowed':'pointer', borderRadius:6, fontFamily:"'Inter',sans-serif", transition:'all .15s', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>{children}</button>;
}
function Toggle({ on, onChange }: { on:boolean; onChange:(v:boolean)=>void }) {
  return <div onClick={()=>onChange(!on)} style={{ width:40, height:22, borderRadius:11, cursor:'pointer', background:on?'rgba(192,0,28,0.25)':'rgba(255,255,255,0.06)', border:'1px solid '+(on?P.red:'rgba(255,255,255,0.1)'), position:'relative', transition:'all .2s', flexShrink:0 }}><div style={{ width:16, height:16, borderRadius:'50%', background:on?P.red:P.textSec, position:'absolute', top:2, left:on?20:2, transition:'all .2s', boxShadow:on?'0 0 8px '+P.red:'none' }} /></div>;
}
function Bar({ value, max, color=P.red, h=8 }: { value:number; max:number; color?:string; h?:number }) {
  const pct = max > 0 ? Math.min(100, (value/max)*100) : 0;
  return <div style={{ height:h, background:P.surface2, borderRadius:h/2, overflow:'hidden' }}><div style={{ height:'100%', width:pct+'%', background:'linear-gradient(90deg,'+color+','+P.redB+')', borderRadius:h/2, transition:'width .5s' }} /></div>;
}
function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { c:string; l:string }> = { prospect:{c:P.textSec,l:'Prospecto'}, contacted:{c:P.orange,l:'Contactado'}, replied:{c:P.blue,l:'Respondeu'}, accepted:{c:P.green,l:'Aceite'}, rejected:{c:'#ff6b6b',l:'Rejeitado'}, blacklisted:{c:'#666',l:'Blacklist'} };
  const s = m[status] || { c: P.textDim, l: status };
  return <span style={{ padding:'2px 8px', borderRadius:3, background:s.c+'18', border:'1px solid '+s.c+'44', color:s.c, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{s.l}</span>;
}