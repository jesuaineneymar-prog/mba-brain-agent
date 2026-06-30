function AgentChatTab({ profiles }: { profiles: any[] }) {
  const [history, setHistory] = useState<any[]>([]);
  const [inp, setInp] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:'smooth'}); },[history]);

  const send = async () => {
    if (!inp.trim() || loading) return;
    const txt = inp.trim(); setInp(''); setLoading(true);
    const h = [...history, {role:'user',content:txt}]; setHistory(h);
    try {
      const body: any = { message:txt, conversationHistory: history.slice(-14) };
      if (selectedProfile) { body.profileId = selectedProfile; }
      const res = await fetch('/api/respond', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      const data = await res.json();
      setHistory([...h, {role:'assistant',content:data.reply}]);
    } catch(e: any) { setHistory([...h, {role:'assistant',content:'Erro: '+e.message}]); }
    setLoading(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:16 }}>
      <div style={{ display:'flex', gap:8, marginBottom:12, flexShrink:0 }}>
        <select value={selectedProfile} onChange={e=>setSelectedProfile(e.target.value)} style={{ ...INP, width:'auto', maxWidth:300, fontSize:11 }}>
          <option value="">Conversa geral</option>
          {profiles.slice(0,30).map((p: any, i: number) => <option key={i} value={p.id}>{p.handle||p.username} ({p.platform})</option>)}
        </select>
      </div>
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:12, marginBottom:12 }}>
        {history.length === 0 && <div style={{ textAlign:'center', padding:48, color:P.textDim }}>
          <div style={{ fontSize:24, opacity:0.15, marginBottom:12 }}>MBA</div>
          <div style={{ fontSize:13 }}>Selecione um perfil ou escreva directamente.</div>
          <div style={{ fontSize:11, marginTop:6, color:P.textDim }}>O agente responde em Português de Portugal.</div>
        </div>}
        {history.map((m,i)=><div key={i} style={{ display:'flex', justifyContent:m.role==='user'?'flex-end':'flex-start', gap:8, alignItems:'flex-start' }}>
          {m.role==='assistant' && <div style={{ width:26, height:26, borderRadius:6, background:P.redDim, border:'1px solid '+P.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, color:P.red, flexShrink:0, fontWeight:700, fontFamily:"'Orbitron',sans-serif" }}>MBA</div>}
          <div style={{ maxWidth:'75%', padding:'11px 14px', borderRadius:m.role==='user'?'10px 10px 2px 10px':'10px 10px 10px 2px', background:m.role==='user'?P.redDim:P.surface, border:'1px solid '+(m.role==='user'?P.borderHi:P.border), color:P.text, fontSize:13, lineHeight:1.65 }}>{m.content}</div>
        </div>)}
        {loading && <div style={{ display:'flex', gap:6, padding:'11px 14px', background:P.surface, border:'1px solid '+P.border, borderRadius:'10px 10px 10px 2px', width:'fit-content' }}><div style={{ width:6, height:6, borderRadius:'50%', background:P.red, animation:'blink 1s ease-in-out 0s infinite' }} /><div style={{ width:6, height:6, borderRadius:'50%', background:P.red, animation:'blink 1s ease-in-out 0.2s infinite' }} /><div style={{ width:6, height:6, borderRadius:'50%', background:P.red, animation:'blink 1s ease-in-out 0.4s infinite' }} /></div>}
        <div ref={endRef} />
      </div>
      <div style={{ display:'flex', gap:8, flexShrink:0 }}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()} placeholder="Escreva a sua mensagem..." style={{ flex:1, padding:'11px 14px', background:P.surface, border:'1px solid '+P.border, borderRadius:8, color:P.text, fontSize:13, outline:'none', fontFamily:"'Inter',sans-serif" }} />
        <Btn onClick={send} disabled={loading}>Enviar</Btn>
      </div>
    </div>
  );
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', platform:'all', targetCount:200, minFollowers:1000, maxFollowers:50000, maxPerDay:30 });

  const load = async () => { try { const r = await fetch('/api/campaigns'); const d = await r.json(); setCampaigns(d.campaigns||[]); } catch {} };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return;
    await fetch('/api/campaigns', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...form, status:'pending' }) });
    setForm({ name:'', platform:'all', targetCount:200, minFollowers:1000, maxFollowers:50000, maxPerDay:30 }); setShowForm(false); load();
  };

  const updateStatus = async (id: string, status: string) => { await fetch('/api/campaigns', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, status }) }); load(); };
  const remove = async (id: string) => { await fetch('/api/campaigns?id='+id, { method:'DELETE' }); load(); };

  const statusLabel: Record<string, { c:string; l:string }> = { pending:{c:P.textSec,l:'Pendente'}, running:{c:P.green,l:'Em curso'}, completed:{c:P.blue,l:'Concluída'}, paused:{c:P.orange,l:'Pausada'} };

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <STitle>Campanhas ({campaigns.length})</STitle>
        <Btn onClick={()=>setShowForm(!showForm)}>{showForm?'Cancelar':'Nova Campanha'}</Btn>
      </div>
      {showForm && <Panel style={{ marginBottom:16 }}>
        <STitle>Criar Campanha</STitle>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div><Lbl>Nome</Lbl><input value={form.name} onChange={e=>setForm(x=>({...x,name:e.target.value}))} placeholder="Nome da campanha" style={INP} /></div>
          <div><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm(x=>({...x,platform:e.target.value}))} style={INP}><option value="all">Todas</option>{['instagram','facebook','linkedin','tiktok'].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          <div><Lbl>Alvo</Lbl><input type="number" value={form.targetCount} onChange={e=>setForm(x=>({...x,targetCount:+e.target.value}))} style={INP} /></div>
          <div><Lbl>Máx/dia</Lbl><input type="number" value={form.maxPerDay} onChange={e=>setForm(x=>({...x,maxPerDay:+e.target.value}))} style={INP} /></div>
        </div>
        <Btn onClick={create} disabled={!form.name}>Criar Campanha</Btn>
      </Panel>}
      {campaigns.length === 0 ? <Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}>Sem campanhas criadas. As campanhas são criadas automaticamente ao prospectar.</div></Panel> : campaigns.map((c: any, i: number) => {
        const st = statusLabel[c.status] || { c:P.textDim, l:c.status };
        return (
          <Panel key={i} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
              <div><span style={{ color:P.text, fontWeight:700, fontSize:14 }}>{c.name}</span><span style={{ marginLeft:10, padding:'2px 8px', borderRadius:3, background:st.c+'18', border:'1px solid '+st.c+'44', color:st.c, fontSize:10, fontWeight:600 }}>{st.l}</span></div>
              <div style={{ display:'flex', gap:6 }}>
                {c.status==='pending'&&<Btn variant="ghost" size="sm" onClick={()=>updateStatus(c.id,'running')}>Iniciar</Btn>}
                {c.status==='running'&&<Btn variant="ghost" size="sm" onClick={()=>updateStatus(c.id,'paused')}>Pausar</Btn>}
                {c.status==='paused'&&<Btn variant="ghost" size="sm" onClick={()=>updateStatus(c.id,'running')}>Retomar</Btn>}
                {c.status!=='completed'&&<Btn variant="ghost" size="sm" onClick={()=>updateStatus(c.id,'completed')}>Concluir</Btn>}
                <Btn variant="danger" size="sm" onClick={()=>remove(c.id)}>Eliminar</Btn>
              </div>
            </div>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:11, color:P.textSec }}>
              <span>Plataforma: <b style={{ color:P.text, textTransform:'capitalize' }}>{c.platform}</b></span>
              <span>Perfis: <b style={{ color:P.text }}>{c._count?.profiles || 0}</b></span>
              <span>Enviadas: <b style={{ color:P.orange }}>{c.sentCount}</b></span>
              <span>Respostas: <b style={{ color:P.green }}>{c.repliedCount}</b></span>
              <span>Criada: <b style={{ color:P.text }}>{new Date(c.createdAt).toLocaleDateString('pt-PT')}</b></span>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}