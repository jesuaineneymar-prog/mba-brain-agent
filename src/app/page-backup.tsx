'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMBAStore } from '@/store/mba-store';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';

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
const BUSINESS_KW = ['restaurante','restaurant','bar','hotel','cafe','hostel','shop','store','loja','boutique','spa','gym','academia','fitness','clinica','clinic','salon','barbearia','snack','pizzaria','padaria','oficial','official','brand','marca','company','empresa','group','grupo','agency','studio','media','records','fashion','clothing','moda'];
const PROPOSTA = 'Ola,\nO meu nome e Jesuaine Cristiano e represento a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.\nTenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisicao da sua conta.\n\nEstamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.\n\nAguardamos o seu contacto.\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';
const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECCAO'},{id:'messages',label:'MENSAGENS'},
  {id:'followups',label:'FOLLOW-UPS'},{id:'inbox',label:'INBOX'},{id:'agent',label:'AGENTE IA'},
  {id:'campaigns',label:'CAMPANHAS'},{id:'analytics',label:'ANALYTICS'},{id:'activity',label:'ACTIVIDADE'},{id:'config',label:'CONFIGURACAO'},
];
const storeGet = (k:string, d:string='') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k:string, v:string) => { try { localStorage.setItem(k, v); } catch {} };
const getSeenProfiles = () => { try { return new Set(JSON.parse(localStorage.getItem('mba_seen')||'[]')); } catch { return new Set(); } };
const saveSeenProfiles = (profiles:any[]) => { try { const s = getSeenProfiles(); profiles.forEach(i => s.add(i.id)); localStorage.setItem('mba_seen', JSON.stringify([...s])); } catch {} };
const exportCSV = (profiles:any[])=>{if(!profiles.length)return;const h=['Handle','Nome','Seguidores','Score','Plataforma','URL'];const rows=profiles.map(p=>[p.username||p.handle,p.displayName,p.followers,p.score,p.platform,p.profileUrl]);const csv=[h,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,"'")}"`).join(',')).join('\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`MBA_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);};
const fmtDt = (d:string) => { try { return new Date(d).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
const statusColors: Record<string, string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b', blacklisted: '#666' };
const statusLabels: Record<string, string> = { prospect:'Prospecto', contacted:'Contactado', replied:'Respondeu', accepted:'Aceite', rejected:'Rejeitado', blacklisted:'Blacklist' };

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
  const c = statusColors[status] || P.textDim;
  const l = statusLabels[status] || status;
  return <span style={{ padding:'2px 8px', borderRadius:3, background:c+'18', border:'1px solid '+c+'44', color:c, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{l}</span>;
}

function LoginScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const { setAuthenticated } = useMBAStore();
  const lines = ['A verificar credenciais...', 'A inicializar MBA-OS...', 'A carregar modulos...', 'A conectar APIs...', 'Sistema pronto.'];

  const tryLogin = async () => {
    try {
      const res = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code}) });
      if (!res.ok) { setError(true); setTimeout(()=>setError(false),1500); return; }
      setBooting(true);
      for (let i = 0; i < lines.length; i++) { setBootStep(i); await new Promise(r=>setTimeout(r,450)); }
      const data = await res.json();
      storeSet('mba_session', data.sessionId || 'active');
      setAuthenticated(true, data.sessionId);
    } catch { setError(true); setTimeout(()=>setError(false),1500); }
  };

  const gridBg = { backgroundImage:'linear-gradient('+P.border+' 1px,transparent 1px),linear-gradient(90deg,'+P.border+' 1px,transparent 1px)', backgroundSize:'52px 52px' };
  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', ...gridBg }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(192,0,28,0.14) 0%, transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', left:0, right:0, height:1, background:'linear-gradient(transparent,'+P.red+',transparent)', opacity:0.2, animation:'scan 6s linear infinite', pointerEvents:'none' }} />
      <Sphere size={240} />
      <div style={{ position:'absolute', textAlign:'center', animation:'fade-up .6s ease-out' }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:42, fontWeight:900, color:P.red, animation:'glitch 4s infinite', letterSpacing:4, marginBottom:6 }}>MBA</div>
        <div style={{ fontSize:11, color:P.textSec, letterSpacing:6, textTransform:'uppercase', marginBottom:4 }}>MWANGO BRAIN AGENT</div>
        <div style={{ fontSize:10, color:P.textDim, letterSpacing:2 }}>PROSPECCAO INTELIGENTE v2.0</div>
      </div>
      {booting ? (
        <div style={{ position:'absolute', bottom:'20%', fontFamily:"'JetBrains Mono',monospace", fontSize:11, textAlign:'center' }}>
          {lines.map((l,i) => <div key={i} style={{ color: i<=bootStep ? P.green : P.textDim, marginBottom:4, opacity: i<=bootStep?1:0.3, transition:'all .3s' }}>{i<=bootStep?'\u2713':'\u25CB'} {l}</div>)}
        </div>
      ) : (
        <div style={{ position:'absolute', bottom:'18%', display:'flex', flexDirection:'column', alignItems:'center', gap:10, animation:'fade-up .8s ease-out' }}>
          <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryLogin()} placeholder="Codigo de acesso" style={{ ...INP, width:260, textAlign:'center', letterSpacing:3, fontSize:14 }} />
          {error && <div style={{ color:P.orange, fontSize:12 }}>Codigo incorrecto</div>}
          <button onClick={tryLogin} style={{ width:260, padding:'11px', background:'rgba(192,0,28,0.15)', border:'1px solid '+P.red, color:P.redB, borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:1 }}>ENTRAR NO SISTEMA</button>
        </div>
      )}
      <div style={{ position:'absolute', bottom:12, fontSize:9, color:P.textDim, letterSpacing:3 }}>LUANDA . ANGOLA . mwangobrain.com</div>
    </div>
  );
}

