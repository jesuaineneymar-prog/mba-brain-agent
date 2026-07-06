function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (actionFilter) params.set('action', actionFilter);
      const r = await fetch('/api/activity-logs?' + params);
      const d = await r.json();
      setLogs(d.logs || []); setTotal(d.total || 0);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, actionFilter]);

  const actions = ['MESSAGE_SENT','MESSAGE_FAILED','PROSPECT_COMPLETE','WEBHOOK_RECEIVED','FOLLOWUP_AUTO_SENT','SCHEDULED_SENT','PROFILE_UPDATE','APIFY_ERROR'];

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <STitle>Registo de Actividade ({total})</STitle>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select value={actionFilter} onChange={e=>{ setActionFilter(e.target.value); setPage(1); }} style={{ ...INP, width:'auto', fontSize:11 }}>
            <option value="">Todas as acções</option>
            {actions.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ color:P.textDim, fontSize:10 }}>Página {page} de {Math.ceil(total/50) || 1}</span>
          <Btn variant="ghost" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>←</Btn>
          <Btn variant="ghost" size="sm" disabled={page>=Math.ceil(total/50)} onClick={()=>setPage(p=>p+1)}>→</Btn>
        </div>
      </div>
      <Panel>
        {loading ? <div style={{ textAlign:'center', padding:24, color:P.textDim }}>A carregar...</div> :
        logs.length === 0 ? <div style={{ textAlign:'center', padding:48, color:P.textDim }}>Sem registos de actividade</div> : logs.map((l: any, i: number) => {
          const actionColors: Record<string, string> = { MESSAGE_SENT: P.green, MESSAGE_FAILED: '#ff6b6b', PROSPECT_COMPLETE: P.blue, WEBHOOK_RECEIVED: P.orange };
          return (
            <div key={i} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid '+P.border }}>
              <div style={{ width:8, height:8, borderRadius:2, background:actionColors[l.action]||P.textDim, flexShrink:0, marginTop:5 }} />
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <span style={{ color:actionColors[l.action]||P.text, fontSize:11, fontWeight:600, fontFamily:"'JetBrains Mono',monospace" }}>{l.action}</span>
                  <span style={{ color:P.textDim, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(l.createdAt).toLocaleString('pt-PT')}</span>
                </div>
                <div style={{ color:P.textSec, fontSize:11 }}>{l.details || '—'}</div>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

function ConfigTab() {
  const [cookies, setCookies] = useState<any[]>([]);
  const [updates, setUpdates] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);

  const loadCookies = async () => { try { const r = await fetch('/api/cookies'); const d = await r.json(); setCookies(d.cookies||[]); } catch {} };
  const loadBackups = async () => { try { const r = await fetch('/api/backup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'list'}) }); const d = await r.json(); setBackups(d.backups||[]); } catch {} };
  useEffect(() => { loadCookies(); loadBackups(); }, []);

  const saveCookies = async () => {
    await fetch('/api/cookies', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ updates }) });
    setUpdates({}); setSaved(true); setTimeout(()=>setSaved(false), 2000); loadCookies();
  };

  const createBackup = async () => {
    setBackupLoading(true);
    await fetch('/api/backup');
    loadBackups(); setBackupLoading(false);
  };

  const restoreBackup = async (name: string) => {
    if (!confirm('Restaurar backup? Isto substitui os dados actuais.')) return;
    await fetch('/api/backup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'restore', backupName:name}) });
    alert('Backup restaurado. Recarregue a página.');
  };

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <Panel><STitle>Cookies de Plataforma</STitle>
          <div style={{ color:P.textDim, fontSize:11, marginBottom:14 }}>Actualize as credenciais sem editar o ficheiro .env manualmente. As alterações entram em vigor imediatamente.</div>
          {cookies.map((c: any, i: number) => (
            <div key={i} style={{ marginBottom:12 }}>
              <Lbl>{c.label} {c.hasValue && <span style={{ color:P.green }}>●</span>}</Lbl>
              <input placeholder={c.hasValue ? 'Valor actual (***...) — cole o novo valor para actualizar' : 'Cole o valor aqui'} onChange={e=>setUpdates(x=>({...x,[c.key]:e.target.value}))} style={INP} />
            </div>
          ))}
          <Btn onClick={saveCookies} disabled={Object.keys(updates).length===0}>{saved ? '✓ Guardado' : 'Guardar Alterações'}</Btn>
        </Panel>
        <Panel><STitle>Backup da Base de Dados</STitle>
          <div style={{ color:P.textDim, fontSize:11, marginBottom:14 }}>A base de dados SQLite é guardada localmente. Crie cópias de segurança regulares.</div>
          <Btn onClick={createBackup} disabled={backupLoading} style={{ marginBottom:16, width:'100%' }}>{backupLoading ? 'A criar...' : 'Criar Backup Agora'}</Btn>
          {backups.length > 0 && <div><Lbl>Backups existentes ({backups.length})</Lbl>
            {backups.slice(0,5).map((b: any, i: number) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid '+P.border }}>
                <div><div style={{ color:P.text, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{b.name}</div><div style={{ color:P.textDim, fontSize:10 }}>{(b.size/1024).toFixed(1)} KB — {new Date(b.date).toLocaleString('pt-PT')}</div></div>
                <Btn variant="ghost" size="sm" onClick={()=>restoreBackup(b.name)}>Restaurar</Btn>
              </div>
            ))}
          </div>}
        </Panel>
      </div>
      <Panel>
        <STitle>Informação do Sistema</STitle>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
          {[['Sistema Operacional', typeof navigator !== 'undefined' ? navigator.platform : 'N/A'],['Motor','Next.js + Bun'],['Base de Dados','SQLite (local)'],['Versão','2.0.77'],['Idioma','Português (PT-PT)'],['Instalação','PC único (local)']].map(([l,v])=>(
            <div key={String(l)}><Lbl>{l}</Lbl><div style={{ color:P.text, fontSize:13 }}>{v}</div></div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function MainApp() {
  const { activeTab, setActiveTab } = useMBAStore();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dashData, setDashData] = useState<any>(null);
  const [notif, setNotif] = useState<any>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [clock, setClock] = useState('');
  const [sessionStart] = useState(Date.now());
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [bulkAction, setBulkAction] = useState('');

  useEffect(() => { const iv = setInterval(()=>setClock(new Date().toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})), 1000); return ()=>clearInterval(iv); }, []);

  const loadDash = useCallback(async () => {
    try { const r = await fetch('/api/dashboard'); if (r.ok) setDashData(await r.json()); } catch {}
  }, []);
  useEffect(() => { loadDash(); const iv = setInterval(loadDash, 30000); return ()=>clearInterval(iv); }, [loadDash]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try { const r = await fetch('/api/notifications'); const d = await r.json(); setNotif(d); } catch {}
    }, 20000);
    return ()=>clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(async () => { try { await fetch('/api/auto-followup'); } catch {} }, 60000);
    return ()=>clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(async () => { try { await fetch('/api/scheduled-check'); } catch {} }, 30000);
    return ()=>clearInterval(iv);
  }, []);

  const doLogout = () => { storeSet('mba_session', ''); window.location.reload(); };

  const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  const doBulkAction = async () => {
    if (!bulkAction || !selectedProfile) return;
    if (bulkAction === 'delete') {
      for (const p of profiles) {
        if (p._selected) await fetch('/api/profiles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:p.id, status:'blacklisted' }) });
      }
    } else {
      for (const p of profiles) {
        if (p._selected) await fetch('/api/profiles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:p.id, status:bulkAction }) });
      }
    }
    setBulkAction(''); loadDash();
  };

  return (
    <div style={{ width:'100vw', height:'100vh', background:P.bg, display:'flex', flexDirection:'column', fontFamily:"'Inter',sans-serif" }}>
      <div data-role="header" className="mba-header-inner" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid '+P.border, background:P.surface, flexShrink:0, gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontFamily:"'Orbitron',sans-serif", fontWeight:900, color:P.red, fontSize:16, letterSpacing:2 }}>MBA</span>
          <span className="mba-hide-mobile" style={{ color:P.textDim, fontSize:10, letterSpacing:2 }}>MWANGO BRAIN AGENT</span>
        </div>
        <div className="mba-tabs" style={{ display:'flex', gap:4, overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'7px 10px', borderRadius:6, border:'1px solid '+(activeTab===t.id?P.red:P.border), background:activeTab===t.id?P.redDim:'transparent', color:activeTab===t.id?P.redB:P.textSec, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif", letterSpacing:0.3, transition:'all .15s', whiteSpace:'nowrap' }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ position:'relative', cursor:'pointer' }} onClick={()=>setShowNotif(!showNotif)}>
            <div style={{ fontSize:16, lineHeight:1 }}>🔔</div>
            {(notif?.unreadCount || 0) > 0 && <div style={{ position:'absolute', top:-4, right:-6, width:16, height:16, borderRadius:8, background:P.red, color:'white', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{notif.unreadCount}</div>}
            {showNotif && <div style={{ position:'absolute', top:24, right:0, width:280, background:P.surface, border:'1px solid '+P.borderHi, borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', zIndex:50, maxHeight:300, overflowY:'auto' }}>
              <div style={{ padding:'10px 12px', borderBottom:'1px solid '+P.border }}><STitle>Notificações</STitle></div>
              {(!notif?.messages || notif.messages.length === 0) && <div style={{ padding:20, textAlign:'center', color:P.textDim, fontSize:11 }}>Sem notificações</div>}
              {(notif?.messages || []).slice(0,10).map((m: any, i: number) => (
                <div key={i} style={{ padding:'10px 12px', borderBottom:'1px solid '+P.border }}>
                  <div style={{ color:P.redB, fontSize:11, fontWeight:600 }}>{m.profile?.username || 'Desconhecido'}</div>
                  <div style={{ color:P.textSec, fontSize:11, marginTop:2 }}>{m.content?.slice(0,60)}...</div>
                </div>
              ))}
            </div>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, className:'mba-hide-mobile' }}><div style={{ width:6, height:6, borderRadius:'50%', background:P.green, boxShadow:'0 0 8px '+P.green }} /><span style={{ color:P.textDim, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{clock}</span></div>
          <button onClick={doLogout} style={{ padding:'5px 10px', borderRadius:4, border:'1px solid rgba(255,60,60,0.3)', background:'rgba(255,60,60,0.06)', color:'#ff6b6b', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:"'Inter',sans-serif" }}>SAIR</button>
        </div>
      </div>

      <div data-role="main" style={{ flex:1, overflow:'hidden' }}>
        {activeTab==='dashboard' && <DashboardTab dashData={dashData} />}
        {activeTab==='prospecting' && <ProspectingTab profiles={profiles} setProfiles={setProfiles} />}
        {activeTab==='messages' && <MessagesTab profiles={profiles} setProfiles={setProfiles} />}
        {activeTab==='followups' && <FollowUpsTab />}
        {activeTab==='inbox' && <InboxTab />}
        {activeTab==='agent' && <AgentChatTab profiles={profiles} />}
        {activeTab==='campaigns' && <CampaignsTab />}
        {activeTab==='analytics' && <AnalyticsTab />}
        {activeTab==='activity' && <ActivityTab />}
        {activeTab==='config' && <ConfigTab />}
      </div>

      <div data-role="footer" style={{ padding:'6px 16px', borderTop:'1px solid '+P.border, display:'flex', justifyContent:'space-between', fontSize:9, color:P.textDim, flexShrink:0 }}>
        <span>LUANDA · ANGOLA · mwangobrain.com</span>
        <span className="mba-hide-mobile">SESSÃO {hh}:{mm}:{ss}</span>
      </div>

      {selectedProfile && <ProfileDetailModal profile={selectedProfile} onClose={()=>setSelectedProfile(null)} onUpdate={loadDash} />}
    </div>
  );
}

export default function Home() {
  const isAuthenticated = useMBAStore(s => s.isAuthenticated);
  const sessionRestored = useMBAStore(s => s.sessionRestored);
  const setAuthenticated = useMBAStore(s => s.setAuthenticated);

  useEffect(() => {
    const saved = storeGet('mba_session');
    if (saved && !isAuthenticated) {
      setAuthenticated(true, saved);
    }
  }, []);

  if (!isAuthenticated) return <LoginScreen />;
  return <MainApp />;
}