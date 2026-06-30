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
  {id:'inbox',label:'INBOX'},{id:'agent',label:'AGENTE IA'},
];

// ==========================================
// LOCALSTORAGE DATA MANAGEMENT
// ==========================================
const LS_PROFILES = 'mba_profiles';
const LS_MESSAGES = 'mba_messages';
const LS_SENT_TODAY = 'mba_sent_today';
const LS_SENT_DATE = 'mba_sent_date';

const loadProfiles = (): any[] => { try { const d = localStorage.getItem(LS_PROFILES); return d ? JSON.parse(d) : []; } catch { return []; } };
const saveProfiles = (p: any[]) => { try { localStorage.setItem(LS_PROFILES, JSON.stringify(p)); } catch {} };
const loadMessages = (): any[] => { try { const d = localStorage.getItem(LS_MESSAGES); return d ? JSON.parse(d) : []; } catch { return []; } };
const saveMessages = (m: any[]) => { try { localStorage.setItem(LS_MESSAGES, JSON.stringify(m)); } catch {} };
const getSentToday = (): number => {
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem(LS_SENT_DATE);
  if (savedDate !== today) { localStorage.setItem(LS_SENT_DATE, today); localStorage.setItem(LS_SENT_TODAY, '0'); return 0; }
  return parseInt(localStorage.getItem(LS_SENT_TODAY) || '0');
};
const incrementSent = () => { const c = getSentToday() + 1; localStorage.setItem(LS_SENT_TODAY, String(c)); return c; };

const storeGet = (k:string, d:string='') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const storeSet = (k:string, v:string) => { try { localStorage.setItem(k, v); } catch {} };