function DashboardTab({ dashData, onRefresh }: { dashData: any; onRefresh:()=>void }) {
  if (!dashData) return <div style={{ padding:16 }}><Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>\u25CE</div><div style={{ color:P.text, fontSize:14, fontWeight:600 }}>Sem dados ainda</div><div style={{ fontSize:12, marginTop:6 }}>Execute uma prospeccao para ver resultados.</div></div></Panel></div>;
  const d = dashData;
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Painel Geral</STitle><Btn variant="ghost" size="sm" onClick={onRefresh}>Actualizar</Btn></div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={d.totalProfiles} sub="na base de dados" />
        <StatCard label="Contactados hoje" value={d.dailyStats?.[6]?.contacted || 0} sub="ultimas 24h" color={P.orange} />
        <StatCard label="Respostas hoje" value={d.dailyStats?.[6]?.replied || 0} sub="ultimas 24h" color={P.green} />
        <StatCard label="Taxa de resposta" value={d.responseRate+'%'} sub={d.outbound+' enviadas / '+d.inbound+' recebidas'} color={P.blue} />
        <StatCard label="Campanhas" value={d.totalCampaigns} sub="total criadas" />
        <StatCard label="Follow-ups pendentes" value={d.pendingFollowUps || 0} color={P.orange} />
      </div>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade ultimos 7 dias</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{(d.dailyStats || []).map((ds: any, i: number) => (
            <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:P.textSec, fontSize:11 }}>{ds.dayName} {ds.date.slice(5)}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{ds.contacted}c / {ds.replied}r / {ds.accepted}a</span></div>
              <div style={{ display:'flex', gap:3 }}><div style={{ flex:2 }}><Bar value={ds.contacted} max={Math.max(...(d.dailyStats||[]).map((x:any)=>x.contacted),1)} color={P.orange} h={6} /></div><div style={{ flex:2 }}><Bar value={ds.replied} max={Math.max(...(d.dailyStats||[]).map((x:any)=>x.replied),1)} color={P.green} h={6} /></div><div style={{ flex:1 }}><Bar value={ds.accepted} max={Math.max(...(d.dailyStats||[]).map((x:any)=>x.accepted),1)} color={P.blue} h={6} /></div></div>
            </div>
          ))}</div>
        </Panel>
        <Panel><STitle>Por Plataforma</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{(d.byPlatform || []).map((p: any, i: number) => {
            const colors = [P.red, P.orange, P.blue, P.green];
            const maxP = Math.max(...(d.byPlatform||[]).map((x:any)=>x._count),1);
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p._count}</span></div><Bar value={p._count} max={maxP} color={colors[i%4]} h={8} /></div>;
          })}</div>
          {(!d.byPlatform || !d.byPlatform.length) && <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Sem dados de plataformas</div>}
        </Panel>
      </div>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(d.byStatus || []).map((s: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:8, height:8, borderRadius:2, background:statusColors[s.status]||P.textDim }} /><span style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{s.status}</span></div><span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s._count}</span></div>
          ))}</div>
        </Panel>
        <Panel><STitle>Top 10 Perfis</STitle>
          {(d.topProfiles || []).map((p: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:i<9?'1px solid '+P.border:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.textDim, fontSize:10, width:18, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}.</span><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{p.username}</span><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div>
              <span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{(p.followers||0).toLocaleString('pt-PT')}</span>
            </div>
          ))}
          {(!d.topProfiles || !d.topProfiles.length) && <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Sem perfis</div>}
        </Panel>
      </div>
    </div>
  );
}
