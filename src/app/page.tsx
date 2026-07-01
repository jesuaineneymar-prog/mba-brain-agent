'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMBAStore } from '@/store/mba-store';

const getSessionId = () => { try { return localStorage.getItem('mba_session') || ''; } catch { return ''; } };
const mbaFetch = async (url: string, opts: RequestInit = {}) => {
  const sid = getSessionId();
  const headers = new Headers(opts.headers || {});
  if (sid) headers.set('x-mba-session', sid);
  if (!headers.has('Content-Type') && opts.body && typeof opts.body === 'string') headers.set('Content-Type', 'application/json');
  return fetch(url, { ...opts, headers });
};

const P = {
  bg:'#05050B', surface:'#0E0E1C', surface2:'#141428',
  red:'#C0001C', redB:'#FF1A3C',
  redGlow:'rgba(192,0,28,0.18)', redDim:'rgba(192,0,28,0.08)',
  border:'rgba(192,0,28,0.14)', borderHi:'rgba(192,0,28,0.35)',
  text:'#F2F2FA', textSec:'#9090AA', textDim:'#505068',
  green:'#00C063', orange:'#E06000', blue:'#3B82F6',
};
const INP: React.CSSProperties = { width:'100%', padding:'9px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:13, outline:'none', fontFamily:"'JetBrains Mono',monospace" };
const SEL: React.CSSProperties = { ...INP, appearance:'none' as any, cursor:'pointer' };
const LIMIT_DIARIO = 30;
const PROPOSTA = 'Ola,\nO meu nome e Jesuaine Cristiano e represento a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.\nTenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisicao da sua conta.\n\nEstamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.\n\nAguardamos o seu contacto.\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';
const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECCAO'},{id:'messages',label:'MENSAGENS'},
  {id:'followups',label:'FOLLOW-UPS'},{id:'inbox',label:'INBOX'},{id:'agent',label:'AGENTE IA'},
  {id:'campaigns',label:'CAMPANHAS'},{id:'analytics',label:'ANALYTICS'},{id:'activity',label:'ACTIVIDADE'},{id:'config',label:'CONFIGURACAO'},
];
const storeGet = (k:string, d:string='') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k:string, v:string) => { try { localStorage.setItem(k, v); } catch {} };
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
function STitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ color:P.text, fontSize:13, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:8, ...style }}><div style={{ width:3, height:14, background:P.red, borderRadius:2, flexShrink:0 }} />{children}</div>;
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
function BarComp({ value, max, color=P.red, h=8 }: { value:number; max:number; color?:string; h?:number }) {
  const pct = max > 0 ? Math.min(100, (value/max)*100) : 0;
  return <div style={{ height:h, background:P.surface2, borderRadius:h/2, overflow:'hidden' }}><div style={{ height:'100%', width:pct+'%', background:'linear-gradient(90deg,'+color+','+P.redB+')', borderRadius:h/2, transition:'width .5s' }} /></div>;
}
function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || P.textDim;
  const l = statusLabels[status] || status;
  return <span style={{ padding:'2px 8px', borderRadius:3, background:c+'18', border:'1px solid '+c+'44', color:c, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{l}</span>;
}
function EmptyState({ icon, title, sub }: { icon:string; title:string; sub:string }) {
  return <div style={{ textAlign:'center', padding:48, color:P.textDim }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>{icon}</div><div style={{ color:P.text, fontSize:14, fontWeight:600 }}>{title}</div><div style={{ fontSize:12, marginTop:6 }}>{sub}</div></div>;
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
      const res = await mbaFetch('/api/auth/login', { method:'POST', body:JSON.stringify({code}) });
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
  if (!dashData) return <div style={{ padding:16 }}><Panel><EmptyState icon="\u25CE" title="Sem dados ainda" sub="Execute uma prospeccao para ver resultados." /></Panel></div>;
  const d = dashData;
  const o = d.overview || {};
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Painel Geral</STitle><Btn variant="ghost" size="sm" onClick={onRefresh}>Actualizar</Btn></div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={o.totalProfiles||0} sub="na base de dados" />
        <StatCard label="Contactados hoje" value={o.contactedToday||0} sub="ultimas 24h" color={P.orange} />
        <StatCard label="Respostas hoje" value={o.repliedToday||0} sub="ultimas 24h" color={P.green} />
        <StatCard label="Taxa de resposta" value={(o.responseRate||0).toFixed(1)+'%'} sub={(o.outboundMessages||0)+' enviadas / '+(o.inboundMessages||0)+' recebidas'} color={P.blue} />
        <StatCard label="Campanhas" value={o.totalCampaigns||0} sub="total criadas" />
        <StatCard label="Follow-ups" value={d.pendingFollowUps||0} sub="pendentes" color={P.orange} />
      </div>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade ultimos 7 dias</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{(d.dailyStats || []).map((ds: any, i: number) => {
            const maxC = Math.max(...(d.dailyStats||[]).map((x:any)=>x.contacted),1);
            const maxR = Math.max(...(d.dailyStats||[]).map((x:any)=>x.replied),1);
            return <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11 }}>{ds.dayName} {ds.date?ds.date.slice(5):''}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{ds.contacted}c / {ds.replied}r / {ds.accepted}a</span></div>
              <div style={{ display:'flex', gap:3 }}><div style={{ flex:2 }}><BarComp value={ds.contacted} max={maxC} color={P.orange} h={6} /></div><div style={{ flex:2 }}><BarComp value={ds.replied} max={maxR} color={P.green} h={6} /></div><div style={{ flex:1 }}><BarComp value={ds.accepted} max={Math.max(...(d.dailyStats||[]).map((x:any)=>x.accepted),1)} color={P.blue} h={6} /></div></div>
            </div>;
          })}</div>
        </Panel>
        <Panel><STitle>Por Plataforma</STitle>
          {(d.platformBreakdown || []).length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{d.platformBreakdown.map((p: any, i: number) => {
            const colors = [P.red, P.orange, P.blue, P.green];
            const maxP = Math.max(...d.platformBreakdown.map((x:any)=>x.count),1);
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.count}</span></div><BarComp value={p.count} max={maxP} color={colors[i%4]} h={8} /></div>;
          })}</div> : <EmptyState icon="\u25CE" title="Sem dados" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(d.statusBreakdown || []).map((s: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:8, height:8, borderRadius:2, background:statusColors[s.status]||P.textDim }} /><span style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{s.status}</span></div><span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s.count}</span></div>
          ))}</div>
        </Panel>
        <Panel><STitle>Top 10 Perfis</STitle>
          {(d.topProfiles || []).length > 0 ? d.topProfiles.map((p: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:i<9?'1px solid '+P.border:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.textDim, fontSize:10, width:18, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}.</span><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{p.username}</span><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div>
              <span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{(p.followers||0).toLocaleString('pt-PT')}</span>
            </div>
          )) : <EmptyState icon="\u25CE" title="Sem perfis" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
    </div>
  );
}