const exportCSV = (profiles:any[])=>{if(!profiles.length)return;const h=['Username','Nome','Seguidores','A Seguir','Posts','Score','Estado','Categoria','Localizacao','Plataforma','URL','Verificado','Bot','Bio'];const rows=profiles.map(p=>[p.username||p.handle,p.displayName,p.followers,p.following,p.postsCount,(p.score||0).toFixed(1),p.status,p.category,p.location,p.platform,p.profileUrl,p.isVerified?'Sim':'Nao',p.isBot?'Sim':'Nao',(p.bio||'').substring(0,200).replace(/"/g,"'")]);const csv=[h,...rows].map(r=>r.map(v=>`"${String(v||'').replace(/"/g,"'")}"`).join(',')).join('\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`MBA_Prospeccao_${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);};
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

// ==========================================
// DASHBOARD - calculado a partir de localStorage
// ==========================================
function DashboardTab({ onRefresh }: { onRefresh:()=>void }) {
  const [dashData, setDashData] = useState<any>(null);
  const computeDash = () => {
    const profiles = loadProfiles();
    const messages = loadMessages();
    const today = new Date().toISOString().slice(0, 10);
    const contactedToday = profiles.filter(p => p.contactedAt?.slice(0,10) === today).length;
    const repliedToday = profiles.filter(p => p.repliedAt?.slice(0,10) === today).length;
    const acceptedToday = profiles.filter(p => p.acceptedAt?.slice(0,10) === today).length;
    const outboundMessages = messages.filter(m => m.direction === 'outbound').length;
    const inboundMessages = messages.filter(m => m.direction === 'inbound').length;

    const statusBreakdown: {status:string;count:number}[] = [];
    const statusMap: Record<string,number> = {};
    profiles.forEach(p => { statusMap[p.status] = (statusMap[p.status]||0) + 1; });
    Object.entries(statusMap).forEach(([status,count]) => statusBreakdown.push({status,count}));

    const platformBreakdown: {platform:string;count:number}[] = [];
    const platMap: Record<string,number> = {};
    profiles.forEach(p => { platMap[p.platform] = (platMap[p.platform]||0) + 1; });
    Object.entries(platMap).forEach(([platform,count]) => platformBreakdown.push({platform,count}));

    const topProfiles = [...profiles].sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 10);

    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(); date.setDate(date.getDate() - i);
      const ds = date.toISOString().slice(0, 10);
      const dayName = date.toLocaleDateString('pt-PT', { weekday: 'short' });
      dailyStats.push({
        date: ds, dayName,
        contacted: profiles.filter(p => p.contactedAt?.slice(0,10) === ds).length,
        replied: profiles.filter(p => p.repliedAt?.slice(0,10) === ds).length,
        accepted: profiles.filter(p => p.acceptedAt?.slice(0,10) === ds).length,
      });
    }

    setDashData({
      overview: {
        totalProfiles: profiles.length, contactedToday, repliedToday, acceptedToday,
        totalCampaigns: 1, outboundMessages, inboundMessages,
        responseRate: outboundMessages > 0 ? Math.round((inboundMessages / outboundMessages) * 100) : 0,
      },
      statusBreakdown, platformBreakdown, dailyStats, topProfiles,
    });
  };
  useEffect(() => { computeDash(); }, []);
  useEffect(() => { onRefresh && onRefresh(); }, [onRefresh]);

  if (!dashData) return <div style={{ padding:16 }}><Panel><EmptyState icon="\u25CE" title="A carregar..." sub="" /></Panel></div>;
  const d = dashData;
  const o = d.overview || {};
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <STitle>Painel Geral</STitle>
        <Btn variant="ghost" size="sm" onClick={computeDash}>Actualizar</Btn>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={o.totalProfiles||0} sub="guardados localmente" />
        <StatCard label="Contactados hoje" value={o.contactedToday||0} sub="ultimas 24h" color={P.orange} />
        <StatCard label="Respostas hoje" value={o.repliedToday||0} sub="ultimas 24h" color={P.green} />
        <StatCard label="Taxa de resposta" value={(o.responseRate||0).toFixed(1)+'%'} sub={(o.outboundMessages||0)+' enviadas / '+(o.inboundMessages||0)+' recebidas'} color={P.blue} />
        <StatCard label="DMs hoje" value={getSentToday()+'/'+LIMIT_DIARIO} sub="limite diario" color={P.orange} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade ultimos 7 dias</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{(d.dailyStats || []).map((ds: any, i: number) => {
            const maxC = Math.max(...(d.dailyStats||[]).map((x:any)=>x.contacted),1);
            const maxR = Math.max(...(d.dailyStats||[]).map((x:any)=>x.replied),1);
            return <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ color:P.textSec, fontSize:11 }}>{ds.dayName} {ds.date?.slice(5)}</span>
                <span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{ds.contacted}c / {ds.replied}r / {ds.accepted}a</span>
              </div>
              <div style={{ display:'flex', gap:3 }}>
                <div style={{ flex:2 }}><BarComp value={ds.contacted} max={maxC} color={P.orange} h={6} /></div>
                <div style={{ flex:2 }}><BarComp value={ds.replied} max={maxR} color={P.green} h={6} /></div>
              </div>
            </div>;
          })}</div>
        </Panel>
        <Panel><STitle>Por Plataforma</STitle>
          {(d.platformBreakdown || []).length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{d.platformBreakdown.map((p: any, i: number) => {
            const colors = [P.red, P.orange, P.blue, P.green];
            const maxP = Math.max(...d.platformBreakdown.map((x:any)=>x.count),1);
            return <div key={i}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span>
                <span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.count}</span>
              </div>
              <BarComp value={p.count} max={maxP} color={colors[i%4]} h={8} />
            </div>;
          })}</div> : <EmptyState icon="\u25CE" title="Sem dados" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(d.statusBreakdown || []).map((s: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:2, background:statusColors[s.status]||P.textDim }} />
                <span style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{statusLabels[s.status]||s.status}</span>
              </div>
              <span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s.count}</span>
            </div>
          ))}</div>
        </Panel>
        <Panel><STitle>Top 10 Perfis</STitle>
          {(d.topProfiles || []).length > 0 ? d.topProfiles.map((p: any, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:i<9?'1px solid '+P.border:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:P.textDim, fontSize:10, width:18, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}.</span>
                <span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{p.username}</span>
                <span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span>
              </div>
              <span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{(p.followers||0).toLocaleString('pt-PT')}</span>
            </div>
          )) : <EmptyState icon="\u25CE" title="Sem perfis" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
    </div>
  );
}

