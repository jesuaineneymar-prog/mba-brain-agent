'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMBAStore } from '@/store/mba-store';

const storeGet = function(k: string, d?: string) { if (d === undefined) d = ''; if (typeof window !== 'undefined' && window.localStorage) { var v = window.localStorage.getItem(k); if (v) return v; } return d; };
const storeSet = function(k: string, v: string) { if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.setItem(k, v); } };

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
const FOLLOWUP_MSG_1 = 'Ola,\n\nEnviei-lhe uma mensagem ha alguns dias sobre uma proposta da Mwango Brain. Gostaria de saber se teve a oportunidade de a considerar.\n\nCaso tenha interesse, basta responder a esta mensagem.\n\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';
const FOLLOWUP_MSG_2 = 'Ola,\n\nEsta e a minha ultima mensagem. Entendo que pode nao ter interesse ou nao ter tido tempo.\n\nCaso mude de ideia, a Mwango Brain continua disponivel. Basta responder.\n\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';
const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECCAO'},{id:'messages',label:'MENSAGENS'},{id:'followups',label:'FOLLOW-UPS'},{id:'agent',label:'AGENTE IA'},
];
const statusColors: Record<string, string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b', blacklisted: '#666' };
const statusLabels: Record<string, string> = { prospect:'Prospecto', contacted:'Contactado', replied:'Respondeu', accepted:'Aceite', rejected:'Rejeitado', blacklisted:'Blacklist' };
const fmtDt = function(d: string) { var dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); };

/* ===== PLATFORM CONSTANTS ===== */
var ALL_PLATFORMS = ['instagram', 'tiktok', 'facebook'];
var PLAT_ICONS: Record<string,string> = { instagram: '📸', tiktok: '🎵', facebook: '👤' };
var PLAT_NAMES: Record<string,string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };

function getProfiles(): any[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  var raw = window.localStorage.getItem('mba_profiles') || '[]';
  if (!raw || raw.charAt(0) !== '[') return [];
  return JSON.parse(raw);
}
function saveProfiles(profiles: any[]) {
  if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.setItem('mba_profiles', JSON.stringify(profiles)); }
}
function getStoredCredentials() {
  return {
    igSession: storeGet('mba_ig_session') || '',
    igCsrf: storeGet('mba_ig_csrf') || '',
    ttSession: storeGet('mba_tt_session') || '',
    ttCsrf: storeGet('mba_tt_csrf') || ''
  };
}

/* ===== AUTOMATION CONFIG (3 plataformas) ===== */
function getAutoConfig() {
  try {
    var raw = storeGet('mba_auto_config', '');
    if (raw) {
      var parsed = JSON.parse(raw);
      // Ensure all 3 platforms exist
      if (!parsed.platforms) parsed.platforms = {};
      for (var i = 0; i < ALL_PLATFORMS.length; i++) {
        var pf = ALL_PLATFORMS[i];
        if (!parsed.platforms[pf]) parsed.platforms[pf] = { username: '', password: '', enabled: false };
      }
      return parsed;
    }
  } catch(e) {}
  return {
    enabled: false,
    platforms: {
      instagram: { username: '', password: '', enabled: false },
      tiktok: { username: '', password: '', enabled: false },
      facebook: { username: '', password: '', enabled: false }
    }
  };
}
function saveAutoConfig(cfg: any) { storeSet('mba_auto_config', JSON.stringify(cfg)); }
function setAutoTrigger() { storeSet('mba_auto_trigger', JSON.stringify({ ts: Date.now() })); }
function consumeAutoTrigger(): boolean {
  try {
    var raw = storeGet('mba_auto_trigger', '');
    if (!raw) return false;
    var d = JSON.parse(raw);
    if (Date.now() - d.ts > 60000) { storeSet('mba_auto_trigger', ''); return false; }
    storeSet('mba_auto_trigger', '');
    return true;
  } catch(e) { return false; }
}

function computeDashboard() {
  var profiles = getProfiles();
  var today = new Date().toISOString().slice(0, 10);
  var totalProfiles = profiles.length;
  var contactedToday = 0; var repliedToday = 0;
  var outboundMessages = 0; var inboundMessages = 0;
  var statusBreakdown: any[] = []; var platformBreakdown: any[] = [];
  var topProfiles: any[] = []; var dailyStats: any[] = []; var pendingFollowUps = 0;
  var statusCounts: Record<string, number> = {};
  var platCounts: Record<string, number> = {};
  var dayMap: Record<string, {contacted:number; replied:number; accepted:number}> = {};
  var now = Date.now(); var threeDays = 3 * 24 * 60 * 60 * 1000;
  var dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i]; var st = p.status || 'prospect';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    var pl = p.platform || 'unknown'; platCounts[pl] = (platCounts[pl] || 0) + 1;
    if (p.firstContactedAt && p.firstContactedAt.slice(0, 10) === today) contactedToday++;
    var hasReply = false; var msgs = p.messages || [];
    for (var j = 0; j < msgs.length; j++) {
      var m = msgs[j];
      if (m.direction === 'outbound') {
        outboundMessages++; var mDay = (m.sentAt || '').slice(0, 10);
        if (!dayMap[mDay]) dayMap[mDay] = {contacted:0, replied:0, accepted:0};
        if (m.type === 'initial' || m.type === 'follow-up' || m.type === 'auto') dayMap[mDay].contacted++;
      }
      if (m.direction === 'inbound') {
        inboundMessages++; hasReply = true; var mDay2 = (m.sentAt || '').slice(0, 10);
        if (mDay2 === today) repliedToday++;
        if (!dayMap[mDay2]) dayMap[mDay2] = {contacted:0, replied:0, accepted:0};
        dayMap[mDay2].replied++;
      }
    }
    if (hasReply && st !== 'replied' && st !== 'accepted') st = 'replied';
    var followUpCount = 0;
    for (var fu = 0; fu < msgs.length; fu++) { if (msgs[fu].type === 'follow-up') followUpCount++; }
    var lastOut = null;
    for (var k = msgs.length - 1; k >= 0; k--) { if (msgs[k].direction === 'outbound' && msgs[k].type !== 'follow-up') { lastOut = msgs[k]; break; } }
    if (lastOut && followUpCount < 2) {
      var sentTime = new Date(lastOut.sentAt).getTime(); var hasReplyAfter = false;
      for (var mm = 0; mm < msgs.length; mm++) { if (msgs[mm].direction === 'inbound' && new Date(msgs[mm].sentAt).getTime() > sentTime) { hasReplyAfter = true; break; } }
      if (!hasReplyAfter && (now - sentTime) > threeDays) pendingFollowUps++;
    }
  }
  for (var sk in statusCounts) statusBreakdown.push({status: sk, count: statusCounts[sk]});
  for (var pk in platCounts) platformBreakdown.push({platform: pk, count: platCounts[pk]});
  var sorted = profiles.slice().sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });
  for (var ti = 0; ti < Math.min(10, sorted.length); ti++) topProfiles.push(sorted[ti]);
  for (var di = 6; di >= 0; di--) {
    var d2 = new Date(now - di * 86400000); var dk = d2.toISOString().slice(0, 10);
    var dd = dayMap[dk] || {contacted:0, replied:0, accepted:0};
    dailyStats.push({date: dk, dayName: dayNames[d2.getDay()], contacted: dd.contacted, replied: dd.replied, accepted: dd.accepted});
  }
  var responseRate = outboundMessages > 0 ? ((inboundMessages / outboundMessages) * 100) : 0;
  return { overview: { totalProfiles, contactedToday, repliedToday, totalCampaigns:0, outboundMessages, inboundMessages, responseRate }, statusBreakdown, platformBreakdown, topProfiles, dailyStats, pendingFollowUps };
}