function ProfileDetailModal({ profile, onClose, onUpdate }: { profile: any; onClose:()=>void; onUpdate:()=>void }) {
  const [notes, setNotes] = useState(profile?.notes || '');
  const [status, setStatus] = useState(profile?.status || 'prospect');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  if (!profile) return null;
  const saveNotes = async () => {
    await mbaFetch('/api/profiles', { method:'PATCH', body:JSON.stringify({ id:profile.id, notes, status }) });
    onUpdate();
  };
  const sendMessage = async () => {
    if (!msg.trim()) return;
    setSending(true);
    await mbaFetch('/api/send-message', { method:'POST', body:JSON.stringify({ profileId:profile.id, message:msg, platform:profile.platform, username:profile.username, campaignId:profile.campaignId }) });
    setMsg(''); setSending(false); onUpdate();
  };
  const blacklist = async () => {
    await mbaFetch('/api/blacklist', { method:'POST', body:JSON.stringify({ platform:profile.platform, username:profile.username, reason:'Manual blacklist' }) });
    await mbaFetch('/api/profiles', { method:'PATCH', body:JSON.stringify({ id:profile.id, status:'blacklisted' }) });
    onUpdate(); onClose();
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }} onClick={onClose}>
      <div style={{ background:P.surface, border:'1px solid '+P.border, borderRadius:12, padding:20, width:'90%', maxWidth:560, maxHeight:'85vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ color:P.redB, fontSize:16, fontWeight:700 }}>{profile.username}</div>
            <span style={{ color:P.textDim, fontSize:11 }}>{profile.platform}</span>
            <StatusBadge status={status} />
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', fontSize:18 }}>&times;</button>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div><Lbl>Seguidores</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace" }}>{(profile.followers||0).toLocaleString('pt-PT')}</div></div>
          <div><Lbl>Score</Lbl><div style={{ color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{(profile.score||0).toFixed(1)}</div></div>
          <div><Lbl>Posts</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace" }}>{profile.postsCount||0}</div></div>
          {profile.isBusiness && <div style={{ padding:'3px 8px', borderRadius:3, background:P.blue+'18', border:'1px solid '+P.blue+'44', color:P.blue, fontSize:10, fontWeight:600, alignSelf:'center' }}>BUSINESS</div>}
          {profile.isVerified && <div style={{ padding:'3px 8px', borderRadius:3, background:P.green+'18', border:'1px solid '+P.green+'44', color:P.green, fontSize:10, fontWeight:600, alignSelf:'center' }}>VERIFICADO</div>}
          {profile.isBot && <div style={{ padding:'3px 8px', borderRadius:3, background:'#ff6b6b18', border:'1px solid #ff6b6b44', color:'#ff6b6b', fontSize:10, fontWeight:600, alignSelf:'center' }}>BOT</div>}
        </div>
        {profile.bio && <div style={{ marginBottom:14 }}><Lbl>Biografia</Lbl><div style={{ color:P.textSec, fontSize:12, whiteSpace:'pre-wrap' }}>{profile.bio}</div></div>}
        <div style={{ marginBottom:14 }}><Lbl>Estado</Lbl>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['prospect','contacted','replied','accepted','rejected'].map(s => <button key={s} onClick={()=>setStatus(s)} style={{ padding:'5px 10px', borderRadius:4, border:'1px solid '+(status===s?(statusColors[s]||P.red):P.border), background:status===s?(statusColors[s]||P.red)+'18':'transparent', color:status===s?(statusColors[s]||P.red):P.textSec, fontSize:11, cursor:'pointer' }}>{statusLabels[s]}</button>)}
          </div>
        </div>
        <div style={{ marginBottom:14 }}><Lbl>Notas</Lbl><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} style={{ ...INP, resize:'vertical' }} /></div>
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
          <Btn onClick={saveNotes}>Guardar</Btn>
          <Btn variant="danger" onClick={blacklist}>Blacklist</Btn>
          {profile.profileUrl && <a href={profile.profileUrl} target="_blank" rel="noreferrer"><Btn variant="ghost">Abrir perfil</Btn></a>}
        </div>
        <div style={{ borderTop:'1px solid '+P.border, paddingTop:14 }}>
          <Lbl>Enviar mensagem</Lbl>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3} placeholder="Escreva a mensagem..." style={{ ...INP, resize:'vertical', marginBottom:8 }} />
          <Btn onClick={sendMessage} disabled={sending || !msg.trim()}>{sending ? 'A enviar...' : 'Enviar'}</Btn>
        </div>
      </div>
    </div>
  );
}