// ==========================================
// PROFILE DETAIL MODAL
// ==========================================
function ProfileDetailModal({ profile, onClose, onUpdate }: { profile: any; onClose:()=>void; onUpdate:()=>void }) {
  const [notes, setNotes] = useState(profile?.notes || '');
  const [status, setStatus] = useState(profile?.status || 'prospect');
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  if (!profile) return null;

  const saveNotes = () => {
    const profiles = loadProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx].notes = notes;
      profiles[idx].status = status;
      if (status === 'contacted' && !profiles[idx].contactedAt) profiles[idx].contactedAt = new Date().toISOString();
      if (status === 'replied' && !profiles[idx].repliedAt) profiles[idx].repliedAt = new Date().toISOString();
      if (status === 'accepted' && !profiles[idx].acceptedAt) profiles[idx].acceptedAt = new Date().toISOString();
      saveProfiles(profiles);
      onUpdate();
    }
  };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    setSending(true); setSendResult('');
    try {
      const res = await mbaFetch('/api/send-message', {
        method:'POST',
        body: JSON.stringify({ username:profile.username, message:msg, platform:profile.platform, sentToday:getSentToday() }),
      });
      const d = await res.json();
      incrementSent();
      // Guardar mensagem localmente
      const allMsgs = loadMessages();
      allMsgs.push({ id: Date.now().toString(36), profileId:profile.id, username:profile.username, platform:profile.platform, direction:'outbound', content:msg, sentAt:new Date().toISOString(), dmSent:d.dmSent||false });
      saveMessages(allMsgs);
      // Actualizar perfil
      const profiles = loadProfiles();
      const idx = profiles.findIndex(p => p.id === profile.id);
      if (idx >= 0) {
        profiles[idx].status = 'contacted';
        profiles[idx].contactedAt = new Date().toISOString();
        saveProfiles(profiles);
      }
      setSendResult(d.dmSent ? `DM enviado para @${profile.username}!` : (d.error || 'Mensagem processada'));
      setMsg(''); onUpdate();
    } catch { setSendResult('Erro de ligacao'); }
    setSending(false);
  };

  const blacklist = () => {
    const profiles = loadProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx].status = 'blacklisted';
      saveProfiles(profiles);
      onUpdate(); onClose();
    }
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
        {sendResult && <div style={{ padding:'8px 12px', marginBottom:10, borderRadius:6, border:'1px solid '+(sendResult.includes('enviado')?P.green:P.orange), background:sendResult.includes('enviado')?'rgba(0,192,99,0.08)':'rgba(224,96,0,0.08)', color:sendResult.includes('enviado')?P.green:P.orange, fontSize:12, fontWeight:600 }}>{sendResult}</div>}
        <div style={{ borderTop:'1px solid '+P.border, paddingTop:14 }}>
          <Lbl>Enviar mensagem</Lbl>
          <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3} placeholder="Escreva a mensagem..." style={{ ...INP, resize:'vertical', marginBottom:8 }} />
          <Btn onClick={sendMessage} disabled={sending || !msg.trim()}>{sending ? 'A enviar...' : 'Enviar'}</Btn>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PROSPECTING TAB - localStorage