/* ===== UI COMPONENTS ===== */
function Sphere({ size = 240, speed = 1 }: { size?: number; speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null), raf = useRef<number>(0);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d'); const DPR = window.devicePixelRatio || 2;
    cv.width = size * DPR; cv.height = size * DPR; ctx.scale(DPR, DPR);
    const cx = size/2, cy = size/2, R = size * 0.36;
    const pts = Array.from({ length: 240 }, function() {
      const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      return { ox: Math.sin(p)*Math.cos(t), oy: Math.sin(p)*Math.sin(t), oz: Math.cos(p), sz: Math.random()*1.8+0.3, hot: Math.random()<0.05 };
    });
    const TX = 0.28, cosX = Math.cos(TX), sinX = Math.sin(TX); let rot = 0;
    function draw() {
      ctx.clearRect(0, 0, size, size); rot += 0.004 * speed;
      const pulse = 1 + Math.sin(Date.now()/950) * 0.025;
      const cosY = Math.cos(rot), sinY = Math.sin(rot);
      const proj = pts.map(function(pt) {
        const x1 = pt.ox*cosY + pt.oz*sinY, y1 = pt.oy, z1 = -pt.ox*sinY + pt.oz*cosY;
        const y2 = y1*cosX - z1*sinX, z2 = y1*sinX + z1*cosX;
        const d = (z2+1.4)/2.4;
        return { sx: cx+x1*R*pulse, sy: cy+y2*R*pulse, z: z2, a: Math.max(0.04, d*0.9), sz: pt.sz*(0.4+d*0.75), hot: pt.hot };
      });
      proj.sort(function(a,b) { return a.z - b.z; });
      const amb = ctx.createRadialGradient(cx, cy, R*0.1, cx, cy, R*1.8);
      amb.addColorStop(0, 'rgba(192,0,28,0.14)'); amb.addColorStop(0.5, 'rgba(192,0,28,0.05)'); amb.addColorStop(1, 'transparent');
      ctx.fillStyle = amb; ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < proj.length; i++) for (let j = i+1; j < proj.length; j++) {
        const dx = proj[i].sx-proj[j].sx, dy = proj[i].sy-proj[j].sy, dist = Math.sqrt(dx*dx+dy*dy), th = size*0.12;
        if (dist < th) { ctx.strokeStyle = 'rgba(192,0,28,'+((1-dist/th)*0.5*Math.min(proj[i].a,proj[j].a))+')'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(proj[i].sx, proj[i].sy); ctx.lineTo(proj[j].sx, proj[j].sy); ctx.stroke(); }
      }
      proj.forEach(function(p) {
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
    draw(); return function() { cancelAnimationFrame(raf.current); };
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
function StatCard({ label, value, sub, color = P.red }: { label:string; value:string|number; sub?:string; color?:string }) {
  return <Panel style={{ flex:1, minWidth:120 }}><Lbl>{label}</Lbl><div style={{ color, fontSize:24, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{value}</div>{sub && <div style={{ color:P.textSec, fontSize:10, marginTop:4 }}>{sub}</div>}</Panel>;
}
function Btn({ children, onClick, disabled, variant = 'primary', size = 'md', style: extraStyle = {} }: { children:React.ReactNode; onClick?:()=>void; disabled?:boolean; variant?:string; size?:string; style?: React.CSSProperties }) {
  const pad = size==='sm'?'5px 12px':size==='lg'?'13px 28px':'9px 18px';
  const fs = size==='sm'?11:size==='lg'?13:12;
  const st:Record<string,React.CSSProperties> = {
    primary: { background:disabled?'rgba(192,0,28,0.06)':'rgba(192,0,28,0.15)', border:'1px solid '+(disabled?'rgba(192,0,28,0.2)':P.red), color:disabled?'rgba(192,0,28,0.35)':P.redB, boxShadow:disabled?'none':'0 0 14px rgba(192,0,28,0.18)' },
    ghost: { background:'transparent', border:'1px solid '+P.border, color:P.textSec },
    danger: { background:'rgba(255,60,60,0.08)', border:'1px solid rgba(255,60,60,0.3)', color:'#ff6b6b' },
  };
  return <button onClick={disabled?undefined:onClick} style={{ ...st[variant]||st.primary, padding:pad, fontSize:fs, fontWeight:600, cursor:disabled?'not-allowed':'pointer', borderRadius:6, fontFamily:"'Inter',sans-serif", transition:'all .15s', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap', ...extraStyle }}>{children}</button>;
}
function BarComp({ value, max, color = P.red, h = 8 }: { value:number; max:number; color?:string; h?:number }) {
  const pct = max > 0 ? Math.min(100, (value/max)*100) : 0;
  return <div style={{ height:h, background:P.surface2, borderRadius:h/2, overflow:'hidden' }}><div style={{ height:'100%', width:pct+'%', background:'linear-gradient(90deg,'+color+','+P.redB+')', borderRadius:h/2, transition:'width .5s' }} /></div>;
}
function StatusBadge({ status }: { status: string }) {
  const c = statusColors[status] || P.textDim; const l = statusLabels[status] || status;
  return <span style={{ padding:'2px 8px', borderRadius:3, background:c+'18', border:'1px solid '+c+'44', color:c, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{l}</span>;
}
function DeliveryBadge({ msg }: { msg: any }) {
  if (!msg.sendAttempted) return <span style={{ color:P.textDim, fontSize:9 }}>PENDENTE</span>;
  if (msg.delivered) return <span style={{ color:P.green, fontSize:9, fontWeight:700 }}>ENVIADO</span>;
  return <span style={{ color:'#ff4444', fontSize:9, fontWeight:700, title: msg.deliveryMsg || 'Falhou' }}>FALHOU</span>;
}
function EmptyState({ icon, title, sub }: { icon:string; title:string; sub:string }) {
  return <div style={{ textAlign:'center', padding:48, color:P.textDim }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>{icon}</div><div style={{ color:P.text, fontSize:14, fontWeight:600 }}>{title}</div><div style={{ fontSize:12, marginTop:6 }}>{sub}</div></div>;
}

/* ===== LOGIN SCREEN ===== */
function LoginScreen() {
  const [code, setCode] = useState(''); const [error, setError] = useState(false);
  const [booting, setBooting] = useState(false); const [bootStep, setBootStep] = useState(0);
  const { setAuthenticated } = useMBAStore();
  const lines = ['A verificar credenciais...', 'A inicializar MBA-OS...', 'A carregar modulos...', 'A conectar APIs...', 'Sistema pronto.'];
  const tryLogin = async function() {
    if (code !== 'MBA2026') { setError(true); setTimeout(function() { setError(false); }, 1500); return; }
    setBooting(true);
    for (var i = 0; i < lines.length; i++) { setBootStep(i); await new Promise(function(r) { setTimeout(r, 450); }); }
    storeSet('mba_session', 'active'); setAuthenticated(true, 'active');
  };
  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', backgroundImage:'linear-gradient(rgba(192,0,28,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(192,0,28,0.14) 1px,transparent 1px)', backgroundSize:'52px 52px' }}>
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(192,0,28,0.14) 0%, transparent 65%)', pointerEvents:'none' }} />
      <Sphere size={240} />
      <div style={{ position:'absolute', textAlign:'center' }}>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:42, fontWeight:900, color:P.red, letterSpacing:4, marginBottom:6 }}>MBA</div>
        <div style={{ fontSize:11, color:P.textSec, letterSpacing:6, textTransform:'uppercase', marginBottom:4 }}>MWANGO BRAIN AGENT</div>
        <div style={{ fontSize:10, color:P.textDim, letterSpacing:2 }}>PROSPECCAO INTELIGENTE v2.0</div>
      </div>
      {booting ? (
        <div style={{ position:'absolute', bottom:'20%', fontFamily:"'JetBrains Mono',monospace", fontSize:11, textAlign:'center' }}>
          {lines.map(function(l, i) { return <div key={i} style={{ color: i<=bootStep ? P.green : P.textDim, marginBottom:4 }}>{i<=bootStep?'\u2713':'\u25CB'} {l}</div>; })}
        </div>
      ) : (
        <div style={{ position:'absolute', bottom:'18%', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <input value={code} onChange={function(e) { setCode(e.target.value); }} onKeyDown={function(e) { if(e.key==='Enter') tryLogin(); }} placeholder="Codigo de acesso" style={{ ...INP, width:260, textAlign:'center', letterSpacing:3, fontSize:14 }} />
          {error && <div style={{ color:P.orange, fontSize:12 }}>Codigo incorrecto</div>}
          <button onClick={tryLogin} style={{ width:260, padding:'11px', background:'rgba(192,0,28,0.15)', border:'1px solid '+P.red, color:P.redB, borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:1 }}>ENTRAR NO SISTEMA</button>
        </div>
      )}
      <div style={{ position:'absolute', bottom:12, fontSize:9, color:P.textDim, letterSpacing:3 }}>LUANDA . ANGOLA . mwangobrain.com</div>
    </div>
  );
}

/* ===== DASHBOARD TAB (with Automation Config) ===== */
function DashboardTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [dashData, setDashData] = useState<any>(null);
  const loadDash = function() { setDashData(computeDashboard()); };
  useEffect(function() { loadDash(); }, [refreshKey]);
  const [autoCfg, setAutoCfg] = useState<any>(getAutoConfig());
  const [showCfg, setShowCfg] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);

  if (!dashData) return <div style={{ padding:16 }}><Panel><EmptyState icon="\u25CE" title="Sem dados" sub="Execute uma prospeccao para ver resultados." /></Panel></div>;
  var d = dashData; var o = d.overview || {};
  var activePlats = ALL_PLATFORMS.filter(function(pf) { var pc = autoCfg.platforms && autoCfg.platforms[pf]; return autoCfg.enabled && pc && pc.enabled && pc.username; });

  function updatePlat(pf: string, field: string, val: string | boolean) {
    var c = JSON.parse(JSON.stringify(autoCfg));
    if (!c.platforms) c.platforms = {};
    if (!c.platforms[pf]) c.platforms[pf] = { username:'', password:'', enabled:false };
    (c.platforms[pf] as any)[field] = val;
    setAutoCfg(c);
  }

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      {/* ===== AUTOMATION PANEL ===== */}
      <Panel style={{ marginBottom:14, border: autoCfg.enabled ? '1px solid rgba(0,192,99,0.4)' : undefined, background: autoCfg.enabled ? 'rgba(0,192,99,0.04)' : undefined }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <STitle>Automacao</STitle>
            {autoCfg.enabled && <span style={{ fontSize:9, padding:'2px 8px', borderRadius:10, background:'rgba(0,192,99,0.15)', color:P.green, fontWeight:700 }}>ACTIVA</span>}
          </div>
          <button onClick={function() { setShowCfg(!showCfg); }} style={{ padding:'4px 10px', borderRadius:4, border:'1px solid '+P.border, background:'transparent', color:P.textSec, fontSize:10, cursor:'pointer' }}>
            {showCfg ? 'Fechar' : 'Configurar'}
          </button>
        </div>
        {autoCfg.enabled ? (
          <div style={{ fontSize:11, color:P.green, marginBottom:8 }}>
            Apos cada prospeccao, o sistema envia DMs automaticamente.
            Plataformas: {activePlats.length > 0 ? activePlats.map(function(p) { return PLAT_NAMES[p]; }).join(', ') : 'nenhuma configurada'}.
            So precisas de clicar "Iniciar Prospeccao" - o resto e automatico.
          </div>
        ) : (
          <div style={{ fontSize:11, color:P.textSec, marginBottom:8 }}>
            Configura credenciais das 3 plataformas e activa. Apos cada prospeccao, DMs vao sozinhos.
          </div>
        )}
        {showCfg && (
          <div style={{ marginTop:8, padding:14, borderRadius:6, background:P.surface2, border:'1px solid '+P.border }}>
            {/* Global Toggle */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:10, borderBottom:'1px solid '+P.border }}>
              <div>
                <div style={{ color:P.text, fontSize:12, fontWeight:700 }}>Automacao Geral</div>
                <div style={{ color:P.textDim, fontSize:9, marginTop:2 }}>Envia DMs automaticamente apos cada prospeccao</div>
              </div>
              <div onClick={function() { setAutoCfg({...autoCfg, enabled: !autoCfg.enabled}); }} style={{ width:44, height:24, borderRadius:12, background: autoCfg.enabled ? P.green : '#333', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left: autoCfg.enabled ? 22 : 2, transition:'left 0.2s' }} />
              </div>
            </div>
            {/* 3 Platform Credential Sections */}
            {ALL_PLATFORMS.map(function(pf) {
              var pCfg = (autoCfg.platforms && autoCfg.platforms[pf]) || { username:'', password:'', enabled:false };
              var pReady = pCfg.enabled && !!pCfg.username;
              return (
                <div key={pf} style={{ marginBottom:12, padding:12, borderRadius:6, border:'1px solid '+(pReady ? 'rgba(0,192,99,0.25)' : P.border), background: pReady ? 'rgba(0,192,99,0.04)' : 'transparent' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:16 }}>{PLAT_ICONS[pf]}</span>
                      <span style={{ color:P.text, fontSize:12, fontWeight:700 }}>{PLAT_NAMES[pf]}</span>
                      {pReady && <span style={{ fontSize:8, padding:'1px 6px', borderRadius:8, background:'rgba(0,192,99,0.15)', color:P.green, fontWeight:700 }}>PRONTO</span>}
                    </div>
                    <div onClick={function() { updatePlat(pf, 'enabled', !pCfg.enabled); }} style={{ width:36, height:20, borderRadius:10, background: pCfg.enabled ? P.green : '#333', position:'relative', transition:'background 0.2s', cursor:'pointer', flexShrink:0 }}>
                      <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left: pCfg.enabled ? 18 : 2, transition:'left 0.2s' }} />
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div><Lbl>Username</Lbl><input value={pCfg.username} onChange={function(e) { updatePlat(pf, 'username', e.target.value); }} placeholder={"Utilizador do " + PLAT_NAMES[pf]} style={INP} /></div>
                    <div><Lbl>Password</Lbl><input type="password" value={pCfg.password} onChange={function(e) { updatePlat(pf, 'password', e.target.value); }} placeholder="Password" style={INP} /></div>
                  </div>
                </div>
              );
            })}
            <Btn onClick={function() { saveAutoConfig(autoCfg); setCfgSaved(true); setTimeout(function() { setCfgSaved(false); }, 2000); onRefresh(); }} style={{ width:'100%' }}>
              {cfgSaved ? '\u2713 Guardado!' : 'Guardar Configuracao'}
            </Btn>
            <div style={{ fontSize:9, color:P.textDim, marginTop:8, lineHeight:'15px' }}>
              Credenciais guardadas no teu navegador. Apos activar, so clicas "Iniciar Prospeccao" e o sistema faz: login + envio de DMs em todas as plataformas activas.
            </div>
          </div>
        )}
      </Panel>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Painel Geral</STitle><Btn variant="ghost" size="sm" onClick={onRefresh}>Actualizar</Btn></div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={o.totalProfiles||0} sub="guardados" />
        <StatCard label="Contactados hoje" value={o.contactedToday||0} sub="ultimas 24h" color={P.orange} />
        <StatCard label="Mensagens enviadas" value={o.outboundMessages||0} sub="total DMs" color={P.blue} />
        <StatCard label="Respostas recebidas" value={o.inboundMessages||0} sub="total" color={P.green} />
        <StatCard label="Taxa de resposta" value={(o.responseRate||0).toFixed(1)+'%'} sub={(o.outboundMessages||0)+' enviadas / '+(o.inboundMessages||0)+' recebidas'} color={P.blue} />
        <StatCard label="Follow-ups pendentes" value={d.pendingFollowUps||0} sub="3 dias sem resposta" color={P.orange} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade ultimos 7 dias</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{(d.dailyStats || []).map(function(ds: any, i: number) {
            var maxC = Math.max.apply(null, (d.dailyStats || []).map(function(x: any) { return x.contacted; }).concat([1]));
            var maxR = Math.max.apply(null, (d.dailyStats || []).map(function(x: any) { return x.replied; }).concat([1]));
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11 }}>{ds.dayName} {ds.date?ds.date.slice(5):''}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{ds.contacted}c / {ds.replied}r</span></div><div style={{ display:'flex', gap:3 }}><div style={{ flex:2 }}><BarComp value={ds.contacted} max={maxC} color={P.orange} h={6} /></div><div style={{ flex:2 }}><BarComp value={ds.replied} max={maxR} color={P.green} h={6} /></div></div></div>;
          })}</div>
        </Panel>
        <Panel><STitle>Por Plataforma</STitle>
          {(d.platformBreakdown || []).length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{d.platformBreakdown.map(function(p: any, i: number) {
            var colors = [P.red, P.orange, P.blue, P.green]; var maxP = Math.max.apply(null, d.platformBreakdown.map(function(x: any) { return x.count; }).concat([1]));
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.count}</span></div><BarComp value={p.count} max={maxP} color={colors[i%4]} h={8} /></div>;
          })}</div> : <EmptyState icon="\u25CE" title="Sem dados" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(d.statusBreakdown || []).map(function(s: any, i: number) {
            return <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:8, height:8, borderRadius:2, background:statusColors[s.status]||P.textDim }} /><span style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{s.status}</span></div><span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s.count}</span></div>;
          })}</div>
        </Panel>
        <Panel><STitle>Top 10 Perfis</STitle>
          {(d.topProfiles || []).length > 0 ? d.topProfiles.map(function(p: any, i: number) {
            return <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:i<9?'1px solid '+P.border:'none' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:P.textDim, fontSize:10, width:18, fontFamily:"'JetBrains Mono',monospace" }}>{i+1}.</span><span style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{p.username}</span><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.followers > 0 ? p.followers.toLocaleString('pt-PT') : '\u2014'}</span></div>;
          }) : <EmptyState icon="\u25CE" title="Sem perfis" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
    </div>
  );
}

