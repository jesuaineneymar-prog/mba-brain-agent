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

const TABS = [
  {id:'dashboard',label:'DASHBOARD'},{id:'prospecting',label:'PROSPECCAO'},{id:'agent',label:'AGENTE IA'},
];

function getProfiles(): any[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  var raw = window.localStorage.getItem('mba_profiles') || '[]';
  if (!raw || raw.charAt(0) !== '[') return [];
  return JSON.parse(raw);
}
function saveProfiles(profiles: any[]) {
  if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.setItem('mba_profiles', JSON.stringify(profiles)); }
}

/* ===== PLATFORM CONSTANTS ===== */
var ALL_PLATFORMS = ['instagram', 'tiktok', 'facebook'];
var PLAT_ICONS: Record<string,string> = { instagram: '📸', tiktok: '🎵', facebook: '👤' };
var PLAT_NAMES: Record<string,string> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook' };
var PLAT_COLORS: Record<string,string> = { instagram: '#E1306C', tiktok: '#00f2ea', facebook: '#1877F2' };

function computeDashboard() {
  var profiles = getProfiles();
  var totalProfiles = profiles.length;
  var statusCounts: Record<string, number> = {};
  var platCounts: Record<string, number> = {};
  var topProfiles: any[] = [];
  var locationCounts: Record<string, number> = {};

  for (var i = 0; i < profiles.length; i++) {
    var p = profiles[i];
    var st = p.status || 'prospect';
    if (st === 'blacklisted') continue;
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    var pl = p.platform || 'unknown';
    platCounts[pl] = (platCounts[pl] || 0) + 1;
    var loc = (p.location || p.country || 'Outro');
    if (loc === 'AO') loc = 'Angola';
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  }
  for (var sk in statusCounts) { if (statusCounts.hasOwnProperty(sk)) statusBreakdown.push({status: sk, count: statusCounts[sk]}); }
  var statusBreakdown: any[] = [];
  for (var sk2 in statusCounts) { if (statusCounts.hasOwnProperty(sk2)) statusBreakdown.push({status: sk2, count: statusCounts[sk2]}); }
  var platformBreakdown: any[] = [];
  for (var pk in platCounts) { if (platCounts.hasOwnProperty(pk)) platformBreakdown.push({platform: pk, count: platCounts[pk]}); }
  var locationBreakdown: any[] = [];
  for (var lk in locationCounts) { if (locationCounts.hasOwnProperty(lk)) locationBreakdown.push({location: lk, count: locationCounts[lk]}); }
  var sorted = profiles.filter(function(p) { return p.status !== 'blacklisted'; }).slice().sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });
  for (var ti = 0; ti < Math.min(10, sorted.length); ti++) topProfiles.push(sorted[ti]);

  var avgFollowers = 0;
  if (totalProfiles > 0) {
    var sum = 0;
    for (var ai = 0; ai < profiles.length; ai++) sum += (profiles[ai].followers || 0);
    avgFollowers = Math.round(sum / totalProfiles);
  }

  return { overview: { totalProfiles, avgFollowers }, statusBreakdown, platformBreakdown, locationBreakdown, topProfiles };
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
  const colors: Record<string,string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b', blacklisted: '#666' };
  const labels: Record<string,string> = { prospect:'Prospecto', contacted:'Contactado', replied:'Respondeu', accepted:'Aceite', rejected:'Rejeitado', blacklisted:'Blacklist' };
  const c = colors[status] || P.textDim; const l = labels[status] || status;
  return <span style={{ padding:'2px 8px', borderRadius:3, background:c+'18', border:'1px solid '+c+'44', color:c, fontSize:10, fontWeight:600, textTransform:'uppercase' }}>{l}</span>;
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

