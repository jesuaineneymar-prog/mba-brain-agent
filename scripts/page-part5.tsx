function ScheduledMessagesTab() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [queueInfo, setQueueInfo] = useState<any>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/send-message');
      const d = await r.json();
      setScheduled(d.scheduled || []);
      setQueueInfo(d);
    } catch {}
  };
  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, []);

  return (
    <div>
      {queueInfo && <Panel style={{ marginBottom:14 }}>
        <STitle>Estado da Fila</STitle>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <div><Lbl>Enviadas hoje</Lbl><span style={{ color:P.text, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{queueInfo.sentToday} / {queueInfo.maxPerDay}</span></div>
          <div><Lbl>Restantes hoje</Lbl><span style={{ color:P.green, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{queueInfo.remainingToday}</span></div>
          <div><Lbl>Na fila</Lbl><span style={{ color:P.orange, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{queueInfo.queueLength}</span></div>
        </div>
        <Bar value={queueInfo.sentToday} max={queueInfo.maxPerDay} h={6} />
      </Panel>}
      <Panel><STitle>Mensagens Agendadas ({scheduled.length})</STitle>
        {scheduled.length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Nenhuma mensagem agendada</div> : scheduled.map((m: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid '+P.border }}>
            <div><div style={{ color:P.redB, fontSize:12, fontWeight:600 }}>{m.profile?.username || 'Desconhecido'}</div><div style={{ color:P.textDim, fontSize:11 }}>{m.content?.slice(0,60)}...</div></div>
            <div style={{ textAlign:'right' }}><div style={{ color:P.textSec, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(m.scheduledAt).toLocaleString('pt-PT')}</div><span style={{ color:P.orange, fontSize:10 }}>{m.profile?.platform || ''}</span></div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function FollowUpsTab() {
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [form, setForm] = useState({ profileId:'', username:'', platform:'', notes:'', message:'', scheduledAt:'' });

  const load = async () => { try { const r = await fetch('/api/followups'); const d = await r.json(); setFollowUps(d.followUps||[]); } catch {} };
  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, []);

  const create = async () => {
    if (!form.message) return;
    await fetch('/api/followups', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...form, scheduledAt: form.scheduledAt || new Date().toISOString() }) });
    setForm({ profileId:'', username:'', platform:'', notes:'', message:'', scheduledAt:'' }); load();
  };

  const complete = async (id: string) => { await fetch('/api/followups', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, status:'completed', sentAt: new Date().toISOString() }) }); load(); };
  const remove = async (id: string) => { await fetch('/api/followups?id='+id, { method:'DELETE' }); load(); };

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'minmax(280px,1fr) 2fr', gap:16 }}>
        <Panel><STitle>Criar Follow-up</STitle>
          <div style={{ marginBottom:12 }}><Lbl>Nome de utilizador</Lbl><input value={form.username} onChange={e=>setForm(x=>({...x,username:e.target.value}))} placeholder="@utilizador" style={INP} /></div>
          <div style={{ marginBottom:12 }}><Lbl>Plataforma</Lbl><select value={form.platform} onChange={e=>setForm(x=>({...x,platform:e.target.value}))} style={INP}><option value="">Seleccionar</option>{['instagram','facebook','linkedin','tiktok'].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
          <div style={{ marginBottom:12 }}><Lbl>Agendar para</Lbl><input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm(x=>({...x,scheduledAt:e.target.value}))} style={INP} /></div>
          <div style={{ marginBottom:12 }}><Lbl>Notas</Lbl><input value={form.notes} onChange={e=>setForm(x=>({...x,notes:e.target.value}))} placeholder="Notas internas" style={INP} /></div>
          <div style={{ marginBottom:14 }}><Lbl>Mensagem</Lbl><textarea value={form.message} onChange={e=>setForm(x=>({...x,message:e.target.value}))} rows={4} placeholder="Mensagem do follow-up..." style={{ width:'100%', padding:'10px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:12, outline:'none', resize:'vertical' }} /></div>
          <Btn onClick={create} disabled={!form.message}>Criar Follow-up</Btn>
          <div style={{ marginTop:14, padding:10, background:P.surface2, borderRadius:6 }}><span style={{ color:P.green, fontSize:11 }}>Follow-ups pendentes: {followUps.filter(f=>f.status==='pending').length}</span></div>
        </Panel>
        <Panel>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Follow-ups ({followUps.length})</STitle></div>
          {followUps.length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:48 }}>Sem follow-ups criados</div> : followUps.map((fu: any, i: number) => (
            <div key={i} style={{ padding:12, background:P.surface2, borderRadius:8, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div><span style={{ color:P.redB, fontWeight:700 }}>{fu.username}</span><span style={{ color:P.textDim, fontSize:11, marginLeft:8, textTransform:'capitalize' }}>{fu.platform}</span><StatusBadge status={fu.status} /></div>
                <div style={{ display:'flex', gap:6 }}>
                  {fu.status==='pending' && <Btn variant="ghost" size="sm" onClick={()=>complete(fu.id)}>Completar</Btn>}
                  <Btn variant="danger" size="sm" onClick={()=>remove(fu.id)}>✕</Btn>
                </div>
              </div>
              {fu.message && <div style={{ color:P.textSec, fontSize:11, lineHeight:1.4, marginBottom:4, whiteSpace:'pre-wrap' }}>{fu.message}</div>}
              {fu.notes && <div style={{ color:P.textDim, fontSize:10, marginBottom:4 }}>Nota: {fu.notes}</div>}
              <div style={{ color:P.textDim, fontSize:10 }}>Agendado: {new Date(fu.scheduledAt).toLocaleString('pt-PT')}</div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function InboxTab() {
  const [messages, setMessages] = useState<any[]>([]);
  const [metaConvs, setMetaConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await fetch('/api/inbox');
      const d = await r.json();
      setMessages(d.messages || []);
      setMetaConvs(d.metaConversations || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <Panel style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Conversações Meta (Facebook)</STitle></div>
        {metaConvs.length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Sem conversações Meta. Verifique o token de acesso.</div> : metaConvs.map((c: any, i: number) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid '+P.border }}>
            <div><span style={{ color:P.text, fontWeight:600, fontSize:12 }}>{c.participant}</span><div style={{ color:P.textSec, fontSize:11, marginTop:2 }}>{c.snippet?.slice(0,80)}</div></div>
            <div style={{ textAlign:'right' }}><span style={{ color:P.textDim, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{c.updatedTime ? new Date(c.updatedTime).toLocaleDateString('pt-PT') : ''}</span></div>
          </div>
        ))}
      </Panel>
      <Panel>
        <STitle>Mensagens Recebidas ({messages.length})</STitle>
        {loading ? <div style={{ color:P.textDim, textAlign:'center', padding:24 }}>A carregar...</div> :
        messages.length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Nenhuma mensagem recebida</div> : messages.map((m: any, i: number) => (
          <div key={i} style={{ padding:12, background:P.surface2, borderRadius:8, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <div><span style={{ color:P.redB, fontWeight:700 }}>{m.profile?.username || 'Desconhecido'}</span><span style={{ color:P.textDim, fontSize:11, marginLeft:8, textTransform:'capitalize' }}>{m.profile?.platform || ''}</span></div>
              <span style={{ color:P.textDim, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(m.sentAt).toLocaleString('pt-PT')}</span>
            </div>
            <div style={{ color:P.text, fontSize:12, lineHeight:1.5 }}>{m.content}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}