function ProspectingTab() {
  const [apifyKey, setApifyKey] = useState(() => { try { return localStorage.getItem('mba_apify_key') || ''; } catch { return ''; } });
  const saveApifyKey = (k: string) => { setApifyKey(k); try { localStorage.setItem('mba_apify_key', k); } catch {} };
  const [form, setForm] = useState({ platform:'instagram', minFollowers:0, maxFollowers:50000, minMonthsActive:0, requireRegular:false, targetCount:50, campaignName:'', maxPerDay:LIMIT_DIARIO, keywords:'', location:'Angola' });
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detailProfile, setDetailProfile] = useState<any>(null);
  const [prospectLog, setProspectLog] = useState<string[]>([]);
  const [prospectMsg, setProspectMsg] = useState('');
  const loadProfiles = async () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (filterPlat !== 'all') params.set('platform', filterPlat);
    if (filterStatus !== 'all') params.set('status', filterStatus);
    if (search) params.set('search', search);
    const res = await mbaFetch('/api/profiles?' + params);
    if (res.ok) { const d = await res.json(); setProfiles(d.profiles || []); setTotal(d.total || 0); }
  };
  useEffect(() => { loadProfiles(); }, [page, filterPlat, filterStatus, search]);
  const runProspect = async () => {
    setLoading(true); setResults([]); setProspectLog([]); setProspectMsg('');
    try {
      const res = await mbaFetch('/api/prospect', { method:'POST', body:JSON.stringify({ ...form, apifyToken: apifyKey }) });
      const d = await res.json();
      setProspectLog(d.log || []);
      setProspectMsg(d.message || '');
      if (d.profiles && d.profiles.length > 0) {
        // Mostrar perfis diretamente
        setResults(d.profiles);
        // Guardar no localStorage
        try {
          const saved: any[] = JSON.parse(localStorage.getItem('mba_profiles') || '[]');
          const savedIds = new Set(saved.map((s: any) => s.username + ':' + s.platform));
          const newOnes = d.profiles.filter((p: any) => !savedIds.has(p.username + ':' + p.platform));
          const merged = [...saved, ...newOnes];
          localStorage.setItem('mba_profiles', JSON.stringify(merged));
          setProfiles(merged);
          setTotal(merged.length);
        } catch(e2) {
          // Se localStorage falhar, mostrar resultados mesmo assim
          setProfiles(d.profiles);
          setTotal(d.profiles.length);
        }
        setSelected(new Set());
        refreshDash();
      }
    } catch (e) { setProspectMsg('Erro de conexao. Tenta novamente.'); } finally { setLoading(false); }
  };
  const toggleAll = () => {
    const filtered = profiles.filter(p => (filterPlat==='all' || p.platform===filterPlat) && (filterStatus==='all' || p.status===filterStatus));
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };
  const bulkMessage = async () => {
    if (!selected.size) return;
    for (const id of selected) {
      const p = profiles.find(x => x.id === id);
      if (p) await mbaFetch('/api/send-message', { method:'POST', body:JSON.stringify({ profileId:p.id, message:PROPOSTA, platform:p.platform, username:p.username, campaignId:p.campaignId }) });
    }
    setSelected(new Set()); loadProfiles();
  };
  const bulkBlacklist = async () => {
    for (const id of selected) {
      const p = profiles.find(x => x.id === id);
      if (p) { await mbaFetch('/api/blacklist', { method:'POST', body:JSON.stringify({ platform:p.platform, username:p.username }) }); await mbaFetch('/api/profiles', { method:'PATCH', body:JSON.stringify({ id:p.id, status:'blacklisted' }) }); }
    }
    setSelected(new Set()); loadProfiles();
  };
  const filtered = results.length > 0 ? results : profiles;
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <Panel style={{ marginBottom:14 }}>
        <STitle>Nova Prospeccao</STitle>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} style={SEL as any}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option><option value="all">Todas</option></select></div>
          <div><Lbl>Nome da campanha</Lbl><input value={form.campaignName} onChange={e=>setForm({...form,campaignName:e.target.value})} placeholder="Ex: Restaurantes Luanda" style={INP} /></div>
          <div><Lbl>Min. Seguidores</Lbl><input type="number" value={form.minFollowers} onChange={e=>setForm({...form,minFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max. Seguidores</Lbl><input type="number" value={form.maxFollowers} onChange={e=>setForm({...form,maxFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Alvo</Lbl><input type="number" value={form.targetCount} onChange={e=>setForm({...form,targetCount:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max/dia</Lbl><input type="number" value={form.maxPerDay} onChange={e=>setForm({...form,maxPerDay:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Palavras-chave</Lbl><input value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="restaurante, hotel, cafe" style={INP} /></div>
          <div><Lbl>Localizacao</Lbl><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} style={INP} /></div>
        </div>
        <div style={{ marginBottom:8 }}><Lbl>Apify API Key <span style={{ color:P.textDim, fontWeight:400 }}>(gratuita em apify.com)</span></Lbl><div style={{ display:'flex', gap:6 }}><input value={apifyKey} onChange={e=>saveApifyKey(e.target.value)} placeholder="apify_api_xxx..." style={INP} /></div></div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}><Toggle on={form.requireRegular} onChange={v=>setForm({...form,requireRegular:v})} /><span style={{ color:P.textSec, fontSize:12 }}>Exigir contas regulares</span></div>
        <Btn onClick={runProspect} disabled={loading}>{loading ? 'A procurar usuarios REAIS...' : 'Iniciar Prospeccao'}</Btn>
        {prospectMsg && <div style={{ marginTop:10, padding:10, borderRadius:6, background: results.length > 0 ? 'rgba(0,192,99,0.08)' : 'rgba(192,0,28,0.08)', border:'1px solid '+(results.length > 0 ? 'rgba(0,192,99,0.2)' : 'rgba(192,0,28,0.2)'), color: results.length > 0 ? P.green : P.orange, fontSize:11, lineHeight:1.5 }}>{prospectMsg}</div>}
        {prospectLog.length > 0 && <div style={{ marginTop:8, padding:8, borderRadius:6, background:P.surface2, border:'1px solid '+P.border, fontSize:10, color:P.textDim, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.6, maxHeight:120, overflowY:'auto' }}>{prospectLog.map((l,i)=><div key={i}>{'> '+l}</div>)}</div>}
        {!apifyKey && <div style={{ marginTop:10, padding:10, borderRadius:6, background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', color:P.blue, fontSize:11, lineHeight:1.5 }}><div style={{ fontWeight:700, marginBottom:4 }}>Para melhores resultados, adiciona a tua Apify Key:</div><div>1. Abre <a href="https://apify.com" target="_blank" rel="noreferrer" style={{ color:P.redB, textDecoration:'underline' }}>apify.com</a> no teu telefone e cria conta gratuita</div><div>2. Vai a Settings &gt; Integrations &gt; API</div><div>3. Copia a API key e cola no campo acima</div><div style={{ marginTop:4, color:P.textDim }}>O Apify garante acesso real a Instagram, TikTok, Facebook e LinkedIn.</div></div>}
      </Panel>
      {results.length > 0 && <Panel style={{ marginBottom:14, border:'1px solid rgba(0,192,99,0.2)' }}><STitle style={{ color:P.green }}>Resultados da prospeccao ({results.length} perfis REAIS)</STitle><div style={{ color:P.textSec, fontSize:12, marginBottom:10 }}>{results.length} perfis reais encontrados e guardados. Todos os perfis foram extraidos de plataformas reais.</div></Panel>}
      <Panel>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}><STitle>Perfis ({total})</STitle>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Pesquisar..." style={{ ...INP, width:160 }} />
            <select value={filterPlat} onChange={e=>{setFilterPlat(e.target.value);setPage(1);}} style={{ ...SEL as any, width:110 }}><option value="all">Todas</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option></select>
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}} style={{ ...SEL as any, width:120 }}><option value="all">Todos estados</option><option value="prospect">Prospecto</option><option value="contacted">Contactado</option><option value="replied">Respondeu</option><option value="accepted">Aceite</option></select>
            <Btn variant="ghost" size="sm" onClick={exportCSV.bind(null, filtered)}>Exportar CSV</Btn>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <button onClick={toggleAll} style={{ padding:'4px 10px', borderRadius:4, border:'1px solid '+P.border, background:selected.size>0?P.redDim:'transparent', color:selected.size>0?P.redB:P.textSec, fontSize:11, cursor:'pointer' }}>{selected.size===filtered.length?'Desselecionar':'Selecionar todos'}</button>
          {selected.size > 0 && <><Btn size="sm" onClick={bulkMessage}>Enviar ({selected.size})</Btn><Btn size="sm" variant="danger" onClick={bulkBlacklist}>Blacklist ({selected.size})</Btn></>}
        </div>
        <div style={{ overflowX:'auto' }}>
          <div style={{ minWidth:600 }}>
            <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.border, color:P.textDim, fontSize:10, fontWeight:600, letterSpacing:'.5px' }}><div style={{ width:30 }}><input type="checkbox" checked={selected.size===filtered.length && filtered.length>0} onChange={toggleAll} /></div><div style={{ flex:2 }}>HANDLE</div><div style={{ flex:2 }}>NOME</div><div style={{ width:80, textAlign:'right' }}>SEGUIDORES</div><div style={{ width:60, textAlign:'right' }}>SCORE</div><div style={{ width:90 }}>PLATAFORMA</div><div style={{ width:90 }}>ESTADO</div><div style={{ width:50 }}></div></div>
            {filtered.map((p: any) => (
              <div key={p.id} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.redDim, alignItems:'center', background:selected.has(p.id)?P.redDim:'transparent' }}>
                <div style={{ width:30 }}><input type="checkbox" checked={selected.has(p.id)} onChange={()=>{const s=new Set(selected);s.has(p.id)?s.delete(p.id):s.add(p.id);setSelected(s);}} /></div>
                <div style={{ flex:2, color:P.redB, fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{p.username}</div>
                <div style={{ flex:2, color:P.textSec, fontSize:12 }}>{p.displayName||'-'}</div>
                <div style={{ width:80, textAlign:'right', color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{(p.followers||0).toLocaleString('pt-PT')}</div>
                <div style={{ width:60, textAlign:'right', color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{(p.score||0).toFixed(1)}</div>
                <div style={{ width:90 }}><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div>
                <div style={{ width:90 }}><StatusBadge status={p.status} /></div>
                <div style={{ width:50 }}><button onClick={()=>setDetailProfile(p)} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', fontSize:14 }}>&#9776;</button></div>
              </div>
            ))}
          </div>
        </div>
        {total > 50 && <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}><Btn variant="ghost" size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</Btn><span style={{ color:P.textSec, fontSize:12, alignSelf:'center' }}>Pagina {page} de {Math.ceil(total/50)}</span><Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/50)} onClick={()=>setPage(page+1)}>Proxima</Btn></div>}
      </Panel>
      {detailProfile && <ProfileDetailModal profile={detailProfile} onClose={()=>{setDetailProfile(null);loadProfiles();}} onUpdate={loadProfiles} />}
    </div>
  );
}

function MessagesTab() {
  const [subtab, setSubtab] = useState<'all'|'outbound'|'inbound'>('all');
  const [messages, setMessages] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selProfile, setSelProfile] = useState('');
  const [msgText, setMsgText] = useState(PROPOSTA);
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [abVariants, setAbVariants] = useState<any[]>([]);
  const [selVariant, setSelVariant] = useState('default');
  const [schedDate, setSchedDate] = useState('');
  const [queueInfo, setQueueInfo] = useState<any>({});
  const loadMessages = async () => {
    const res = await mbaFetch('/api/profiles?limit=100');
    let allProfiles: any[] = [];
    if (res.ok) { const d = await res.json(); allProfiles = d.profiles || []; setProfiles(allProfiles); }
    const msgs: any[] = [];
    allProfiles.forEach((p: any) => { if (p.messages) p.messages.forEach((m: any) => msgs.push({...m, _username:p.username, _platform:p.platform})); });
    setMessages(msgs.sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()));
  };
  const loadQueue = async () => {
    const res = await mbaFetch('/api/send-message');
    if (res.ok) { const d = await res.json(); setQueueInfo(d); setScheduled(d.scheduled || []); }
  };
  const loadAB = async () => {
    const res = await mbaFetch('/api/ab-test');
    if (res.ok) { const d = await res.json(); setAbVariants(d.variants || []); }
  };
  useEffect(() => { loadMessages(); loadQueue(); loadAB(); }, []);
  const sendMessage = async (sched?: string) => {
    if (!selProfile || !msgText.trim()) return;
    setSending(true);
    await mbaFetch('/api/send-message', { method:'POST', body:JSON.stringify({ profileId:selProfile, message:msgText, abTestGroup:selVariant!=='default'?selVariant:undefined, scheduledAt:sched||undefined }) });
    setSending(false); loadMessages(); loadQueue();
  };
  const selMsgText = selVariant !== 'default' ? (abVariants.find(v => v.groupName === selVariant)?.content || msgText) : msgText;
  const filtered = messages.filter(m => subtab === 'all' || m.direction === subtab);
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['all','Todas'],['outbound','Enviadas'],['inbound','Recebidas']].map(([k,l]) => (
          <button key={k} onClick={()=>setSubtab(k as any)} style={{ padding:'6px 14px', borderRadius:4, border:'1px solid '+(subtab===k?P.red:P.border), background:subtab===k?P.redDim:'transparent', color:subtab===k?P.redB:P.textSec, fontSize:11, cursor:'pointer', fontWeight:600 }}>{l} ({k==='all'?filtered.length:messages.filter((m:any)=>m.direction===k).length})</button>
        ))}
      </div>
      <Panel style={{ marginBottom:14 }}>
        <STitle>Enviar Mensagem</STitle>
        <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
          <div style={{ flex:2, minWidth:200 }}><Lbl>Perfil</Lbl><select value={selProfile} onChange={e=>setSelProfile(e.target.value)} style={SEL as any}><option value="">Seleccionar perfil...</option>{profiles.map((p: any) => <option key={p.id} value={p.id}>{p.username} ({p.platform})</option>)}</select></div>
          <div style={{ flex:1, minWidth:150 }}><Lbl>Variante A/B</Lbl><select value={selVariant} onChange={e=>{setSelVariant(e.target.value);const v=abVariants.find(x=>x.groupName===e.target.value);if(v)setMsgText(v.content);else setMsgText(PROPOSTA);}} style={SEL as any}><option value="default">Padrao</option>{abVariants.map((v: any) => <option key={v.id} value={v.groupName}>{v.name} ({v.sentCount}env / {v.replyCount}resp)</option>)}</select></div>
          <div style={{ minWidth:160 }}><Lbl>Agendar para</Lbl><input type="datetime-local" value={schedDate} onChange={e=>setSchedDate(e.target.value)} style={INP} /></div>
        </div>
        <textarea value={selMsgText} onChange={e=>setMsgText(e.target.value)} rows={4} style={{ ...INP, resize:'vertical', marginBottom:8 }} />
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <Btn onClick={()=>sendMessage()} disabled={sending || !selProfile}>{sending ? 'A enviar...' : 'Enviar agora'}</Btn>
          {schedDate && <Btn variant="ghost" onClick={()=>sendMessage(schedDate)}>Agendar</Btn>}
          <span style={{ color:P.textDim, fontSize:11 }}>Fila: {queueInfo.remainingToday ?? '?'} restantes hoje</span>
        </div>
      </Panel>
      {scheduled.length > 0 && <Panel style={{ marginBottom:14 }}><STitle>Mensagens agendadas ({scheduled.length})</STitle>
        {scheduled.map((m: any, i: number) => <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid '+P.border, alignItems:'center' }}><div><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{m.profiles?.username || '?'}</span><span style={{ color:P.textDim, fontSize:11, marginLeft:8 }}>{fmtDt(m.scheduledAt)}</span></div><StatusBadge status={m.direction} /></div>)}
      </Panel>}
      <Panel><STitle>Historico ({filtered.length})</STitle>
        {filtered.length > 0 ? filtered.slice(0,100).map((m: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:i<99?'1px solid '+P.redDim:'none', alignItems:'center' }}>
            <div style={{ flex:1, minWidth:0 }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:m.direction==='outbound'?P.orange:P.green, fontSize:10, fontWeight:700 }}>{m.direction==='outbound'?'OUT':'IN'}</span><span style={{ color:P.redB, fontSize:11, fontWeight:600 }}>{m._username}</span><span style={{ color:P.textDim, fontSize:10 }}>{m._platform}</span>{m.abTestGroup && <span style={{ color:P.blue, fontSize:9, padding:'1px 5px', borderRadius:2, background:P.blue+'18' }}>A/B:{m.abTestGroup}</span>}</div><div style={{ color:P.textSec, fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.content}</div></div>
            <span style={{ color:P.textDim, fontSize:10, marginLeft:10, flexShrink:0 }}>{fmtDt(m.sentAt)}</span>
          </div>
        )) : <EmptyState icon="\u2709" title="Sem mensagens" sub="As mensagens aparecerao aqui" />}
      </Panel>
    </div>
  );
}

function FollowUpsTab() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [form, setForm] = useState({ profileId:'', username:'', platform:'instagram', scheduledAt:'', notes:'', message:'' });
  const load = async () => { const res = await mbaFetch('/api/followups'); if (res.ok) { const d = await res.json(); setFollowUps(d.followUps || []); setPendingCount(d.pendingCount || 0); } };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.profileId || !form.scheduledAt) return;
    await mbaFetch('/api/followups', { method:'POST', body:JSON.stringify(form) });
    setForm({ profileId:'', username:'', platform:'instagram', scheduledAt:'', notes:'', message:'' }); load();
  };
  const markDone = async (id: string) => {
    await mbaFetch('/api/followups', { method:'PATCH', body:JSON.stringify({ id, status:'completed' }) }); load();
  };
  const remove = async (id: string) => {
    await mbaFetch('/api/followups?id='+id, { method:'DELETE' }); load();
  };
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Follow-ups ({pendingCount} pendentes)</STitle><Btn variant="ghost" size="sm" onClick={load}>Actualizar</Btn></div>
      <Panel style={{ marginBottom:14 }}>
        <STitle>Novo Follow-up</STitle>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><Lbl>ID do Perfil</Lbl><input value={form.profileId} onChange={e=>setForm({...form,profileId:e.target.value})} placeholder="Colar ID do perfil" style={INP} /></div>
          <div><Lbl>Username</Lbl><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} style={INP} /></div>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} style={SEL as any}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option></select></div>
          <div><Lbl>Agendar para</Lbl><input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})} style={INP} /></div>
        </div>
        <div style={{ marginBottom:10 }}><Lbl>Mensagem</Lbl><textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} rows={2} style={{ ...INP, resize:'vertical' }} /></div>
        <div style={{ marginBottom:10 }}><Lbl>Notas</Lbl><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} style={INP} /></div>
        <Btn onClick={create} disabled={!form.profileId || !form.scheduledAt}>Criar Follow-up</Btn>
      </Panel>
      <Panel>
        {followUps.length > 0 ? followUps.map((fu: any) => (
          <div key={fu.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid '+P.border }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{fu.username || '?'}</span><span style={{ color:P.textDim, fontSize:10 }}>{fu.platform}</span><StatusBadge status={fu.status} /></div>
              {fu.message && <div style={{ color:P.textSec, fontSize:11, marginTop:4 }}>{fu.message}</div>}
              <div style={{ color:P.textDim, fontSize:10, marginTop:2 }}>Agendado: {fmtDt(fu.scheduledAt)}</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {fu.status === 'pending' && <Btn size="sm" onClick={()=>markDone(fu.id)}>Concluido</Btn>}
              <Btn size="sm" variant="danger" onClick={()=>remove(fu.id)}>Eliminar</Btn>
            </div>
          </div>
        )) : <EmptyState icon="\u21BB" title="Sem follow-ups" sub="Crie um follow-up acima" />}
      </Panel>
    </div>
  );
}

function InboxTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    const res = await mbaFetch('/api/inbox');
    if (res.ok) { const d = await res.json(); setMessages(d.messages || []); setConversations(d.metaConversations || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Inbox ({messages.length} mensagens)</STitle><Btn variant="ghost" size="sm" onClick={load} disabled={loading}>{loading ? 'A carregar...' : 'Actualizar'}</Btn></div>
      {conversations.length > 0 && <Panel style={{ marginBottom:14 }}><STitle>Conversas Meta (Facebook)</STitle>
        {conversations.map((c: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<conversations.length-1?'1px solid '+P.border:'none', alignItems:'center' }}>
            <div><div style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{c.participant || 'Desconhecido'}</div><div style={{ color:P.textSec, fontSize:11, marginTop:2 }}>{c.snippet}</div></div>
            <span style={{ color:P.textDim, fontSize:10, flexShrink:0 }}>{c.updatedTime ? fmtDt(c.updatedTime) : ''}</span>
          </div>
        ))}
      </Panel>}
      <Panel><STitle>Mensagens recebidas</STitle>
        {messages.length > 0 ? messages.map((m: any, i: number) => (
          <div key={m.id || i} style={{ padding:'10px 0', borderBottom:i<messages.length-1?'1px solid '+P.redDim:'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ color:P.green, fontSize:10, fontWeight:700 }}>IN</span>
              <span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{m.profile?.username || 'Desconhecido'}</span>
              <span style={{ color:P.textDim, fontSize:10 }}>{m.profile?.platform || ''}</span>
              {!m.isRead && <div style={{ width:6, height:6, borderRadius:'50%', background:P.red }} />}
            </div>
            <div style={{ color:P.textSec, fontSize:12 }}>{m.content}</div>
            <div style={{ color:P.textDim, fontSize:10, marginTop:4 }}>{fmtDt(m.sentAt)}</div>
          </div>
        )) : <EmptyState icon="\u2606" title="Inbox vazio" sub="As mensagens recebidas aparecerao aqui" />}
      </Panel>
    </div>
  );
}