/* ===== PROFILE DETAIL MODAL ===== */
function ProfileDetailModal({ profile, onClose, onUpdate }: { profile: any; onClose:()=>void; onUpdate:()=>void }) {
  const [notes, setNotes] = useState(profile?.notes || '');
  const [status, setStatus] = useState(profile?.status || 'prospect');
  const [msg, setMsg] = useState(''); const [sending, setSending] = useState(false);
  if (!profile) return null;
  const saveNotes = async function() { var saved = getProfiles(); for (var i = 0; i < saved.length; i++) { if (saved[i].id === profile.id) { saved[i].notes = notes; saved[i].status = status; break; } } saveProfiles(saved); onUpdate(); };
  const sendMessage = async function() {
    if (!msg.trim()) return; setSending(true);
    var sr = await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify({ username: profile.username, message: msg, platform: profile.platform, sentToday: 0 }) }).catch(function() { return null; });
    var sd = null; if (sr) { sd = await sr.json().catch(function() { return null; }); }
    var saved = getProfiles(); for (var i = 0; i < saved.length; i++) { if (saved[i].id === profile.id) { if (!saved[i].messages) saved[i].messages = []; var dmOk = !!(sd && sd.dmSent); saved[i].messages.push({ content: msg, direction: 'outbound', sentAt: new Date().toISOString(), type: 'manual', sendAttempted: true, delivered: dmOk, deliveryMsg: (sd && sd.deliveryMsg) ? sd.deliveryMsg : 'Erro ao enviar' }); if (saved[i].status === 'prospect' && dmOk) saved[i].status = 'contacted'; break; } }
    saveProfiles(saved); setMsg(''); onUpdate(); setSending(false);
  };
  const blacklist = function() { var saved = getProfiles(); for (var i = 0; i < saved.length; i++) { if (saved[i].id === profile.id) { saved[i].status = 'blacklisted'; break; } } saveProfiles(saved); onUpdate(); onClose(); };
  var msgs = profile.messages || [];
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }} onClick={onClose}>
      <div style={{ background:P.surface, border:'1px solid '+P.border, borderRadius:12, padding:20, width:'90%', maxWidth:560, maxHeight:'85vh', overflowY:'auto' }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ color:P.redB, fontSize:16, fontWeight:700 }}>{profile.username}</div><span style={{ color:P.textDim, fontSize:11 }}>{profile.platform}</span><StatusBadge status={status} /></div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', fontSize:18 }}>&times;</button>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div><Lbl>Seguidores</Lbl><div style={{ color: profile.followers > 0 ? P.text : P.textDim, fontFamily:"'JetBrains Mono',monospace" }}>{profile.followers > 0 ? profile.followers.toLocaleString('pt-PT') : '\u2014'}</div></div>
          <div><Lbl>Score</Lbl><div style={{ color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{(profile.score||0).toFixed(1)}</div></div>
          <div><Lbl>Posts</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace" }}>{profile.postsCount||0}</div></div>
          {profile.profileUrl && <div style={{ alignSelf:'flex-end' }}><a href={profile.profileUrl} target="_blank" rel="noreferrer"><Btn variant="ghost" size="sm">Abrir perfil</Btn></a></div>}
        </div>
        {profile.bio && <div style={{ marginBottom:14 }}><Lbl>Biografia</Lbl><div style={{ color:P.textSec, fontSize:12, whiteSpace:'pre-wrap' }}>{profile.bio}</div></div>}
        <div style={{ marginBottom:14 }}><Lbl>Estado</Lbl><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{['prospect','contacted','replied','accepted','rejected'].map(function(s) { return <button key={s} onClick={function() { setStatus(s); }} style={{ padding:'5px 10px', borderRadius:4, border:'1px solid '+(status===s?(statusColors[s]||P.red):P.border), background:status===s?(statusColors[s]||P.red)+'18':'transparent', color:status===s?(statusColors[s]||P.red):P.textSec, fontSize:11, cursor:'pointer' }}>{statusLabels[s]}</button>; })}</div></div>
        <div style={{ marginBottom:14 }}><Lbl>Notas</Lbl><textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} rows={2} style={{ ...INP, resize:'vertical' }} /></div>
        <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}><Btn onClick={saveNotes}>Guardar</Btn><Btn variant="danger" onClick={blacklist}>Blacklist</Btn></div>
        {msgs.length > 0 && <div style={{ marginBottom:14, borderTop:'1px solid '+P.border, paddingTop:14 }}><Lbl>Historico ({msgs.length})</Lbl><div style={{ maxHeight:200, overflowY:'auto' }}>{msgs.map(function(m: any, i: number) { return <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid '+P.redDim, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}><div style={{ flex:1, minWidth:0 }}><div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}><span style={{ color:m.direction==='outbound'?P.orange:P.green, fontSize:9, fontWeight:700 }}>{m.direction==='outbound'?'OUT':'IN'}</span><DeliveryBadge msg={m} />{m.type && <span style={{ color:P.textDim, fontSize:9 }}>({m.type})</span>}</div><div style={{ color:P.textSec, fontSize:11, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{m.content}</div></div><span style={{ color:P.textDim, fontSize:9, flexShrink:0 }}>{fmtDt(m.sentAt)}</span></div>; })}</div></div>}
        <div style={{ borderTop:'1px solid '+P.border, paddingTop:14 }}><Lbl>Enviar mensagem</Lbl><textarea value={msg} onChange={function(e) { setMsg(e.target.value); }} rows={3} placeholder="Escreva a mensagem..." style={{ ...INP, resize:'vertical', marginBottom:8 }} /><Btn onClick={sendMessage} disabled={sending || !msg.trim()}>{sending ? 'A enviar...' : 'Enviar DM real'}</Btn></div>
      </div>
    </div>
  );
}

/* ===== PROSPECTING TAB (with auto-trigger) ===== */
function ProspectingTab() {
  const [form, setForm] = useState({ platform:'all', minFollowers:500, maxFollowers:100000, location:'Angola' });
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
  const [prospectMsg, setProspectMsg] = useState('');

  const loadProfiles = function() {
    var all = getProfiles();
    if (filterPlat !== 'all') all = all.filter(function(p: any) { return p.platform === filterPlat; });
    if (filterStatus !== 'all') all = all.filter(function(p: any) { return p.status === filterStatus; });
    if (search) { var s = search.toLowerCase(); all = all.filter(function(p: any) { return (p.username || '').toLowerCase().indexOf(s) >= 0 || (p.displayName || '').toLowerCase().indexOf(s) >= 0; }); }
    setTotal(all.length); var start = (page - 1) * 50; setProfiles(all.slice(start, start + 50));
  };
  useEffect(function() { loadProfiles(); }, [page, filterPlat, filterStatus, search]);
  const deleteAllProfiles = function() { if (!confirm('Apagar TODOS os ' + total + ' perfis?')) return; if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.removeItem('mba_profiles'); } setProfiles([]); setTotal(0); setResults([]); setSelected(new Set()); setPage(1); };

  const runProspect = async function() {
    setLoading(true); setResults([]); setProspectMsg('A procurar perfis angolanos...');
    var prospectBody: any = { ...form, targetCount: 50 };
    const res = await fetch('/api/prospect', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body:JSON.stringify(prospectBody) }).catch(function() { return null; });
    if (!res) { setProspectMsg('Erro de conexao'); setLoading(false); return; }
    if (!res.ok) { const errData = await res.json().catch(function() { return null; }); setProspectMsg((errData && errData.error) ? errData.error : ('Erro HTTP ' + res.status)); setLoading(false); return; }
    const d = await res.json().catch(function() { return null; });
    if (!d) { setProspectMsg('Erro ao processar resposta'); setLoading(false); return; }
    setProspectMsg(d.message || '');
    if (d.profiles && d.profiles.length > 0) {
      setResults(d.profiles);
      var saved = getProfiles();
      var savedIds = new Set(saved.map(function(s: any) { return s.username + ':' + s.platform; }));
      var newOnes = d.profiles.filter(function(p: any) { return !savedIds.has(p.username + ':' + p.platform); });
      var merged = saved.concat(newOnes);
      saveProfiles(merged); setProfiles(merged); setTotal(merged.length); setSelected(new Set());

      // ===== AUTO-TRIGGER: se automacao ON, disparar envio de DMs =====
      var autoCfg = getAutoConfig();
      if (autoCfg.enabled && newOnes.length > 0) {
        // Verificar se ha pelo menos uma plataforma activa com credenciais
        var hasActivePlat = false;
        for (var i = 0; i < ALL_PLATFORMS.length; i++) {
          var pc = autoCfg.platforms[ALL_PLATFORMS[i]];
          if (pc && pc.enabled && pc.username) { hasActivePlat = true; break; }
        }
        if (hasActivePlat) {
          var platCounts: Record<string,number> = {};
          for (var j = 0; j < newOnes.length; j++) {
            var np = newOnes[j].platform || 'unknown';
            platCounts[np] = (platCounts[np] || 0) + 1;
          }
          var platSummary = Object.keys(platCounts).map(function(k) { return platCounts[k] + ' ' + k; }).join(', ');
          setProspectMsg('Prospeccao feita! ' + newOnes.length + ' novos perfis (' + platSummary + '). A iniciar envio automatico de DMs...');
          setAutoTrigger();
          // Switch to messages tab
          setTimeout(function() {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mba-switch-tab', { detail: 'messages' }));
            }
          }, 800);
        }
      }
    }
    setLoading(false);
  };

  var filtered = results.length > 0 ? results : profiles;
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <Panel style={{ marginBottom:14 }}>
        <STitle>Nova Prospeccao</STitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={function(e) { setForm({...form, platform: e.target.value}); }} style={SEL as any}><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="all">Todas</option></select></div>
          <div><Lbl>Localizacao</Lbl><input value={form.location} onChange={function(e) { setForm({...form, location: e.target.value}); }} style={INP} /></div>
          <div><Lbl>Min. Seguidores</Lbl><input type="number" value={form.minFollowers} onChange={function(e) { setForm({...form, minFollowers: Number(e.target.value)}); }} style={INP} /></div>
          <div><Lbl>Max. Seguidores</Lbl><input type="number" value={form.maxFollowers} onChange={function(e) { setForm({...form, maxFollowers: Number(e.target.value)}); }} style={INP} /></div>
        </div>
        <Btn onClick={runProspect} disabled={loading}>{loading ? 'A procurar...' : 'Iniciar Prospeccao'}</Btn>
        {prospectMsg && <div style={{ color: prospectMsg.indexOf('LIMITE') >= 0 ? '#ff4444' : P.textSec, fontSize:11, marginTop:8, fontWeight: prospectMsg.indexOf('LIMITE') >= 0 ? 700 : 400 }}>{prospectMsg}</div>}
      </Panel>
      <Panel style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <STitle>Perfis ({total})</STitle>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <input value={search} onChange={function(e) { setSearch(e.target.value); setPage(1); }} placeholder="Pesquisar..." style={{ ...INP, width:140 }} />
            <select value={filterPlat} onChange={function(e) { setFilterPlat(e.target.value); setPage(1); }} style={{ ...SEL as any, width:100 }}><option value="all">Todas</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option></select>
            <select value={filterStatus} onChange={function(e) { setFilterStatus(e.target.value); setPage(1); }} style={{ ...SEL as any, width:120 }}><option value="all">Todos</option><option value="contacted">Contactado</option><option value="replied">Respondeu</option></select>
            {total > 0 && <Btn variant="danger" size="sm" onClick={deleteAllProfiles}>Apagar todos</Btn>}
          </div>
        </div>
        {total > 0 && <div style={{ display:'flex', gap:12, marginBottom:10, flexWrap:'wrap' }}><div style={{ color:P.textSec, fontSize:11 }}><span style={{ fontWeight:700 }}>{total}</span> perfis encontrados</div></div>}
        <div style={{ overflowX:'auto' }}><div style={{ minWidth:480 }}>
          <div style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.border, color:P.textDim, fontSize:10, fontWeight:600, letterSpacing:'.5px' }}><div style={{ flex:2 }}>HANDLE</div><div style={{ flex:2 }}>NOME</div><div style={{ width:80, textAlign:'right' }}>SEGUIDORES</div><div style={{ width:70 }}>PLATAFORMA</div><div style={{ width:50 }}></div></div>
          {filtered.map(function(p: any) { return <div key={p.id} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.redDim, alignItems:'center' }}><div style={{ flex:2, color:P.redB, fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{p.username}</div><div style={{ flex:2, color:P.textSec, fontSize:12 }}>{p.displayName||'-'}</div><div style={{ width:80, textAlign:'right', color: p.followers > 0 ? P.text : P.textDim, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.followers > 0 ? p.followers.toLocaleString('pt-PT') : '\u2014'}</div><div style={{ width:70 }}><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{p.platform}</span></div><div style={{ width:50 }}><button onClick={function() { setDetailProfile(p); }} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', fontSize:14 }}>&#9776;</button></div></div>; })}
        </div></div>
        {total > 50 && <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}><Btn variant="ghost" size="sm" disabled={page<=1} onClick={function() { setPage(page-1); }}>Anterior</Btn><span style={{ color:P.textSec, fontSize:12, alignSelf:'center' }}>Pagina {page} de {Math.ceil(total/50)}</span><Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/50)} onClick={function() { setPage(page+1); }}>Proxima</Btn></div>}
      </Panel>
      {detailProfile && <ProfileDetailModal profile={detailProfile} onClose={function() { setDetailProfile(null); loadProfiles(); }} onUpdate={loadProfiles} />}
    </div>
  );
}