/* ===== DASHBOARD TAB ===== */
function DashboardTab({ refreshKey, onRefresh }: { refreshKey: number; onRefresh: () => void }) {
  const [dashData, setDashData] = useState<any>(null);
  const loadDash = function() { setDashData(computeDashboard()); };
  useEffect(function() { loadDash(); }, [refreshKey]);

  if (!dashData) return <div style={{ padding:16 }}><Panel><EmptyState icon="\u25CE" title="Sem dados" sub="Execute uma prospeccao para ver resultados." /></Panel></div>;
  var d = dashData; var o = d.overview || {};

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Painel Geral</STitle><Btn variant="ghost" size="sm" onClick={onRefresh}>Actualizar</Btn></div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={o.totalProfiles||0} sub="guardados" />
        <StatCard label="Media seguidores" value={(o.avgFollowers||0).toLocaleString('pt-PT')} sub="por perfil" color={P.blue} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Por Plataforma</STitle>
          {(d.platformBreakdown || []).length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{d.platformBreakdown.map(function(p: any, i: number) {
            var colors = [P.red, P.orange, P.blue, P.green]; var maxP = Math.max.apply(null, d.platformBreakdown.map(function(x: any) { return x.count; }).concat([1]));
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{PLAT_NAMES[p.platform] || p.platform}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{p.count}</span></div><BarComp value={p.count} max={maxP} color={colors[i%4]} h={8} /></div>;
          })}</div> : <EmptyState icon="\u25CE" title="Sem dados" sub="Aguardando prospeccao" />}
        </Panel>
        <Panel><STitle>Por Localizacao</STitle>
          {(d.locationBreakdown || []).length > 0 ? <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{d.locationBreakdown.map(function(l: any, i: number) {
            var colors = [P.green, P.blue, P.orange, P.red]; var maxL = Math.max.apply(null, d.locationBreakdown.map(function(x: any) { return x.count; }).concat([1]));
            return <div key={i}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}><span style={{ color:P.textSec, fontSize:11 }}>{l.location}</span><span style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{l.count}</span></div><BarComp value={l.count} max={maxL} color={colors[i%4]} h={8} /></div>;
          })}</div> : <EmptyState icon="\u25CE" title="Sem dados" sub="Aguardando prospeccao" />}
        </Panel>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <Panel><STitle>Estado dos Perfis</STitle>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>{(d.statusBreakdown || []).map(function(s: any, i: number) {
            return <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:8, height:8, borderRadius:2, background:({ prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b' } as any)[s.status]||P.textDim }} /><span style={{ color:P.textSec, fontSize:12, textTransform:'capitalize' }}>{s.status}</span></div><span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s.count}</span></div>;
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
  if (!profile) return null;
  const saveNotes = async function() { var saved = getProfiles(); for (var i = 0; i < saved.length; i++) { if (saved[i].id === profile.id) { saved[i].notes = notes; saved[i].status = status; break; } } saveProfiles(saved); onUpdate(); };
  const blacklist = function() { var saved = getProfiles(); for (var i = 0; i < saved.length; i++) { if (saved[i].id === profile.id) { saved[i].status = 'blacklisted'; break; } } saveProfiles(saved); onUpdate(); onClose(); };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }} onClick={onClose}>
      <div style={{ background:P.surface, border:'1px solid '+P.border, borderRadius:12, padding:20, width:'90%', maxWidth:560, maxHeight:'85vh', overflowY:'auto' }} onClick={function(e) { e.stopPropagation(); }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ color:P.redB, fontSize:16, fontWeight:700 }}>{profile.username}</div><span style={{ color:PLAT_COLORS[profile.platform]||P.textDim, fontSize:11 }}>{PLAT_NAMES[profile.platform]||profile.platform}</span><StatusBadge status={status} /></div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:P.textSec, cursor:'pointer', fontSize:18 }}>&times;</button>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div><Lbl>Seguidores</Lbl><div style={{ color: profile.followers > 0 ? P.text : P.textDim, fontFamily:"'JetBrains Mono',monospace" }}>{profile.followers > 0 ? profile.followers.toLocaleString('pt-PT') : '\u2014'}</div></div>
          <div><Lbl>Score</Lbl><div style={{ color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{(profile.score||0).toFixed(1)}</div></div>
          <div><Lbl>Posts</Lbl><div style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace" }}>{profile.postsCount||0}</div></div>
          {profile.profileUrl && <div style={{ alignSelf:'flex-end' }}><a href={profile.profileUrl} target="_blank" rel="noreferrer"><Btn variant="ghost" size="sm">Abrir perfil</Btn></a></div>}
        </div>
        {profile.bio && <div style={{ marginBottom:14 }}><Lbl>Biografia</Lbl><div style={{ color:P.textSec, fontSize:12, whiteSpace:'pre-wrap' }}>{profile.bio}</div></div>}
        {profile.location && <div style={{ marginBottom:14 }}><Lbl>Localizacao</Lbl><div style={{ color:P.text, fontSize:12 }}>{profile.location}</div></div>}
        <div style={{ marginBottom:14 }}><Lbl>Estado</Lbl><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{['prospect','contacted','replied','accepted','rejected'].map(function(s) { return <button key={s} onClick={function() { setStatus(s); }} style={{ padding:'5px 10px', borderRadius:4, border:'1px solid '+(status===s?(P.red):P.border), background:status===s?P.red+'18':'transparent', color:status===s?P.red:P.textSec, fontSize:11, cursor:'pointer' }}>{s}</button>; })}</div></div>
        <div style={{ marginBottom:14 }}><Lbl>Notas</Lbl><textarea value={notes} onChange={function(e) { setNotes(e.target.value); }} rows={3} style={{ ...INP, resize:'vertical' }} /></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><Btn onClick={saveNotes}>Guardar</Btn><Btn variant="danger" onClick={blacklist}>Blacklist</Btn></div>
      </div>
    </div>
  );
}