// ==========================================
function ProspectingTab({ refreshDash }: { refreshDash:()=>void }) {
  const [form, setForm] = useState({ platform:'instagram', minFollowers:1000, maxFollowers:50000, minMonthsActive:12, requireRegular:true, targetCount:50, campaignName:'', maxPerDay:LIMIT_DIARIO, keywords:'', location:'Angola' });
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterPlat, setFilterPlat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [detailProfile, setDetailProfile] = useState<any>(null);
  const [prospectMsg, setProspectMsg] = useState('');
  const [prospectStatus, setProspectStatus] = useState('');
  const PER_PAGE = 50;

  // Load profiles from localStorage on mount
  useEffect(() => {
    setProfiles(loadProfiles());
  }, []);

  const reloadProfiles = () => {
    setProfiles(loadProfiles());
  };

  const runProspect = async () => {
    setLoading(true); setProspectStatus('starting'); setProspectMsg('A iniciar prospeccao directa...');
    try {
      const res = await mbaFetch('/api/prospect', { method:'POST', body:JSON.stringify(form) });
      const d = await res.json();
      if (d.success && d.profiles && d.profiles.length > 0) {
        // Guardar novos perfis no localStorage
        const existing = loadProfiles();
        const existingIds = new Set(existing.map(p => p.username + ':' + p.platform));
        const newProfiles = d.profiles.filter((p: any) => !existingIds.has(p.username + ':' + p.platform));
        const allProfiles = [...existing, ...newProfiles];
        saveProfiles(allProfiles);
        setProfiles(allProfiles);
        setProspectStatus('completed');
        setProspectMsg(`${d.profilesFound} perfis encontrados! ${newProfiles.length} novos adicionados. Total: ${allProfiles.length}`);
        setPage(1);
        refreshDash();
      } else {
        setProspectStatus('error');
        setProspectMsg(d.message || d.error || 'Nenhum perfil encontrado. Tenta alargar os filtros.');
      }
      setLoading(false);
    } catch { setProspectStatus('error'); setProspectMsg('Erro de ligacao.'); setLoading(false); }
  };

  const toggleAll = () => {
    const filtered = getFiltered();
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  };

  const bulkMessage = async () => {
    if (!selected.size) return;
    let sent = 0;
    const profs = profiles.filter(p => selected.has(p.id));
    for (const p of profs) {
      if (getSentToday() >= LIMIT_DIARIO) break;
      try {
        const res = await mbaFetch('/api/send-message', {
          method:'POST',
          body: JSON.stringify({ username:p.username, message:PROPOSTA, platform:p.platform, sentToday:getSentToday() }),
        });
        const d = await res.json();
        incrementSent();
        const allMsgs = loadMessages();
        allMsgs.push({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,5), profileId:p.id, username:p.username, platform:p.platform, direction:'outbound', content:PROPOSTA, sentAt:new Date().toISOString(), dmSent:d.dmSent||false });
        saveMessages(allMsgs);
        // Update profile status
        p.status = 'contacted'; p.contactedAt = new Date().toISOString();
        sent++;
      } catch {}
      await new Promise(r => setTimeout(r, 2000)); // 2s entre envios
    }
    saveProfiles(profiles);
    setSelected(new Set()); reloadProfiles(); refreshDash();
    alert(`${sent} mensagens enviadas!`);
  };

  const bulkBlacklist = () => {
    const profs = loadProfiles();
    profs.forEach(p => { if (selected.has(p.id)) p.status = 'blacklisted'; });
    saveProfiles(profs); setSelected(new Set()); reloadProfiles(); refreshDash();
  };

  const getFiltered = () => {
    return profiles.filter(p => {
      if (filterPlat !== 'all' && p.platform !== filterPlat) return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(p.username||'').toLowerCase().includes(s) && !(p.displayName||'').toLowerCase().includes(s) && !(p.bio||'').toLowerCase().includes(s)) return false;
      }
      return true;
    });
  };

  const filtered = getFiltered();
  const total = filtered.length;
  const paginated = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <Panel style={{ marginBottom:14 }}>
        <STitle>Nova Prospeccao</STitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})} style={SEL as any}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option><option value="all">Todas</option></select></div>
          <div><Lbl>Nome da campanha</Lbl><input value={form.campaignName} onChange={e=>setForm({...form,campaignName:e.target.value})} placeholder="Ex: Restaurantes Luanda" style={INP} /></div>
          <div><Lbl>Min. Seguidores</Lbl><input type="number" value={form.minFollowers} onChange={e=>setForm({...form,minFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max. Seguidores</Lbl><input type="number" value={form.maxFollowers} onChange={e=>setForm({...form,maxFollowers:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Alvo</Lbl><input type="number" value={form.targetCount} onChange={e=>setForm({...form,targetCount:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Max/dia</Lbl><input type="number" value={form.maxPerDay} onChange={e=>setForm({...form,maxPerDay:Number(e.target.value)})} style={INP} /></div>
          <div><Lbl>Palavras-chave</Lbl><input value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})} placeholder="restaurante, hotel, cafe" style={INP} /></div>
          <div><Lbl>Localizacao</Lbl><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} style={INP} /></div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}><Toggle on={form.requireRegular} onChange={v=>setForm({...form,requireRegular:v})} /><span style={{ color:P.textSec, fontSize:12 }}>Exigir contas regulares</span></div>
        <Btn onClick={runProspect} disabled={loading}>{loading ? 'A prospectar...' : 'Iniciar Prospeccao'}</Btn>
      </Panel>
      {prospectStatus === 'completed' && <Panel style={{ marginBottom:14, borderLeft:'3px solid '+P.green }}><div style={{ color:P.green, fontSize:13, fontWeight:600 }}>Prospeccao concluida!</div><div style={{ color:P.textSec, fontSize:12, marginTop:2 }}>{prospectMsg}</div></Panel>}
      {prospectStatus === 'error' && <Panel style={{ marginBottom:14, borderLeft:'3px solid #ff6b6b' }}><div style={{ color:'#ff6b6b', fontSize:13, fontWeight:600 }}>Erro</div><div style={{ color:P.textSec, fontSize:12, marginTop:2 }}>{prospectMsg}</div></Panel>}
      <Panel>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <STitle>Perfis ({total})</STitle>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Pesquisar..." style={{ ...INP, width:140 }} />
            <select value={filterPlat} onChange={e=>{setFilterPlat(e.target.value);setPage(1);}} style={{ ...SEL as any, width:100 }}><option value="all">Todas</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option></select>
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}} style={{ ...SEL as any, width:110 }}><option value="all">Todos estados</option><option value="prospect">Prospecto</option><option value="contacted">Contactado</option><option value="replied">Respondeu</option><option value="accepted">Aceite</option></select>
            <Btn variant="ghost" size="sm" onClick={()=>exportCSV(filtered)}>Exportar CSV</Btn>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
          <button onClick={toggleAll} style={{ padding:'4px 10px', borderRadius:4, border:'1px solid '+P.border, background:selected.size>0?P.redDim:'transparent', color:selected.size>0?P.redB:P.textSec, fontSize:11, cursor:'pointer' }}>{selected.size===filtered.length&&filtered.length>0?'Desselecionar':'Selecionar todos'}</button>
          {selected.size > 0 && <><Btn size="sm" onClick={bulkMessage}>Enviar ({selected.size})</Btn><Btn size="sm" variant="danger" onClick={bulkBlacklist}>Blacklist ({selected.size})</Btn></>}
        </div>
        <div style={{ overflowX:'auto' }}>
          <div style={{ minWidth:600 }}>
            <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.border, color:P.textDim, fontSize:10, fontWeight:600, letterSpacing:'.5px' }}>
              <div style={{ width:30 }}><input type="checkbox" checked={selected.size===filtered.length && filtered.length>0} onChange={toggleAll} /></div>
              <div style={{ flex:2 }}>HANDLE</div><div style={{ flex:2 }}>NOME</div>
              <div style={{ width:80, textAlign:'right' }}>SEGUIDORES</div><div style={{ width:60, textAlign:'right' }}>SCORE</div>
              <div style={{ width:90 }}>PLATAFORMA</div><div style={{ width:90 }}>ESTADO</div><div style={{ width:50 }}></div>
            </div>
            {paginated.map((p: any) => (
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
        {total > PER_PAGE && <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}>
          <Btn variant="ghost" size="sm" disabled={page<=1} onClick={()=>setPage(page-1)}>Anterior</Btn>
          <span style={{ color:P.textSec, fontSize:12, alignSelf:'center' }}>Pagina {page} de {Math.ceil(total/PER_PAGE)}</span>
          <Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/PER_PAGE)} onClick={()=>setPage(page+1)}>Proxima</Btn>
        </div>}
      </Panel>
      {detailProfile && <ProfileDetailModal profile={detailProfile} onClose={()=>{setDetailProfile(null);reloadProfiles();}} onUpdate={()=>{reloadProfiles();refreshDash();}} />}
    </div>
  );
}