/* ===== MESSAGES TAB (with Auto-Send + 3x Retry per DM) ===== */
function MessagesTab() {
  const [subtab, setSubtab] = useState('all');
  const [messages, setMessages] = useState<any[]>([]);
  const [selProfile, setSelProfile] = useState('');
  const [msgText, setMsgText] = useState(PROPOSTA);
  const [sending, setSending] = useState(false);
  const [blStatus, setBlStatus] = useState<any>({ online: false, loading: true });

  // Auto-send state
  const [autoSending, setAutoSending] = useState(false);
  const [autoProgress, setAutoProgress] = useState<any>(null);
  const [autoLog, setAutoLog] = useState<any[]>([]);
  const [autoDone, setAutoDone] = useState(false);
  const autoStopRef = useRef(false);

  // Login status per platform
  const [loginStatus, setLoginStatus] = useState<Record<string,any>>({});

  // Listen for auto-trigger from ProspectingTab
  useEffect(function() {
    var handler = function() {
      if (consumeAutoTrigger()) {
        setTimeout(function() { autoSendRef.current(); }, 500);
      }
    };
    handler();
    window.addEventListener('mba-auto-trigger', handler);
    var interval = setInterval(handler, 1000);
    return function() { window.removeEventListener('mba-auto-trigger', handler); clearInterval(interval); };
  }, []);

  useEffect(function() {
    fetch('/api/send-message', { headers:{'x-mba-session':'active'} }).then(function(r) { return r.json(); }).then(function(data) {
      setBlStatus({ online: !!data.browserless && data.browserless.online, loading: false });
    }).catch(function() { setBlStatus({ online: false, loading: false }); });
    // Restore login status
    try { var saved = storeGet('mba_login_status', ''); if (saved) setLoginStatus(JSON.parse(saved)); } catch(e) {}
  }, []);

  const saveLoginStatus = function(st: any) { setLoginStatus(st); storeSet('mba_login_status', JSON.stringify(st)); };

  const loadMessages = function() {
    var allProfiles = getProfiles(); var msgs: any[] = [];
    allProfiles.forEach(function(p: any) { if (p.messages) p.messages.forEach(function(m: any) { msgs.push({ content: m.content, direction: m.direction, sentAt: m.sentAt, type: m.type, sendAttempted: m.sendAttempted, delivered: m.delivered, deliveryMsg: m.deliveryMsg, _username: p.username, _platform: p.platform, _profileId: p.id }); }); });
    msgs.sort(function(a: any, b: any) { return new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(); });
    setMessages(msgs);
  };
  useEffect(function() { loadMessages(); }, []);

  const sendMessage = async function() {
    if (!selProfile || !msgText.trim()) return; setSending(true);
    var saved = getProfiles(); var targetProfile = null;
    for (var i = 0; i < saved.length; i++) { if (saved[i].id === selProfile) { targetProfile = saved[i]; break; } }
    if (!targetProfile) { setSending(false); return; }
    var sr = await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify({ username: targetProfile.username, message: msgText, platform: targetProfile.platform, sentToday: 0 }) }).catch(function() { return null; });
    var sd = null; if (sr) { sd = await sr.json().catch(function() { return null; }); }
    if (!targetProfile.messages) targetProfile.messages = [];
    var dmOk = !!(sd && sd.dmSent);
    targetProfile.messages.push({ content: msgText, direction: 'outbound', sentAt: new Date().toISOString(), type: 'manual', sendAttempted: true, delivered: dmOk, deliveryMsg: (sd && sd.deliveryMsg) ? sd.deliveryMsg : 'Erro ao enviar' });
    if (targetProfile.status === 'prospect' && dmOk) targetProfile.status = 'contacted';
    saveProfiles(saved); setMsgText(PROPOSTA); loadMessages(); setSending(false);
  };

  /* ===== AUTO-SEND WITH 5x RETRY + SECOND PASS ===== */
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 4000;

  const autoSendRef = useRef<() => Promise<void>>(async function(){});

  const doLoginForPlatform = async function(pf: string, username: string, password: string): Promise<boolean> {
    if ((loginStatus[pf] || {}).loggedIn) return true;
    setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: PLAT_ICONS[pf] + ' A fazer login no ' + PLAT_NAMES[pf] + '...' }]); });
    setAutoProgress({ step: 'login', text: 'Login ' + PLAT_NAMES[pf] + '...', platform: pf });
    try {
      var res = await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify({ action:'login', platform: pf, username: username, password: password }) });
      var data = await res.json().catch(function() { return { success:false, error:'Erro de conexao' }; });
      if (data.success) {
        storeSet('mba_cookies_' + pf, data.cookiesJson || '');
        storeSet('mba_session_' + pf, data.sessionid || '');
        storeSet('mba_csrf_' + pf, data.csrftoken || '');
        var newSt = { ...loginStatus }; newSt[pf] = { loggedIn: true, label: data.message || 'Logado' }; saveLoginStatus(newSt);
        setAutoLog(function(prev) { return prev.concat([{ ok: true, msg: PLAT_ICONS[pf] + ' Login ' + PLAT_NAMES[pf] + ' feito!' }]); });
        return true;
      } else {
        setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: PLAT_ICONS[pf] + ' Login ' + PLAT_NAMES[pf] + ' falhou: ' + (data.error || 'erro') }]); });
        return false;
      }
    } catch(e) {
      setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: PLAT_ICONS[pf] + ' Erro de conexao: ' + ((e as any).message || '') }]); });
      return false;
    }
  };

  const sendDMWithRetry = async function(username: string, message: string, platform: string, sentCount: number): Promise<{ ok: boolean; msg: string }> {
    var cookies = storeGet('mba_cookies_' + platform, '');
    var sessionid = storeGet('mba_session_' + platform, '');
    var csrftoken = storeGet('mba_csrf_' + platform, '');
    var cfg = getAutoConfig();
    var pc = cfg.platforms && cfg.platforms[platform];

    for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (autoStopRef.current) return { ok: false, msg: 'Parado pelo utilizador' };

      // Every 3rd attempt, force a fresh re-login to get new cookies
      if (attempt > 1 && attempt % 3 === 1 && pc && pc.username && pc.password) {
        setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: PLAT_ICONS[platform] + ' Re-login preventivo (tentativa ' + attempt + ')...' }]); });
        var prevSt = JSON.parse(JSON.stringify(loginStatus)); prevSt[platform] = { loggedIn: false }; setLoginStatus(prevSt);
        var reOk = await doLoginForPlatform(platform, pc.username, pc.password);
        if (reOk) {
          cookies = storeGet('mba_cookies_' + platform, '');
          sessionid = storeGet('mba_session_' + platform, '');
          csrftoken = storeGet('mba_csrf_' + platform, '');
        }
      }

      var body: any = { username: username, message: message, platform: platform, sentToday: sentCount };
      if (cookies) body.cookies = cookies;
      if (sessionid) body.sessionid = sessionid;
      if (csrftoken) body.csrftoken = csrftoken;
      // Pass credentials so API can re-login internally if needed
      if (pc && pc.username) body.loginUsername = pc.username;
      if (pc && pc.password) body.loginPassword = pc.password;

      var sr = await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify(body) }).catch(function() { return null; });
      var sd = sr ? await sr.json().catch(function() { return null; }) : null;
      var dmOk = !!(sd && sd.dmSent);

      if (dmOk) {
        var source = (sd && sd.source) || '';
        return { ok: true, msg: '@' + username + ' DM enviado (tentativa ' + attempt + '/' + MAX_RETRIES + ', ' + source + ')' };
      }

      // If failed and not last attempt, wait and retry
      var errMsg = (sd && sd.deliveryMsg) || 'Erro desconhecido';
      if (attempt < MAX_RETRIES) {
        setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: '@' + username + ' tentativa ' + attempt + '/' + MAX_RETRIES + ' falhou (' + errMsg.substring(0, 60) + '). A tentar novamente...' }]); });
        await new Promise(function(r) { setTimeout(r, RETRY_DELAY); });

        // If it looks like session expired, try re-login immediately
        if (errMsg.indexOf('Nao esta logado') >= 0 || errMsg.indexOf('expirad') >= 0 || errMsg.indexOf('HTTP 401') >= 0 || errMsg.indexOf('HTTP 403') >= 0 || errMsg.indexOf('login') >= 0) {
          if (pc && pc.username && pc.password) {
            setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: PLAT_ICONS[platform] + ' Sessao expirou. A fazer re-login...' }]); });
            var reLoggedIn = await doLoginForPlatform(platform, pc.username, pc.password);
            if (!reLoggedIn) {
              return { ok: false, msg: '@' + username + ' Re-login falhou. Impossivel enviar.' };
            }
            cookies = storeGet('mba_cookies_' + platform, '');
            sessionid = storeGet('mba_session_' + platform, '');
            csrftoken = storeGet('mba_csrf_' + platform, '');
          }
        }
        continue;
      }

      // Last attempt failed
      return { ok: false, msg: '@' + username + ' FALHOU apos ' + MAX_RETRIES + ' tentativas: ' + errMsg.substring(0, 80) };
    }
    return { ok: false, msg: '@' + username + ' FALHOU' };
  };

  const autoSend = async function() {
    autoStopRef.current = false; setAutoDone(false); setAutoLog([]);
    var cfg = getAutoConfig();
    if (!cfg.enabled) { setAutoLog([{ ok: false, msg: 'Automacao desactivada. Activa no Dashboard.' }]); return; }

    // Login to all active platforms first
    var loggedInPlats: string[] = [];
    for (var i = 0; i < ALL_PLATFORMS.length; i++) {
      var pf = ALL_PLATFORMS[i];
      var pc = cfg.platforms && cfg.platforms[pf];
      if (pc && pc.enabled && pc.username && pc.password) {
        if (autoStopRef.current) break;
        var ok = await doLoginForPlatform(pf, pc.username, pc.password);
        if (ok) loggedInPlats.push(pf);
      }
    }
    if (loggedInPlats.length === 0) { setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: 'Nenhuma plataforma com login bem sucedido.' }]); }); setAutoSending(false); return; }

    setAutoSending(true);
    setAutoLog(function(prev) { return prev.concat([{ ok: true, msg: loggedInPlats.map(function(p) { return PLAT_NAMES[p]; }).join(', ') + ' prontos. A enviar DMs...' }]); });

    // Get uncontacted prospects from logged-in platforms
    await new Promise(function(r) { setTimeout(r, 500); });
    var allProfiles = getProfiles();
    var activePlatSet = new Set(loggedInPlats);
    var prospects = allProfiles.filter(function(p: any) {
      if (!activePlatSet.has(p.platform)) return false;
      if (p.status === 'contacted' || p.status === 'replied' || p.status === 'accepted') return false;
      var msgs = p.messages || [];
      for (var mi = 0; mi < msgs.length; mi++) { if (msgs[mi].direction === 'outbound' && msgs[mi].sendAttempted && msgs[mi].delivered) return false; }
      return true;
    });

    // Sort by angolaScore descending
    prospects.sort(function(a: any, b: any) { return (b.angolaScore || 0) - (a.angolaScore || 0); });
    if (prospects.length === 0) { setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: 'Sem prospects por contactar nas plataformas activas' }]); }); setAutoProgress(null); setAutoSending(false); setAutoDone(true); return; }

    var todayKey = 'mba_daily_' + new Date().toISOString().slice(0, 10);
    var dailySent = parseInt(storeGet(todayKey, '0') || '0') || 0;
    var batch = prospects.slice(0, LIMIT_DIARIO - dailySent);
    var sent = 0; var failed = 0;
    var failedProfiles: any[] = []; // Track failed for second pass

    setAutoLog(function(prev) { return prev.concat([{ ok: true, msg: batch.length + ' perfis para contactar (' + dailySent + '/' + LIMIT_DIARIO + ' usados hoje)' }]); });

    // ===== FIRST PASS =====
    for (var idx = 0; idx < batch.length; idx++) {
      if (autoStopRef.current) { setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: 'Parado pelo utilizador' }]); }); break; }
      var p = batch[idx];
      setAutoProgress({ step: 'sending', current: idx + 1, total: batch.length, username: p.username, platform: p.platform, sent: sent, failed: failed });

      var result = await sendDMWithRetry(p.username, msgText, p.platform, dailySent + sent);

      // Update profile in localStorage
      var saved = getProfiles(); var target = null;
      for (var j = 0; j < saved.length; j++) { if (saved[j].id === p.id) { target = saved[j]; break; } }
      if (target) {
        if (!target.messages) target.messages = [];
        // Remove previous failed attempts for this batch (clean slate for second pass)
        target.messages = target.messages.filter(function(m: any) { return !(m.direction === 'outbound' && m.type === 'auto' && !m.delivered && m._secondPass); });
        target.messages.push({ content: msgText, direction: 'outbound', sentAt: new Date().toISOString(), type: 'auto', sendAttempted: true, delivered: result.ok, deliveryMsg: result.msg });
        if (result.ok && target.status === 'prospect') target.status = 'contacted';
        saveProfiles(saved);
      }

      if (result.ok) {
        sent++; dailySent++;
        setAutoLog(function(prev) { return prev.concat([{ ok: true, msg: result.msg }]); });
      } else {
        failed++;
        failedProfiles.push(p);
        setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: result.msg }]); });
      }
      storeSet(todayKey, String(dailySent));
      loadMessages();
      if (idx < batch.length - 1) await new Promise(function(r) { setTimeout(r, 2500); });
    }

    // ===== SECOND PASS: Retry ALL failed profiles =====
    if (failedProfiles.length > 0 && !autoStopRef.current) {
      setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: '--- SEGUNDA PASSAGEM: ' + failedProfiles.length + ' perfis falhados, a tentar novamente ---' }]); });
      await new Promise(function(r) { setTimeout(r, 3000); }); // Pause before second pass

      // Re-login to all platforms for fresh sessions
      for (var ri = 0; ri < loggedInPlats.length; ri++) {
        if (autoStopRef.current) break;
        var rpf = loggedInPlats[ri];
        var rpc = cfg.platforms && cfg.platforms[rpf];
        if (rpc && rpc.username && rpc.password) {
          var resetSt = JSON.parse(JSON.stringify(loginStatus)); resetSt[rpf] = { loggedIn: false };
          setLoginStatus(resetSt);
          await doLoginForPlatform(rpf, rpc.username, rpc.password);
        }
      }

      for (var fi = 0; fi < failedProfiles.length; fi++) {
        if (autoStopRef.current) break;
        var fp = failedProfiles[fi];
        // Check if we still have daily quota
        if (dailySent >= LIMIT_DIARIO) {
          setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: 'Limite diario atingido. ' + (failedProfiles.length - fi) + ' perfis ficaram pendentes.' }]); });
          break;
        }
        setAutoProgress({ step: 'sending', current: fi + 1, total: failedProfiles.length, username: fp.username, platform: fp.platform, sent: sent, failed: failed, secondPass: true });

        var retryResult = await sendDMWithRetry(fp.username, msgText, fp.platform, dailySent + sent);

        // Update profile
        var saved2 = getProfiles(); var target2 = null;
        for (var k = 0; k < saved2.length; k++) { if (saved2[k].id === fp.id) { target2 = saved2[k]; break; } }
        if (target2) {
          if (!target2.messages) target2.messages = [];
          target2.messages.push({ content: msgText, direction: 'outbound', sentAt: new Date().toISOString(), type: 'auto', sendAttempted: true, delivered: retryResult.ok, deliveryMsg: '[2a passagem] ' + retryResult.msg, _secondPass: true });
          if (retryResult.ok) {
            if (target2.status === 'prospect') target2.status = 'contacted';
            failed--; // Decrement failed count
          }
          saveProfiles(saved2);
        }

        if (retryResult.ok) {
          sent++; dailySent++;
          setAutoLog(function(prev) { return prev.concat([{ ok: true, msg: '[2a passagem] ' + retryResult.msg }]); });
        } else {
          setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: '[2a passagem] ' + retryResult.msg }]); });
        }
        storeSet(todayKey, String(dailySent));
        loadMessages();
        if (fi < failedProfiles.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
      }
    }

    setAutoProgress({ step: 'done', sent: sent, failed: failed, total: batch.length });
    setAutoSending(false); setAutoDone(true);
  };

  const stopAutoSend = function() { autoStopRef.current = true; setAutoSending(false); setAutoProgress(null); setAutoLog(function(prev) { return prev.concat([{ ok: false, msg: 'Parado pelo utilizador' }]); }); };

  autoSendRef.current = autoSend;

  var filtered = messages.filter(function(m) { return subtab === 'all' || m.direction === subtab; });
  var profiles = getProfiles();

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      {/* Browserless Status */}
      <div style={{ padding:'10px 14px', borderRadius:8, border:'1px solid '+(blStatus.online ? 'rgba(0,192,99,0.3)' : 'rgba(255,68,68,0.3)'), background: blStatus.online ? 'rgba(0,192,99,0.06)' : 'rgba(255,68,68,0.06)', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background: blStatus.loading ? '#888' : blStatus.online ? P.green : '#ff4444', flexShrink:0 }} />
          <div style={{ fontSize:11, fontWeight:700, color: blStatus.online ? P.green : '#ff4444' }}>{blStatus.loading ? 'Verificando...' : blStatus.online ? 'Browserless Online - DMs activos' : 'Browserless Offline'}</div>
        </div>
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {ALL_PLATFORMS.map(function(pf) {
            var st = loginStatus[pf] || { loggedIn: false };
            return <div key={pf} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color: st.loggedIn ? P.green : P.textDim }}>
              <span>{PLAT_ICONS[pf]} {PLAT_NAMES[pf]}:</span>
              <span style={{ fontWeight:700, color: st.loggedIn ? P.green : '#ff4444' }}>{st.loggedIn ? '\u2713 Logado' : '\u2717 Nao logado'}</span>
            </div>;
          })}
        </div>
      </div>

      {/* AUTO-SEND PANEL */}
      <Panel style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <STitle>Auto-Enviar DMs (Zero Falhas)</STitle>
          {autoSending && <button onClick={stopAutoSend} style={{ padding:'4px 10px', borderRadius:4, border:'1px solid #ff4444', background:'transparent', color:'#ff4444', fontSize:10, cursor:'pointer' }}>Parar</button>}
        </div>
        <div style={{ fontSize:10, color:P.textSec, marginBottom:10, lineHeight:'16px' }}>
          Cada DM tenta 3 vezes antes de falhar. Se a sessao expirar, faz re-login automatico.
          Usa as credenciais configuradas no Dashboard para cada plataforma.
        </div>

        {!autoSending && !autoDone && (
          <Btn onClick={autoSend} style={{ width:'100%', background:'linear-gradient(135deg, '+P.red+', #800010)' }}>
            Auto-Enviar DMs em Todas as Plataformas
          </Btn>
        )}

        {/* Progress */}
        {autoProgress && autoProgress.step === 'sending' && (
          <div style={{ marginTop:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:P.textSec, marginBottom:4 }}>
              <span>{PLAT_ICONS[autoProgress.platform] || ''} @{autoProgress.username}</span>
              <span>{autoProgress.current}/{autoProgress.total} ({autoProgress.sent} ok, {autoProgress.failed} falhou)</span>
            </div>
            <div style={{ height:6, borderRadius:3, background:P.surface2, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, background:'linear-gradient(90deg, '+P.red+', '+P.redB+')', width: ((autoProgress.current / autoProgress.total) * 100) + '%', transition:'width 0.3s' }} />
            </div>
          </div>
        )}
        {autoProgress && autoProgress.step === 'login' && (
          <div style={{ marginTop:10, padding:10, borderRadius:6, background:P.surface2, fontSize:11, color:P.textSec, textAlign:'center' }}>
            <span style={{ animation:'blink 1s infinite' }}>{autoProgress.text}</span>
          </div>
        )}
        {autoProgress && autoProgress.step === 'done' && (
          <div style={{ marginTop:10, padding:12, borderRadius:6, background: autoProgress.sent > 0 ? 'rgba(0,192,99,0.08)' : 'rgba(255,68,68,0.08)', border: '1px solid ' + (autoProgress.sent > 0 ? 'rgba(0,192,99,0.2)' : 'rgba(255,68,68,0.2)'), fontSize:12, fontWeight:700, color: autoProgress.sent > 0 ? P.green : '#ff6b6b', textAlign:'center' }}>
            {autoProgress.sent} DMs enviados, {autoProgress.failed} falharam (de {autoProgress.total})
            <button onClick={function() { setAutoDone(false); setAutoProgress(null); setAutoLog([]); }} style={{ display:'block', margin:'8px auto 0', padding:'4px 14px', borderRadius:4, border:'1px solid '+P.border, background:'transparent', color:P.textSec, fontSize:10, cursor:'pointer' }}>Enviar mais</button>
          </div>
        )}

        {/* Log */}
        {autoLog.length > 0 && (
          <div style={{ marginTop:10, maxHeight:200, overflowY:'auto', padding:8, borderRadius:6, background:'rgba(0,0,0,0.3)', fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>
            {autoLog.map(function(l: any, i: number) { return <div key={i} style={{ color: l.ok ? P.green : '#ff6b6b', padding:'2px 0', borderBottom: i < autoLog.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>{l.ok ? '\u2713' : '\u2717'} {l.msg}</div>; })}
          </div>
        )}
      </Panel>

      {/* Manual Send */}
      <Panel style={{ marginBottom:14 }}>
        <STitle>Enviar Mensagem (manual)</STitle>
        <div style={{ marginBottom:10 }}><Lbl>Perfil</Lbl><select value={selProfile} onChange={function(e) { setSelProfile(e.target.value); }} style={SEL as any}><option value="">Seleccionar perfil...</option>{profiles.map(function(p: any) { return <option key={p.id} value={p.id}>{p.username} ({p.platform}) - {p.followers > 0 ? p.followers.toLocaleString() : '\u2014'} seg</option>; })}</select></div>
        <textarea value={msgText} onChange={function(e) { setMsgText(e.target.value); }} rows={4} style={{ ...INP, resize:'vertical', marginBottom:8 }} />
        <Btn onClick={sendMessage} disabled={sending || !selProfile}>{sending ? 'A enviar...' : 'Enviar agora'}</Btn>
      </Panel>

      {/* History */}
      <Panel><STitle>Historico ({filtered.length})</STitle>
        {filtered.length > 0 ? filtered.slice(0, 100).map(function(m: any, i: number) { return <div key={i} style={{ padding:'10px 0', borderBottom:i<99?'1px solid '+P.redDim:'none' }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}><span style={{ color:m.direction==='outbound'?P.orange:P.green, fontSize:10, fontWeight:700 }}>{m.direction==='outbound'?'OUT':'IN'}</span><span style={{ color:P.redB, fontSize:11, fontWeight:600 }}>{m._username}</span><span style={{ color:P.textDim, fontSize:10 }}>{m._platform}</span>{m.direction === 'outbound' && <DeliveryBadge msg={m} />}{m.type && <span style={{ color:P.textDim, fontSize:9 }}>({m.type})</span>}</div><div style={{ color:P.textSec, fontSize:11, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{m.content}</div><div style={{ color:P.textDim, fontSize:10, marginTop:4 }}>{fmtDt(m.sentAt)}</div></div>; }) : <EmptyState icon="\u2709" title="Sem mensagens" sub="As mensagens aparecerao aqui depois de enviar DMs" />}
      </Panel>
    </div>
  );
}

/* ===== AGENT CHAT ===== */
function AgentChat() {
  const [chatHistory, setChatHistory] = useState<{role:string; content:string}[]>([]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(function() { chatEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [chatHistory]);
  const send = async function() {
    if (!input.trim() || loading) return; var userMsg = input.trim(); setInput('');
    setChatHistory(function(h) { return h.concat([{ role:'user', content:userMsg }]); }); setLoading(true);
    var profiles = getProfiles(); var systemContext = 'ESTADO ACTUAL DO SISTEMA:\n';
    systemContext += '- Total de perfis guardados: ' + profiles.length + '\n';
    var platCount: Record<string,number> = {}; var statusCount: Record<string,number> = {};
    var totalSent = 0; var totalDelivered = 0; var totalFailed = 0;
    for (var i = 0; i < profiles.length; i++) { var pl = profiles[i].platform || 'unknown'; platCount[pl] = (platCount[pl] || 0) + 1; var st = profiles[i].status || 'prospect'; statusCount[st] = (statusCount[st] || 0) + 1; var ms = profiles[i].messages || []; for (var j = 0; j < ms.length; j++) { if (ms[j].direction === 'outbound') { totalSent++; if (ms[j].delivered) totalDelivered++; else if (ms[j].sendAttempted) totalFailed++; } } }
    systemContext += '- Por plataforma: ' + JSON.stringify(platCount) + '\n- Por estado: ' + JSON.stringify(statusCount) + '\n- DMs: ' + totalSent + ' enviados, ' + totalDelivered + ' entregues, ' + totalFailed + ' falhados\n- Limite diario: 30 DMs\n';
    const res = await fetch('/api/respond', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify({ message: userMsg, conversationHistory: chatHistory.slice(-10), systemContext: systemContext }) }).catch(function() { return null; });
    if (res && res.ok) { const d = await res.json().catch(function() { return null; }); if (d && d.reply) setChatHistory(function(h) { return h.concat([{ role:'assistant', content:d.reply }]); }); else setChatHistory(function(h) { return h.concat([{ role:'assistant', content:'Erro ao gerar resposta.' }]); }); } else setChatHistory(function(h) { return h.concat([{ role:'assistant', content:'Erro de ligacao.' }]); });
    setLoading(false);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid '+P.border }}><STitle>Agente IA</STitle></div>
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {chatHistory.length === 0 && <EmptyState icon="\u2609" title="Agente Mwango Brain" sub="Pergunte sobre prospeccao, perfis, DMs, ou qualquer coisa sobre o sistema." />}
        {chatHistory.map(function(m, i) { return <div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', marginBottom:10 }}><div style={{ maxWidth:'80%', padding:'10px 14px', borderRadius:8, background:m.role==='user'?'rgba(192,0,28,0.12)':'rgba(255,255,255,0.04)', border:'1px solid '+(m.role==='user'?P.border:'rgba(255,255,255,0.06)'), color:P.text, fontSize:13, lineHeight:1.5 }}>{m.role === 'assistant' && <div style={{ color:P.redB, fontSize:10, fontWeight:700, marginBottom:4 }}>MBA AGENTE</div>}<div style={{ whiteSpace:'pre-wrap' }}>{m.content}</div></div></div>; })}
        {loading && <div style={{ display:'flex', justifyContent:'flex-start' }}><div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(255,255,255,0.04)', color:P.textDim, fontSize:12, animation:'blink 1.5s infinite' }}>A pensar...</div></div>}
        <div ref={chatEnd} />
      </div>
      <div style={{ padding:12, borderTop:'1px solid '+P.border, display:'flex', gap:8 }}>
        <input value={input} onChange={function(e) { setInput(e.target.value); }} onKeyDown={function(e) { if(e.key==='Enter' && !e.shiftKey) send(); }} placeholder="Escreva a sua mensagem..." style={{ ...INP, flex:1 }} />
        <Btn onClick={send} disabled={loading || !input.trim()}>Enviar</Btn>
      </div>
    </div>
  );
}

/* ===== FOLLOW-UPS TAB ===== */
function FollowUpsTab() {
  var profiles = getProfiles(); var now = Date.now();
  var pendingDue: any[] = []; var pendingWait: any[] = []; var sentList: any[] = []; var doneList: any[] = [];
  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i]; var msgs = p.messages || []; var fuCount = 0; var lastOut = null;
    for (var mi = 0; mi < msgs.length; mi++) { if (msgs[mi].type === 'follow-up') { fuCount++; var entry: any = { username: p.username, platform: p.platform, followers: p.followers || 0, sentAt: msgs[mi].sentAt, delivered: msgs[mi].delivered, fuNum: fuCount, replied: false }; var fuT = new Date(msgs[mi].sentAt).getTime(); for (var ri = 0; ri < msgs.length; ri++) { if (msgs[ri].direction === 'inbound' && new Date(msgs[ri].sentAt).getTime() > fuT) { entry.replied = true; break; } } if (entry.replied || fuCount >= 2) doneList.push(entry); else sentList.push(entry); } if (msgs[mi].direction === 'outbound' && msgs[mi].type !== 'follow-up' && msgs[mi].type !== 'auto-reply') lastOut = msgs[mi]; }
    if (fuCount < 2 && lastOut) { var sT = new Date(lastOut.sentAt).getTime(); var hasR = false; for (var hr = 0; hr < msgs.length; hr++) { if (msgs[hr].direction === 'inbound' && new Date(msgs[hr].sentAt).getTime() > sT) { hasR = true; break; } } if (!hasR) { var days = Math.floor((now - sT) / 86400000); var item: any = { username: p.username, platform: p.platform, followers: p.followers || 0, days: days, fuNum: fuCount, nextFu: fuCount + 1, due: days >= 3, dueIn: 3 - days }; if (days >= 3) pendingDue.push(item); else pendingWait.push(item); } }
  }
  pendingDue.sort(function(a: any, b: any) { return b.days - a.days; }); pendingWait.sort(function(a: any, b: any) { return b.days - a.days; });
  var nDue = pendingDue.length; var nWait = pendingWait.length; var nSent = sentList.length; var nDone = doneList.length;
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <STitle>Follow-Ups Automaticos</STitle>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Pendentes (prontos)" value={nDue} sub="3 dias sem resposta" color={P.orange} />
        <StatCard label="A aguardar" value={nWait} sub="menos de 3 dias" color={P.textSec} />
        <StatCard label="Enviados" value={nSent} sub="aguardando resposta" color={P.blue} />
        <StatCard label="Concluidos" value={nDone} sub="respondeu ou max 2" color={P.green} />
      </div>
      {nDue > 0 && (<Panel style={{ marginBottom:14 }}><STitle>Prontos para Follow-Up ({nDue})</STitle>{pendingDue.map(function(fu: any, idx: number) { return <div key={'d'+idx} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.redDim, alignItems:'center' }}><div style={{ flex:2, color:P.redB, fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{fu.username}</div><div style={{ width:70, textAlign:'right', color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{fu.followers.toLocaleString('pt-PT')}</div><div style={{ width:70 }}><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{fu.platform}</span></div><div style={{ width:60, color:P.orange, fontSize:11, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{fu.days}d</div><div style={{ width:60 }}><span style={{ padding:'2px 8px', borderRadius:3, background:P.orange+'18', border:'1px solid '+P.orange+'44', color:P.orange, fontSize:10, fontWeight:600 }}>F{fu.nextFu}</span></div></div>; })}</Panel>)}
      {nWait > 0 && (<Panel style={{ marginBottom:14 }}><STitle>A Aguardar ({nWait})</STitle>{pendingWait.map(function(fu: any, idx: number) { return <div key={'w'+idx} style={{ display:'flex', gap:8, padding:'8px 0', borderBottom:'1px solid '+P.redDim, alignItems:'center' }}><div style={{ flex:2, color:P.textSec, fontSize:12, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{fu.username}</div><div style={{ width:70, textAlign:'right', color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{fu.followers.toLocaleString('pt-PT')}</div><div style={{ width:70 }}><span style={{ color:P.textDim, fontSize:10, textTransform:'capitalize' }}>{fu.platform}</span></div><div style={{ width:60, color:P.textDim, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{fu.days}d</div><div style={{ width:60, color:P.textSec, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{fu.dueIn}d</div></div>; })}</Panel>)}
      {nDue === 0 && nWait === 0 && nSent === 0 && nDone === 0 && (<EmptyState icon="\u21BB" title="Sem follow-ups" sub="Os follow-ups aparecerao aqui 3 dias apos o primeiro contacto sem resposta." />)}
    </div>
  );
}

/* ===== MAIN APP ===== */
export default function MBAApp() {
  const { isAuthenticated, activeTab, setActiveTab, setAuthenticated } = useMBAStore();
  const [clock, setClock] = useState('');
  const [dashKey, setDashKey] = useState(0);

  useEffect(function() { var sid = storeGet('mba_session'); if (sid) { setAuthenticated(true, sid); } }, []);
  useEffect(function() {
    if (!isAuthenticated) return;
    var tick = setInterval(function() { setClock(new Date().toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', second:'2-digit' })); }, 1000);
    return function() { clearInterval(tick); };
  }, [isAuthenticated]);

  // Listen for tab switch events from auto-trigger
  useEffect(function() {
    var handler = function(e: any) { if (e.detail) setActiveTab(e.detail); };
    window.addEventListener('mba-switch-tab', handler);
    return function() { window.removeEventListener('mba-switch-tab', handler); };
  }, []);

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ height:48, borderBottom:'1px solid '+P.border, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px', flexShrink:0, background:P.surface }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:900, color:P.red, letterSpacing:2 }}>MBA</div>
          <div style={{ width:1, height:20, background:P.border }} />
          <div style={{ color:P.textDim, fontSize:10, letterSpacing:2, textTransform:'uppercase' }}>MWANGO BRAIN AGENT</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ color:P.textDim, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{clock}</div>
          <button onClick={function() { if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.removeItem('mba_session'); } setAuthenticated(false, null); }} style={{ background:'none', border:'1px solid '+P.border, borderRadius:6, padding:'4px 10px', cursor:'pointer', color:P.textSec, fontSize:11 }}>SAIR</button>
        </div>
      </div>
      <div style={{ display:'flex', borderBottom:'1px solid '+P.border, overflowX:'auto', flexShrink:0, background:P.surface }}>
        {TABS.map(function(t) { return <button key={t.id} onClick={function() { setActiveTab(t.id); }} style={{ padding:'10px 16px', border:'none', borderBottom:activeTab===t.id?'2px solid '+P.red:'2px solid transparent', background:'transparent', color:activeTab===t.id?P.redB:P.textDim, fontSize:11, fontWeight:activeTab===t.id?700:500, cursor:'pointer', whiteSpace:'nowrap', letterSpacing:'.5px', transition:'all .15s' }}>{t.label}</button>; })}
      </div>
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        {activeTab === 'dashboard' && <DashboardTab key={dashKey} refreshKey={dashKey} onRefresh={function() { setDashKey(dashKey + 1); }} />}
        {activeTab === 'prospecting' && <ProspectingTab />}
        <div style={{ display: activeTab === 'messages' ? 'block' : 'none', position: 'absolute', top:0, left:0, right:0, bottom:0, zIndex: activeTab === 'messages' ? 1 : -1 }}><MessagesTab /></div>
        {activeTab === 'followups' && <FollowUpsTab />}
        {activeTab === 'agent' && <AgentChat />}
      </div>
    </div>
  );
}