/* ===== PROSPECTING TAB ===== */
function ProspectingTab() {
  const [form, setForm] = useState({ platform:'all', minFollowers:500, maxFollowers:100000, location:'Angola' });
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
  const deleteAllProfiles = function() { if (!confirm('Apagar TODOS os ' + total + ' perfis?')) return; if (typeof window !== 'undefined' && window.localStorage) { window.localStorage.removeItem('mba_profiles'); } setProfiles([]); setTotal(0); setResults([]); setPage(1); };

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
      saveProfiles(merged); setProfiles(merged); setTotal(merged.length); setPage(1);

      var platNames = newOnes.map(function(p: any) { return p.platform; }).filter(function(v: string, i: number, a: string[]) { return a.indexOf(v) === i; }).map(function(p: string) { return PLAT_NAMES[p] || p; });
      setProspectMsg('Prospeccao feita! ' + newOnes.length + ' novos perfis (' + platNames.join(', ') + ').');
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
            <select value={filterStatus} onChange={function(e) { setFilterStatus(e.target.value); setPage(1); }} style={{ ...SEL as any, width:120 }}><option value="all">Todos</option><option value="prospect">Prospecto</option><option value="contacted">Contactado</option><option value="replied">Respondeu</option></select>
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

/* ===== AGENT CHAT ===== */
function AgentChat() {
  const [chatHistory, setChatHistory] = useState<{role:string; content:string}[]>([]);
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(function() { chatEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [chatHistory]);
  const send = async function() {
    if (!input.trim() || loading) return; var userMsg = input.trim(); setInput('');
    setChatHistory(function(h) { return h.concat([{ role:'user', content:userMsg }]); }); setLoading(true);
    var profiles = getProfiles();
    var systemContext = 'ESTADO ACTUAL DO SISTEMA:\n';
    systemContext += '- Total de perfis guardados: ' + profiles.length + '\n';
    var platCount: Record<string,number> = {};
    for (var i = 0; i < profiles.length; i++) { platCount[profiles[i].platform || 'unknown'] = (platCount[profiles[i].platform || 'unknown'] || 0) + 1; }
    systemContext += '- Por plataforma: ' + JSON.stringify(platCount) + '\n';
    systemContext += '- Este sistema e apenas para prospeccao (nao envia DMs)\n';
    const res = await fetch('/api/respond', { method:'POST', headers:{'Content-Type':'application/json','x-mba-session':'active'}, body: JSON.stringify({ message: userMsg, conversationHistory: chatHistory.slice(-10), systemContext: systemContext }) }).catch(function() { return null; });
    if (res && res.ok) { const d = await res.json().catch(function() { return null; }); if (d && d.reply) setChatHistory(function(h) { return h.concat([{ role:'assistant', content:d.reply }]); }); else setChatHistory(function(h) { return h.concat([{ role:'assistant', content:'Erro ao gerar resposta.' }]); }); } else setChatHistory(function(h) { return h.concat([{ role:'assistant', content:'Erro de ligacao.' }]); });
    setLoading(false);
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'10px 16px', borderBottom:'1px solid '+P.border }}><STitle>Agente IA</STitle></div>
      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {chatHistory.length === 0 && <EmptyState icon="\u2609" title="Agente Mwango Brain" sub="Pergunte sobre prospeccao, perfis, ou qualquer coisa sobre o sistema." />}
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
      <div style={{ flex:1, overflow:'hidden' }}>
        {activeTab === 'dashboard' && <DashboardTab key={dashKey} refreshKey={dashKey} onRefresh={function() { setDashKey(dashKey + 1); }} />}
        {activeTab === 'prospecting' && <ProspectingTab />}
        {activeTab === 'agent' && <AgentChat />}
      </div>
    </div>
  );
}