// ==========================================
// MESSAGES TAB - localStorage
// ==========================================
function MessagesTab({ refreshDash }: { refreshDash:()=>void }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selProfile, setSelProfile] = useState('');
  const [msgText, setMsgText] = useState(PROPOSTA);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState('');
  const [subtab, setSubtab] = useState<'all'|'outbound'|'inbound'>('all');

  useEffect(() => {
    setProfiles(loadProfiles());
    setMessages(loadMessages());
  }, []);

  const sendMessage = async () => {
    if (!selProfile || !msgText.trim()) return;
    setSending(true); setSendResult('');
    const prof = profiles.find(p => p.id === selProfile);
    if (!prof) { setSending(false); return; }
    try {
      const res = await mbaFetch('/api/send-message', {
        method:'POST',
        body: JSON.stringify({ username:prof.username, message:msgText, platform:prof.platform, sentToday:getSentToday() }),
      });
      const d = await res.json();
      incrementSent();
      const allMsgs = loadMessages();
      allMsgs.push({ id:Date.now().toString(36), profileId:prof.id, username:prof.username, platform:prof.platform, direction:'outbound', content:msgText, sentAt:new Date().toISOString(), dmSent:d.dmSent||false });
      saveMessages(allMsgs);
      // Update profile status
      const allProfiles = loadProfiles();
      const idx = allProfiles.findIndex(p => p.id === prof.id);
      if (idx >= 0) { allProfiles[idx].status = 'contacted'; allProfiles[idx].contactedAt = new Date().toISOString(); saveProfiles(allProfiles); setProfiles(allProfiles); }
      setMessages(loadMessages());
      setSendResult(d.dmSent ? `DM enviado com sucesso para @${prof.username} (${prof.platform})!` : (d.error || 'Mensagem processada'));
    } catch { setSendResult('Erro de ligacao'); }
    setSending(false); refreshDash();
  };

  const filtered = messages.filter(m => subtab === 'all' || m.direction === subtab).sort((a,b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {[['all','Todas'],['outbound','Enviadas'],['inbound','Recebidas']].map(([k,l]) => (
          <button key={k} onClick={()=>setSubtab(k as any)} style={{ padding:'6px 14px', borderRadius:4, border:'1px solid '+(subtab===k?P.red:P.border), background:subtab===k?P.redDim:'transparent', color:subtab===k?P.redB:P.textSec, fontSize:11, cursor:'pointer', fontWeight:600 }}>{l} ({k==='all'?filtered.length:messages.filter(m=>m.direction===k).length})</button>
        ))}
      </div>
      {sendResult && <div style={{ padding:'8px 12px', marginBottom:10, borderRadius:6, border:'1px solid '+(sendResult.includes('sucesso')||sendResult.includes('enviado')?P.green:P.orange), background:(sendResult.includes('sucesso')||sendResult.includes('enviado'))?'rgba(0,192,99,0.08)':'rgba(224,96,0,0.08)', color:(sendResult.includes('sucesso')||sendResult.includes('enviado'))?P.green:P.orange, fontSize:12, fontWeight:600 }}>{sendResult}</div>}
      <Panel style={{ marginBottom:14 }}>
        <STitle>Enviar Mensagem</STitle>
        <div style={{ marginBottom:10 }}>
          <Lbl>Perfil</Lbl>
          <select value={selProfile} onChange={e=>setSelProfile(e.target.value)} style={SEL as any}>
            <option value="">Seleccionar perfil...</option>
            {profiles.filter(p=>p.status!=='blacklisted').map((p: any) => <option key={p.id} value={p.id}>{p.username} ({p.platform}) {p.followers ? '- ' + p.followers + ' seg' : ''}</option>)}
          </select>
        </div>
        <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} rows={4} style={{ ...INP, resize:'vertical', marginBottom:8 }} />
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <Btn onClick={sendMessage} disabled={sending || !selProfile}>{sending ? 'A enviar...' : 'Enviar agora'}</Btn>
          <span style={{ color:P.textDim, fontSize:11 }}>Enviados hoje: {getSentToday()}/{LIMIT_DIARIO}</span>
        </div>
      </Panel>
      <Panel><STitle>Historico ({filtered.length})</STitle>
        {filtered.length > 0 ? filtered.slice(0,100).map((m: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:i<99?'1px solid '+P.redDim:'none', alignItems:'center' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ color:m.direction==='outbound'?P.orange:P.green, fontSize:10, fontWeight:700 }}>{m.direction==='outbound'?'OUT':'IN'}</span>
                <span style={{ color:P.redB, fontSize:11, fontWeight:600 }}>{m.username}</span>
                <span style={{ color:P.textDim, fontSize:10 }}>{m.platform}</span>
              </div>
              <div style={{ color:P.textSec, fontSize:11, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.content}</div>
            </div>
            <span style={{ color:P.textDim, fontSize:10, marginLeft:10, flexShrink:0 }}>{fmtDt(m.sentAt)}</span>
          </div>
        )) : <EmptyState icon="\u2709" title="Sem mensagens" sub="As mensagens aparecerao aqui" />}
      </Panel>
    </div>
  );
}