function AgentChat() {
  const [chatHistory, setChatHistory] = useState<{role:string; content:string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState('');
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [chatHistory]);
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setChatHistory(h => [...h, { role:'user', content:userMsg }]);
    setLoading(true);
    try {
      const res = await mbaFetch('/api/respond', { method:'POST', body:JSON.stringify({ profileId: profileId || undefined, message: userMsg, conversationHistory: chatHistory.slice(-10) }) });
      if (res.ok) { const d = await res.json(); setChatHistory(h => [...h, { role:'assistant', content:d.reply }]); }
      else { setChatHistory(h => [...h, { role:'assistant', content:'Erro ao gerar resposta.' }]); }
    } catch { setChatHistory(h => [...h, { role:'assistant', content:'Erro de ligacao.' }]); }
    setLoading(false);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid '+P.border, display:'flex', gap:10, alignItems:'center' }}>
        <STitle>Agente IA</STitle>
        <input value={profileId} onChange={e=>setProfileId(e.target.value)} placeholder="ID do perfil (opcional)" style={{ ...INP, width:200, fontSize:11 }} />
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {chatHistory.length === 0 && <EmptyState icon="\u2609" title="Agente Mwango Brain" sub="Pergunte sobre prospeccao, perfis, ou peca sugestoes de mensagem." />}
        {chatHistory.map((m, i) => (
          <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:10 }}>
            <div style={{ maxWidth:'75%', padding:'10px 14px', borderRadius:8, background:m.role==='user'?'rgba(192,0,28,0.12)':'rgba(255,255,255,0.04)', border:'1px solid '+(m.role==='user'?P.border:'rgba(255,255,255,0.06)'), color:P.text, fontSize:13, lineHeight:1.5 }}>
              {m.role === 'assistant' && <div style={{ color:P.redB, fontSize:10, fontWeight:700, marginBottom:4 }}>MBA AGENTE</div>}
              <div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>
            </div>
          </div>
        ))}
        {loading && <div style={{ display:'flex', justifyContent:'flex-start' }}><div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(255,255,255,0.04)', color:P.textDim, fontSize:12, animation:'blink 1.5s infinite' }}>A pensar...</div></div>}
        <div ref={chatEnd} />
      </div>
      <div style={{ padding:12, borderTop:'1px solid '+P.border, display:'flex', gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Escreva a sua mensagem..." style={{ ...INP, flex:1 }} />
        <Btn onClick={send} disabled={loading || !input.trim()}>Enviar</Btn>
      </div>
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState({ name:'', status:'pending', targetCount:200, minFollowers:1000, maxFollowers:50000, platform:'all', maxPerDay:LIMIT_DIARIO });
  const load = async () => { const res = await mbaFetch('/api/campaigns'); if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns || []); } };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.name.trim()) return;
    if (editId) { await mbaFetch('/api/campaigns', { method:'PATCH', body:JSON.stringify({ id:editId, ...form }) }); }
    else { await mbaFetch('/api/campaigns', { method:'POST', body:JSON.stringify(form) }); }
    setShowForm(false); setEditId(''); setForm({ name:'', status:'pending', targetCount:200, minFollowers:1000, maxFollowers:50000, platform:'all', maxPerDay:LIMIT_DIARIO }); load();
  };
  const edit = (c: any) => { setForm({ name:c.name, status:c.status, targetCount:c.targetCount, minFollowers:c.minFollowers, maxFollowers:c.maxFollowers, platform:c.platform, maxPerDay:c.maxPerDay }); setEditId(c.id); setShowForm(true); };
  const remove = async (id: string) => { await mbaFetch('/api/campaigns?id='+id, { method:'DELETE' }); load(); };
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Campanhas ({campaigns.length})</STitle><Btn size="sm" onClick={()=>{setShowForm(!showForm);setEditId('');setForm({name:'',status:'pending',targetCount:200,minFollowers:1000,maxFollowers:50000,platform:'all',maxPerDay:LIMIT_DIARIO});}}>{showForm?'Cancelar':'Nova campanha'}</Btn></div>
      {showForm && <Panel style={{ marginBottom:14 }}>
        <STitle>{editId?'Editar':'Nova'} campanha</STitle>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><Lbl>Nome</Lbl><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome da campanha" style={INP} /></div>
          <div><Lbl>Estado</Lbl><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={SEL as any}><option value="pending">Pendente</option><option value="active">Activa</option><option value="paused">Pausada</option><option value="completed">Concluida</option></select></div>
          <div><Lbl>Alvo</Lbl><input type="number" value={form.targetCount} onChange={e=>setForm({...form,targetCount:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} style={SEL as any}><option value="all">Todas</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option></select></div>
          <div><Lbl>Min. Seguidores</Lbl><input type="number" value={form.minFollowers} onChange={e=>setForm({...form,minFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max. Seguidores</Lbl><input type="number" value={form.maxFollowers} onChange={e=>setForm({...form,maxFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max/dia</Lbl><input type="number" value={form.maxPerDay} onChange={e=>setForm({...form,maxPerDay:Number(e.target.value)})} style={INP} /></div>
        </div>
        <Btn onClick={save} disabled={!form.name.trim()}>{editId?'Guardar':'Criar'}</Btn>
      </Panel>}
      {campaigns.length > 0 ? campaigns.map((c: any) => (
        <Panel key={c.id} style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
            <div><div style={{ color:P.text, fontSize:14, fontWeight:700 }}>{c.name}</div><div style={{ color:P.textDim, fontSize:11, marginTop:2 }}>{fmtDt(c.createdAt)}</div></div>
            <div style={{ display:'flex', gap:6 }}><Btn size="sm" variant="ghost" onClick={()=>edit(c)}>Editar</Btn><Btn size="sm" variant="danger" onClick={()=>remove(c.id)}>Eliminar</Btn></div>
          </div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
            <div><Lbl>Estado</Lbl><StatusBadge status={c.status} /></div>
            <div><Lbl>Enviadas</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{c._count?.messages||c.sentCount||0}</div></div>
            <div><Lbl>Respostas</Lbl><div style={{ color:P.green, fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{c.repliedCount||0}</div></div>
            <div><Lbl>Perfis</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontSize:13 }}>{c._count?.profiles||0}</div></div>
            <div><Lbl>Plataforma</Lbl><div style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{c.platform}</div></div>
          </div>
        </Panel>
      )) : <EmptyState icon="\u2699" title="Sem campanhas" sub="Crie a sua primeira campanha" />}
    </div>
  );
}

function AnalyticsTab() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [abVariants, setAbVariants] = useState<any[]>([]);
  const [abStats, setAbStats] = useState<any>({});
  const [newAb, setNewAb] = useState({ group:'', name:'', content:'' });
  const load = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([mbaFetch('/api/pdf-report'), mbaFetch('/api/ab-test')]);
    if (r1.ok) setReportData(await r1.json());
    if (r2.ok) { const d = await r2.json(); setAbVariants(d.variants || []); setAbStats(d.groupStats || {}); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const genPdf = async () => {
    if (!reportData) return;
    setPdfStatus('A gerar...');
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const d = reportData;
      doc.setFontSize(20); doc.setTextColor(192, 0, 28); doc.text('MBA - Relatorio de Prospeccao', 20, 25);
      doc.setFontSize(10); doc.setTextColor(144, 144, 170); doc.text('Mwango Brain Agent - ' + new Date().toLocaleString('pt-PT'), 20, 33);
      doc.setDrawColor(192, 0, 28); doc.line(20, 37, 190, 37);
      doc.setTextColor(60, 60, 60); doc.setFontSize(12); doc.text('Visao Geral', 20, 50);
      doc.setFontSize(10);
      const stats = [['Total de perfis', d.totalProfiles], ['Total de mensagens', d.totalMessages], ['Mensagens enviadas', d.outbound], ['Mensagens recebidas', d.inbound], ['Taxa de resposta', d.responseRate + '%'], ['Total de campanhas', d.totalCampaigns], ['Follow-ups pendentes', d.pendingFollowUps]];
      stats.forEach(([l, v], i) => { doc.text(l + ': ' + v, 25, 60 + i * 7); });
      let y = 60 + stats.length * 7 + 10;
      doc.setFontSize(12); doc.text('Por Estado', 20, y); y += 8; doc.setFontSize(10);
      (d.byStatus || []).forEach((s: any) => { doc.text(s.status + ': ' + s._count, 25, y); y += 7; });
      y += 8; doc.setFontSize(12); doc.text('Por Plataforma', 20, y); y += 8; doc.setFontSize(10);
      (d.byPlatform || []).forEach((p: any) => { doc.text(p.platform + ': ' + p._count, 25, y); y += 7; });
      y += 8; doc.setFontSize(12); doc.text('Top 10 Perfis', 20, y); y += 8; doc.setFontSize(10);
      (d.topProfiles || []).forEach((p: any, i: number) => { doc.text((i + 1) + '. ' + p.username + ' (' + p.platform + ') - ' + (p.followers || 0).toLocaleString() + ' seguidores, score: ' + (p.score || 0).toFixed(1), 25, y); y += 7; });
      doc.save('MBA_Relatorio_' + new Date().toISOString().slice(0, 10) + '.pdf');
      setPdfStatus('PDF gerado com sucesso');
    } catch (e: any) { setPdfStatus('Erro: ' + (e.message || 'falha ao gerar PDF')); }
  };
  const addAbVariant = async () => {
    if (!newAb.group || !newAb.content.trim()) return;
    const res = await mbaFetch('/api/ab-test', { method:'POST', body:JSON.stringify(newAb) });
    if (res.ok) { setNewAb({ group:'', name:'', content:'' }); load(); }
  };
  const removeAb = async (id: string) => { await mbaFetch('/api/ab-test?id='+id, { method:'DELETE' }); load(); };
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Analytics</STitle><Btn variant="ghost" size="sm" onClick={load} disabled={loading}>Actualizar</Btn></div>
      {reportData && <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <StatCard label="Perfis" value={reportData.totalProfiles} />
        <StatCard label="Mensagens" value={reportData.totalMessages} color={P.orange} />
        <StatCard label="Taxa resposta" value={(reportData.responseRate||0).toFixed(1)+'%'} color={P.green} />
        <StatCard label="Campanhas" value={reportData.totalCampaigns} color={P.blue} />
      </div>}
      {reportData && <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Por Estado</STitle><div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(reportData.byStatus || []).map((s: any, i: number) => {
          const max = Math.max(...(reportData.byStatus || []).map((x: any) => x._count), 1);
          return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{s.status}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{s._count}</span></div><BarComp value={s._count} max={max} color={Object.values(statusColors)[i % 6] || P.red} h={8} /></div>;
        })}</div></Panel>
        <Panel><STitle>Por Plataforma</STitle><div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(reportData.byPlatform || []).map((p: any, i: number) => {
          const colors = [P.red, P.orange, P.blue, P.green];
          const max = Math.max(...(reportData.byPlatform || []).map((x: any) => x._count), 1);
          return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p._count}</span></div><BarComp value={p._count} max={max} color={colors[i % 4]} h={8} /></div>;
        })}</div></Panel>
      </div>}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <Btn onClick={genPdf} disabled={!reportData || pdfStatus === 'A gerar...'}>Gerar relatorio PDF</Btn>
        {pdfStatus && <span style={{ color:pdfStatus.includes('Erro')?'#ff6b6b':P.green, fontSize:12, alignSelf:'center' }}>{pdfStatus}</span>}
      </div>
      <Panel style={{ marginBottom:14 }}><STitle>Webhook URL</STitle>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}><input value={webhookUrl} onChange={e=>setWebhookUrl(e.target.value)} readOnly style={{ ...INP, flex:1, fontSize:11 }} placeholder={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook`} /><Btn variant="ghost" size="sm" onClick={()=>{const u=`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook`;setWebhookUrl(u);navigator.clipboard.writeText(u);}}>Copiar</Btn></div>
        <div style={{ color:P.textDim, fontSize:11, marginTop:8 }}>Configure esta URL nos webhooks das plataformas para receber mensagens automaticamente.</div>
      </Panel>
      <Panel style={{ marginBottom:14 }}><STitle>Teste A/B de mensagens</STitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr auto', gap:8, marginBottom:10, alignItems:'end' }}>
          <div><Lbl>Grupo</Lbl><input value={newAb.group} onChange={e=>setNewAb({...newAb,group:e.target.value})} placeholder="grupo_a" style={INP} /></div>
          <div><Lbl>Nome</Lbl><input value={newAb.name} onChange={e=>setNewAb({...newAb,name:e.target.value})} placeholder="Variante A" style={INP} /></div>
          <div><Lbl>Conteudo</Lbl><textarea value={newAb.content} onChange={e=>setNewAb({...newAb,content:e.target.value})} rows={2} style={{ ...INP, resize:'vertical' }} /></div>
          <Btn onClick={addAbVariant} disabled={!newAb.group || !newAb.content.trim()} style={{ marginBottom:0 }}>Adicionar</Btn>
        </div>
        {abVariants.length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{abVariants.map((v: any) => {
          const stats = abStats[v.groupName] || { sent: 0, replies: 0 };
          const rate = stats.sent > 0 ? ((stats.replies / stats.sent) * 100).toFixed(1) : '0.0';
          return <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid '+P.border }}>
            <div><div style={{ color:P.text, fontSize:12, fontWeight:600 }}>{v.name} <span style={{ color:P.blue, fontSize:10 }}>({v.groupName})</span></div><div style={{ color:P.textSec, fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:400 }}>{v.content}</div></div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{stats.sent}env</span><span style={{ color:P.green, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{stats.replies}resp</span><span style={{ color:P.blue, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{rate}%</span><button onClick={()=>removeAb(v.id)} style={{ background:'none', border:'none', color:'#ff6b6b', cursor:'pointer', fontSize:14 }}>&times;</button></div>
          </div>;
        })}</div> : <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:20 }}>Nenhuma variante A/B criada</div>}
      </Panel>
    </div>
  );
}

function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const load = async () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (actionFilter) params.set('action', actionFilter);
    const res = await mbaFetch('/api/activity-logs?' + params);
    if (res.ok) { const d = await res.json(); setLogs(d.logs || []); setTotal(d.total || 0); }
  };
  useEffect(() => { load(); }, [page, actionFilter]);
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}><STitle>Registo de actividade ({total})</STitle>
        <div style={{ display:'flex', gap:8 }}>
          <select value={actionFilter} onChange={e=>{setActionFilter(e.target.value);setPage(1);}} style={{ ...SEL as any, width:150 }}><option value="">Todas as accoes</option><option value="message_sent">Mensagens</option><option value="profile_created">Perfis</option><option value="login">Sessoes</option><option value="campaign_created">Campanhas</option><option value="backup">Backups</option></select>
          <Btn variant="ghost" size="sm" onClick={load}>Actualizar</Btn>
        </div>
      </div>
      <Panel>
        {logs.length > 0 ? logs.map((log: any, i: number) => (
          <div key={log.id || i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<logs.length-1?'1px solid '+P.redDim:'none', alignItems:'flex-start' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.redB, fontSize:10, fontWeight:700, textTransform:'uppercase' }}>{log.action}</span>{log.ipAddress && <span style={{ color:P.textDim, fontSize:10 }}>{log.ipAddress}</span>}</div>
              {log.details && <div style={{ color:P.textSec, fontSize:11, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.details}</div>}
            </div>
            <span style={{ color:P.textDim, fontSize:10, flexShrink:0, marginLeft:10 }}>{fmtDt(log.createdAt)}</span>
          </div>
        )) : <EmptyState icon="\u231A" title="Sem registos" sub="A actividade sera registada aqui" />}
        {total > 50 && <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}><Btn variant="ghost" size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</Btn><span style={{ color:P.textSec, fontSize:12, alignSelf:'center' }}>Pagina {page} de {Math.ceil(total/50)}</span><Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/50)} onClick={()=>setPage(page+1)}>Proxima</Btn></div>}
      </Panel>
    </div>
  );
}

function ConfigTab({ onLogout }: { onLogout:()=>void }) {
  const [cookies, setCookies] = useState<any[]>([]);
  const [cookieEdits, setCookieEdits] = useState<Record<string,string>>({});
  const [backups, setBackups] = useState<any[]>([]);
  const [backupStatus, setBackupStatus] = useState('');
  const [loadingCookies, setLoadingCookies] = useState(false);
  const loadCookies = async () => {
    setLoadingCookies(true);
    const res = await mbaFetch('/api/cookies');
    if (res.ok) { const d = await res.json(); setCookies(d.cookies || []); }
    setLoadingCookies(false);
  };
  const saveCookies = async () => {
    await mbaFetch('/api/cookies', { method:'PATCH', body:JSON.stringify({ updates:cookieEdits }) });
    setCookieEdits({}); loadCookies();
  };
  const doBackup = async () => {
    setBackupStatus('A criar backup...');
    const res = await mbaFetch('/api/backup');
    if (res.ok) { const d = await res.json(); setBackupStatus('Backup criado: ' + d.backupName); loadBackups(); }
    else setBackupStatus('Erro ao criar backup');
  };
  const loadBackups = async () => {
    const res = await mbaFetch('/api/backup', { method:'POST', body:JSON.stringify({ action:'list' }) });
    if (res.ok) { const d = await res.json(); setBackups(d.backups || []); }
  };
  const restore = async (name: string) => {
    if (!confirm('Restaurar o backup ' + name + '? Isto substituira a base de dados actual.')) return;
    setBackupStatus('A restaurar...');
    const res = await mbaFetch('/api/backup', { method:'POST', body:JSON.stringify({ action:'restore', backupName:name }) });
    if (res.ok) setBackupStatus('Backup restaurado com sucesso. Recarregue a pagina.');
    else setBackupStatus('Erro ao restaurar');
  };
  useEffect(() => { loadCookies(); loadBackups(); }, []);
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Configuracao</STitle><Btn variant="danger" onClick={onLogout}>Terminar sessao</Btn></div>
      <Panel style={{ marginBottom:14 }}><STitle>Cookies de API</STitle>
        <Btn variant="ghost" size="sm" onClick={loadCookies} disabled={loadingCookies}>{loadingCookies?'A carregar...':'Recarregar cookies'}</Btn>
        <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>{cookies.map((c: any) => (
          <div key={c.key}>
            <Lbl>{c.label}</Lbl>
            <input value={cookieEdits[c.key] !== undefined ? cookieEdits[c.key] : (c.hasValue ? '[valor guardado]' : '')} onChange={e=>setCookieEdits({...cookieEdits, [c.key]:e.target.value})} placeholder={c.hasValue?'Deixe vazio para manter o valor actual':'Introduza o valor'} style={INP} />
          </div>
        ))}</div>
        {cookies.length > 0 && <Btn style={{ marginTop:10 }} onClick={saveCookies}>Guardar cookies</Btn>}
      </Panel>
      <Panel style={{ marginBottom:14 }}><STitle>Backup e Restauracao</STitle>
        <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
          <Btn onClick={doBackup}>Criar backup agora</Btn>
          {backupStatus && <span style={{ color:backupStatus.includes('Erro')?'#ff6b6b':P.green, fontSize:12 }}>{backupStatus}</span>}
        </div>
        {backups.length > 0 && <div style={{ display:'flex', flexDirection:'column', gap:6 }}>{backups.map((b: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid '+P.border }}>
            <div><span style={{ color:P.text, fontSize:12 }}>{b.name}</span><span style={{ color:P.textDim, fontSize:10, marginLeft:10 }}>{(b.size/1024).toFixed(1)} KB</span></div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ color:P.textDim, fontSize:10 }}>{b.date}</span><Btn size="sm" variant="ghost" onClick={()=>restore(b.name)}>Restaurar</Btn></div>
          </div>
        ))}</div>}
      </Panel>
      <Panel><STitle>Informacao do sistema</STitle>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:P.textSec, fontSize:12 }}>Versao</span><span style={{ color:P.text, fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>2.0.77</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:P.textSec, fontSize:12 }}>Motor</span><span style={{ color:P.text, fontSize:12 }}>Next.js + Bun + Prisma</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:P.textSec, fontSize:12 }}>Base de dados</span><span style={{ color:P.text, fontSize:12 }}>SQLite</span></div>
          <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:P.textSec, fontSize:12 }}>Limite diario</span><span style={{ color:P.text, fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>{LIMIT_DIARIO} mensagens</span></div>
        </div>
      </Panel>
    </div>
  );
}

export default function MBAApp() {
  const { isAuthenticated, sessionId, activeTab, setActiveTab, setAuthenticated, sessionRestored } = useMBAStore();
  const [dashData, setDashData] = useState<any>(null);
  const [clock, setClock] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const loadDash = useCallback(async () => {
    try { const res = await mbaFetch('/api/dashboard'); if (res.ok) setDashData(await res.json()); } catch {}
  }, []);
  const loadNotifs = useCallback(async () => {
    try { const res = await mbaFetch('/api/notifications'); if (res.ok) { const d = await res.json(); setNotifications(d.messages || []); setUnreadCount(d.unreadCount || 0); } } catch {}
  }, []);
  useEffect(() => {
 const sid = storeGet('mba_session');
    if (sid) { mbaFetch('/api/auth/check').then(r => { if (r.ok) setAuthenticated(true, sid); else { localStorage.removeItem('mba_session'); } }).catch(() => {}); }
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    loadDash(); loadNotifs();
    const iv = setInterval(() => { setClock(new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })); loadNotifs(); }, 30000);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [isAuthenticated, loadDash, loadNotifs]);
  const markNotifsRead = async () => {
    const ids = notifications.filter(n => !n.isRead).map(n => n.id);
    if (ids.length > 0) { await mbaFetch('/api/notifications', { method:'PATCH', body:JSON.stringify({ ids }) }); setUnreadCount(0); loadNotifs(); }
  };
  const doLogout = () => { localStorage.removeItem('mba_session'); setAuthenticated(false, null); };
  if (!isAuthenticated) return <LoginScreen />;
  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div className="mba-header-inner" style={{ height:48, borderBottom:'1px solid '+P.border, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0, background:P.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:900, color:P.red, letterSpacing:2 }}>MBA</div>
          <div style={{ width:1, height:20, background:P.border }} />
          <div style={{ color:P.textDim, fontSize:10, letterSpacing:2, textTransform:'uppercase' }} className="mba-hide-mobile">MWANGO BRAIN AGENT</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ position:'relative' }}>
            <button onClick={()=>{setShowNotifs(!showNotifs);if(!showNotifs)markNotifsRead();}} style={{ background:'none', border:'1px solid '+P.border, borderRadius:6, padding:'4px 8px', cursor:'pointer', color:P.textSec, fontSize:14, position:'relative' }}>{unreadCount > 0 && <div style={{ position:'absolute', top:-4, right:-4, width:16, height:16, borderRadius:8, background:P.red, color:'#fff', fontSize:9, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>{unreadCount > 9 ? '9+' : unreadCount}</div>}☆</button>
            {showNotifs && <div style={{ position:'absolute', top:36, right:0, width:320, background:P.surface, border:'1px solid '+P.border, borderRadius:8, padding:12, maxHeight:400, overflowY:'auto', zIndex:100 }}>
              <div style={{ color:P.text, fontSize:12, fontWeight:700, marginBottom:8 }}>Notificacoes</div>
              {notifications.length > 0 ? notifications.map((n: any, i: number) => (
                <div key={i} style={{ padding:'6px 0', borderBottom:i<notifications.length-1?'1px solid '+P.redDim:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ color:P.redB, fontSize:11, fontWeight:600 }}>{n.profile?.username || 'Sistema'}</span>{!n.isRead && <div style={{ width:5, height:5, borderRadius:'50%', background:P.red }} />}</div>
                  <div style={{ color:P.textSec, fontSize:11, marginTop:2 }}>{n.content}</div>
                  <div style={{ color:P.textDim, fontSize:9, marginTop:2 }}>{fmtDt(n.sentAt)}</div>
                </div>
              )) : <div style={{ color:P.textDim, fontSize:11, textAlign:'center', padding:16 }}>Sem notificacoes</div>}
            </div>}
          </div>
          <div style={{ color:P.textDim, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{clock}</div>
        </div>
      </div>
      <div className="mba-tabs" style={{ display:'flex', borderBottom:'1px solid '+P.border, overflowX:'auto', flexShrink:0, background:P.surface }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'10px 16px', border:'none', borderBottom:activeTab===t.id?'2px solid '+P.red:'2px solid transparent', background:'transparent', color:activeTab===t.id?P.redB:P.textDim, fontSize:11, fontWeight:activeTab===t.id?700:500, cursor:'pointer', whiteSpace:'nowrap', letterSpacing:'.5px', transition:'all .15s' }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        {activeTab === 'dashboard' && <DashboardTab dashData={dashData} onRefresh={loadDash} />}
        {activeTab === 'prospecting' && <ProspectingTab />}
        {activeTab === 'messages' && <MessagesTab />}
        {activeTab === 'followups' && <FollowUpsTab />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'agent' && <AgentChat />}
        {activeTab === 'campaigns' && <CampaignsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'activity' && <ActivityTab />}
        {activeTab === 'config' && <ConfigTab onLogout={doLogout} />}
      </div>
    </div>
  );
}
