function LoginScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootStep, setBootStep] = useState(0);
  const { setAuthenticated } = useMBAStore();
  const lines = ['A verificar credenciais...', 'A inicializar MBA-OS...', 'A carregar módulos...', 'A conectar APIs...', 'Sistema pronto.'];

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
        <div style={{ fontSize:10, color:P.textDim, letterSpacing:2 }}>PROSPECÇÃO INTELIGENTE v2.0</div>
      </div>
      {booting ? (
        <div style={{ position:'absolute', bottom:'20%', fontFamily:"'JetBrains Mono',monospace", fontSize:11, textAlign:'center' }}>
          {lines.map((l,i) => <div key={i} style={{ color: i<=bootStep ? P.green : P.textDim, marginBottom:4, opacity: i<=bootStep?1:0.3, transition:'all .3s' }}>{i<=bootStep?'✓':'○'} {l}</div>)}
        </div>
      ) : (
        <div style={{ position:'absolute', bottom:'18%', display:'flex', flexDirection:'column', alignItems:'center', gap:10, animation:'fade-up .8s ease-out' }}>
          <input value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryLogin()} placeholder="Código de acesso" style={{ ...INP, width:260, textAlign:'center', letterSpacing:3, fontSize:14 }} />
          {error && <div style={{ color:P.orange, fontSize:12 }}>Código incorrecto</div>}
          <button onClick={tryLogin} style={{ width:260, padding:'11px', background:'rgba(192,0,28,0.15)', border:'1px solid '+P.red, color:P.redB, borderRadius:6, fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:1 }}>ENTRAR NO SISTEMA</button>
        </div>
      )}
      <div style={{ position:'absolute', bottom:12, fontSize:9, color:P.textDim, letterSpacing:3 }}>LUANDA · ANGOLA · mwangobrain.com</div>
    </div>
  );
}

function DashboardTab({ dashData }: { dashData: any }) {
  if (!dashData) return <div style={{ padding:16 }}><Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>◎</div><div style={{ color:P.text, fontSize:14, fontWeight:600 }}>Sem dados ainda</div><div style={{ fontSize:12, marginTop:6 }}>Execute uma prospecção para ver resultados.</div></div></Panel></div>;
  const d = dashData;
  const statusColors: Record<string, string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b' };
  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <StatCard label="Total de perfis" value={d.totalProfiles} sub="na base de dados" />
        <StatCard label="Contactados hoje" value={d.dailyStats?.[6]?.contacted || 0} sub="últimas 24h" color={P.orange} />
        <StatCard label="Respostas hoje" value={d.dailyStats?.[6]?.replied || 0} sub="últimas 24h" color={P.green} />
        <StatCard label="Taxa de resposta" value={d.responseRate+'%'} sub={d.outbound+' enviadas / '+d.inbound+' recebidas'} color={P.blue} />
        <StatCard label="Campanhas" value={d.totalCampaigns} sub="total criadas" />
        <StatCard label="Follow-ups pendentes" value={d.pendingFollowUps || 0} color={P.orange} />
      </div>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
        <Panel><STitle>Actividade últimos 7 dias</STitle>
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