// ==========================================
// INBOX TAB - localStorage
// ==========================================
function InboxTab() {
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => { setMessages(loadMessages().filter(m => m.direction === 'inbound').sort((a,b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())); }, []);
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <STitle>Inbox ({messages.length} mensagens recebidas)</STitle>
      <Panel>
        {messages.length > 0 ? messages.map((m: any, i: number) => (
          <div key={i} style={{ padding:'10px 0', borderBottom:i<messages.length-1?'1px solid '+P.redDim:'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ color:P.green, fontSize:10, fontWeight:700 }}>IN</span>
              <span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{m.username||'Desconhecido'}</span>
              <span style={{ color:P.textDim, fontSize:10 }}>{m.platform||''}</span>
            </div>
            <div style={{ color:P.textSec, fontSize:12 }}>{m.content}</div>
            <div style={{ color:P.textDim, fontSize:10, marginTop:4 }}>{fmtDt(m.sentAt)}</div>
          </div>
        )) : <EmptyState icon="\u2606" title="Inbox vazio" sub="As mensagens recebidas aparecerao aqui" />}
      </Panel>
    </div>
  );
}

// ==========================================
// AGENT CHAT
// ==========================================
function AgentChat() {
  const [chatHistory, setChatHistory] = useState<{role:string; content:string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [chatHistory]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setChatHistory(h => [...h, { role:'user', content:userMsg }]);
    setLoading(true);
    try {
      const res = await mbaFetch('/api/respond', { method:'POST', body:JSON.stringify({ message: userMsg, conversationHistory: chatHistory.slice(-10) }) });
      if (res.ok) { const d = await res.json(); setChatHistory(h => [...h, { role:'assistant', content:d.reply }]); }
      else { setChatHistory(h => [...h, { role:'assistant', content:'Erro ao gerar resposta.' }]); }
    } catch { setChatHistory(h => [...h, { role:'assistant', content:'Erro de ligacao.' }]); }
    setLoading(false);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid '+P.border }}><STitle>Agente IA</STitle></div>
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

// ==========================================
// MAIN APP
// ==========================================
export default function MBAApp() {
  const { isAuthenticated, activeTab, setActiveTab, setAuthenticated } = useMBAStore();
  const [clock, setClock] = useState('');
  const [dashKey, setDashKey] = useState(0);
  const refreshDash = () => setDashKey(k => k + 1);

  useEffect(() => {
    const sid = storeGet('mba_session');
    if (sid) { mbaFetch('/api/auth/check').then(r => { if (r.ok) setAuthenticated(true, sid); else { localStorage.removeItem('mba_session'); } }).catch(() => {}); }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000);
    return () => clearInterval(tick);
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginScreen />;
  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:48, borderBottom:'1px solid '+P.border, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0, background:P.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:900, color:P.red, letterSpacing:2 }}>MBA</div>
          <div style={{ width:1, height:20, background:P.border }} />
          <div style={{ color:P.textDim, fontSize:10, letterSpacing:2, textTransform:'uppercase' }}>MWANGO BRAIN AGENT</div>
        </div>
        <div style={{ color:P.textDim, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{clock}</div>
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid '+P.border, overflowX:'auto', flexShrink:0, background:P.surface }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'10px 16px', border:'none', borderBottom:activeTab===t.id?'2px solid '+P.red:'2px solid transparent', background:'transparent', color:activeTab===t.id?P.redB:P.textDim, fontSize:11, fontWeight:activeTab===t.id?700:500, cursor:'pointer', whiteSpace:'nowrap', letterSpacing:'.5px', transition:'all .15s' }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        {activeTab === 'dashboard' && <DashboardTab key={dashKey} onRefresh={refreshDash} />}
        {activeTab === 'prospecting' && <ProspectingTab refreshDash={refreshDash} />}
        {activeTab === 'messages' && <MessagesTab refreshDash={refreshDash} />}
        {activeTab === 'inbox' && <InboxTab />}
        {activeTab === 'agent' && <AgentChat />}
      </div>
    </div>
  );
}
