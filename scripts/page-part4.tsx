function MessagesTab({ profiles, setProfiles }: { profiles:any[]; setProfiles:(p:any[])=>void }) {
  const [subTab, setSubTab] = useState('send');
  const [selected, setSelected] = useState<string[]>([]);
  const [template, setTemplate] = useState(PROPOSTA);
  const [status, setStatus] = useState('idle');
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [abGroup, setAbGroup] = useState('');
  const [abVariants, setAbVariants] = useState<any[]>([]);
  const [abStats, setAbStats] = useState<Record<string,{sent:number;replies:number}>>({});
  const [newVar, setNewVar] = useState({ name:'', group:'A', content:'' });
  const [templates, setTemplates] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem('mba_templates')||'[]'); } catch { return []; } });
  const [showNotif, setShowNotif] = useState(false);
  const [notifData, setNotifData] = useState<any>(null);

  const togSel = (id:string) => setSelected(s => s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const selAll = () => setSelected(profiles.map(p=>p.id));
  const deselAll = () => setSelected([]);

  const loadAB = async () => { try { const r = await fetch('/api/ab-test'); const d = await r.json(); setAbVariants(d.variants||[]); setAbStats(d.groupStats||{}); } catch {} };
  useEffect(() => { if (subTab==='ab') loadAB(); }, [subTab]);
  const saveTemplates = (t: any[]) => { setTemplates(t); localStorage.setItem('mba_templates', JSON.stringify(t)); };

  const start = async () => {
    if (!selected.length) return;
    const sel = profiles.filter(p => selected.includes(p.id));
    setStatus('sending'); setLog(['A enviar mensagens via API...','— '+getMsgCount()+' / '+LIMIT_DIARIO+' enviadas hoje','— A enviar: '+sel.length]); setProgress(0); setSent(0); setError('');
    for (let i = 0; i < sel.length; i++) {
      if (i > 0 && i % 10 === 0) { const pause = Math.floor(Math.random()*(300000-180000+1))+180000; setLog(l=>[...l.slice(-5),'⏸ Pausa de protecção — '+Math.round(pause/1000)+'s']); await new Promise(r=>setTimeout(r, pause)); }
      setLog(l=>[...l.slice(-5),'A enviar para '+(sel[i].handle||sel[i].username)+' ('+(i+1)+'/'+sel.length+')...']);
      try {
        const body: any = { profileId:sel[i].id, message:template.replace('{nome}',sel[i].displayName||sel[i].handle||sel[i].username), platform:sel[i].platform, username:sel[i].handle||sel[i].username };
        if (scheduleDate) body.scheduledAt = new Date(scheduleDate).toISOString();
        if (abGroup) body.abTestGroup = abGroup;
        const res = await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { setSent(s=>s+1); incMsgCount(); }
        setLog(l=>[...l.slice(-5), data.scheduled?'✓ Agendado':'✓ Processado']);
      } catch(e: any) { setLog(l=>[...l.slice(-5), '⚠ Erro: '+e.message]); }
      setProgress(Math.round(((i+1)/sel.length)*100));
      if (i < sel.length-1) { const delay = Math.floor(Math.random()*(DELAY_MAX-DELAY_MIN+1))+DELAY_MIN; await new Promise(r=>setTimeout(r, delay)); }
    }
    setStatus('done'); setLog(l=>[...l, '✓ '+sent+' mensagens processadas.']);
  };

  const createVariant = async () => {
    if (!newVar.name || !newVar.content) return;
    await fetch('/api/ab-test', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:newVar.name, group:newVar.group, content:newVar.content }) });
    setNewVar({ name:'', group:String.fromCharCode(65+abVariants.length), content:'' }); loadAB();
  };

  const startBulk = async () => {
    if (!selected.length || !abVariants.length) return;
    const sel = profiles.filter(p => selected.includes(p.id));
    setStatus('sending'); setLog(['A enviar com Teste A/B...']); setProgress(0); setSent(0);
    const active = abVariants.filter(v => v.isActive);
    for (let i = 0; i < sel.length; i++) {
      const variant = active[i % active.length];
      const msg = variant.content.replace('{nome}', sel[i].displayName || sel[i].handle || sel[i].username);
      try {
        await fetch('/api/send-message', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ profileId:sel[i].id, message:msg, platform:sel[i].platform, username:sel[i].handle||sel[i].username, abTestGroup:variant.groupName }) });
        setSent(s=>s+1); incMsgCount();
      } catch {}
      setProgress(Math.round(((i+1)/sel.length)*100));
      if (i < sel.length-1) { await new Promise(r=>setTimeout(r, Math.floor(Math.random()*(DELAY_MAX-DELAY_MIN+1))+DELAY_MIN)); }
    }
    setStatus('done'); setLog(l=>[...l, '✓ '+sent+' mensagens enviadas via A/B.']);
  };

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'1px solid '+P.border, paddingBottom:8 }}>
        {[['send','Enviar'],['ab','Teste A/B'],['templates','Templates'],['scheduled','Agendadas']].map(([id,l])=>(
          <button key={id} onClick={()=>setSubTab(id)} style={{ padding:'6px 14px', borderRadius:5, border:'none', background:subTab===id?P.redDim:'transparent', color:subTab===id?P.redB:P.textSec, fontSize:11, fontWeight:600, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {subTab==='send' && <div>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <Panel><STitle>Proposta a Enviar</STitle>
            <textarea value={template} onChange={e=>setTemplate(e.target.value)} rows={8} style={{ width:'100%', padding:'10px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:12, outline:'none', lineHeight:1.7, fontFamily:"'Inter',sans-serif", resize:'vertical' }} />
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              <Btn variant="ghost" size="sm" onClick={()=>saveTemplates([...templates,{name:'Template '+(templates.length+1),content:template,createdAt:new Date().toISOString()}])}>Guardar como template</Btn>
              {abVariants.filter(v=>v.isActive).length > 0 && <select value={abGroup} onChange={e=>setAbGroup(e.target.value)} style={{ ...INP, width:'auto', fontSize:11 }}><option value="">Sem grupo A/B</option>{abVariants.filter(v=>v.isActive).map(v=><option key={v.id} value={v.groupName}>Grupo {v.groupName}: {v.name}</option>)}</select>}
            </div>
          </Panel>
          <Panel><STitle>Protecção Anti-Bloqueio</STitle>
            {[['Intervalo entre mensagens','45 a 90 seg. (aleatório)'],['Pausa após 10 mensagens','3 a 5 minutos'],['Limite diário',getMsgCount()+' / '+LIMIT_DIARIO+' enviadas hoje'],['Personalização automática','Nome de cada perfil'],['Agendamento',scheduleDate?'Para '+new Date(scheduleDate).toLocaleString('pt-PT'):'Não agendado']].map(([l,v])=>(
              <div key={String(l)} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid '+P.border }}><span style={{ color:P.textSec, fontSize:12 }}>{l}</span><span style={{ color:P.text, fontSize:12, fontWeight:600 }}>{v}</span></div>
            ))}
            <div style={{ marginTop:12 }}><Lbl>Agendar para</Lbl><input type="datetime-local" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)} style={INP} /></div>
          </Panel>
        </div>
        {(status==='sending'||status==='done') && <Panel style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><STitle>Progresso</STitle><span style={{ color:P.red, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{Math.round(progress)}%</span></div>
          <Bar value={progress} max={100} h={4} />
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, maxHeight:100, overflowY:'auto', marginTop:10 }}>{log.map((l,i)=><div key={i} style={{ color:i===log.length-1?P.text:P.textSec, marginBottom:2, lineHeight:1.5 }}>{l}</div>)}</div>
          {status==='done' && <div style={{ color:P.green, fontSize:12, fontWeight:600, marginTop:8 }}>✓ {sent} mensagens processadas.</div>}
        </Panel>}
        {!profiles.length ? <Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}>Execute uma prospecção primeiro.</div></Panel> : <Panel>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
            <STitle>{selected.length} de {profiles.length} seleccionados</STitle>
            <div style={{ display:'flex', gap:8 }}><Btn variant="ghost" size="sm" onClick={selAll}>Todos</Btn><Btn variant="ghost" size="sm" onClick={deselAll}>Nenhum</Btn><Btn size="sm" disabled={!selected.length||status==='sending'} onClick={start}>{status==='sending'?'A processar…':'Enviar ('+selected.length+')'}</Btn></div>
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }}>{profiles.map((p,i)=><div key={i} onClick={()=>togSel(p.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid '+P.border, cursor:'pointer', background:selected.includes(p.id)?P.redDim:'transparent', borderRadius:4, transition:'background .1s' }}>
            <div style={{ width:18, height:18, borderRadius:4, border:'1px solid '+(selected.includes(p.id)?P.red:P.border), background:selected.includes(p.id)?P.red:'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{selected.includes(p.id) && <span style={{ color:'white', fontSize:11 }}>✓</span>}</div>
            <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, textDecoration:'none', flex:1 }}>{p.handle||p.username}</a>
            <span style={{ color:P.textSec, fontSize:11, textTransform:'capitalize' }}>{p.platform}</span>
            <span style={{ color:P.textSec, fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>{(p.followers||0).toLocaleString('pt-PT')}</span>
          </div>)}</div>
        </Panel>}
      </div>}

      {subTab==='ab' && <div>
        <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <Panel><STitle>Criar Variante</STitle>
            <div style={{ marginBottom:12 }}><Lbl>Nome</Lbl><input value={newVar.name} onChange={e=>setNewVar(x=>({...x,name:e.target.value}))} placeholder="ex: Proposta curta" style={INP} /></div>
            <div style={{ marginBottom:12 }}><Lbl>Grupo</Lbl>
              <div style={{ display:'flex', gap:6 }}>{['A','B','C','D'].map(g=><button key={g} onClick={()=>setNewVar(x=>({...x,group:g}))} style={{ padding:'5px 14px', borderRadius:4, border:'1px solid '+(newVar.group===g?P.red:P.border), background:newVar.group===g?P.redDim:'transparent', color:newVar.group===g?P.redB:P.textSec, fontSize:12, fontWeight:700, cursor:'pointer' }}>{g}</button>)}</div>
            </div>
            <div style={{ marginBottom:12 }}><Lbl>Conteúdo</Lbl><textarea value={newVar.content} onChange={e=>setNewVar(x=>({...x,content:e.target.value}))} rows={5} placeholder="Escreva a variante da mensagem..." style={{ width:'100%', padding:'10px 13px', background:P.surface2, border:'1px solid '+P.border, borderRadius:6, color:P.text, fontSize:12, outline:'none', lineHeight:1.6, resize:'vertical' }} /></div>
            <Btn onClick={createVariant} disabled={!newVar.name||!newVar.content}>Criar Variante</Btn>
          </Panel>
          <Panel><STitle>Estatísticas por Grupo</STitle>
            {Object.keys(abStats).length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Crie variantes e envie mensagens</div> : Object.entries(abStats).map(([group, stats]) => (
              <div key={group} style={{ marginBottom:16, padding:12, background:P.surface2, borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><span style={{ color:P.redB, fontWeight:700 }}>Grupo {group}</span><span style={{ color:P.green, fontSize:11 }}>{stats.sent > 0 ? Math.round((stats.replies/stats.sent)*100)+'% resposta' : '—'}</span></div>
                <div style={{ display:'flex', gap:16 }}><span style={{ color:P.textSec, fontSize:11 }}>Enviadas: <b style={{ color:P.text }}>{stats.sent}</b></span><span style={{ color:P.textSec, fontSize:11 }}>Respostas: <b style={{ color:P.green }}>{stats.replies}</b></span></div>
              </div>
            ))}
          </Panel>
        </div>
        <Panel>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><STitle>Variantes ({abVariants.length})</STitle>
            {abVariants.filter(v=>v.isActive).length >= 2 && selected.length > 0 && <Btn size="sm" onClick={startBulk}>Enviar A/B ({selected.length})</Btn>}
          </div>
          {abVariants.map(v=>(
            <div key={v.id} style={{ padding:12, background:v.isActive?P.redDim:'transparent', border:'1px solid '+(v.isActive?P.borderHi:P.border), borderRadius:8, marginBottom:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <div><span style={{ color:P.redB, fontWeight:700 }}>Grupo {v.groupName}</span><span style={{ color:P.textDim, fontSize:11, marginLeft:8 }}>{v.name}</span></div>
                <div style={{ display:'flex', gap:6 }}><Btn variant="ghost" size="sm" onClick={async()=>{await fetch('/api/ab-test',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:v.id,isActive:!v.isActive})});loadAB();}}>{v.isActive?'Desactivar':'Activar'}</Btn><Btn variant="danger" size="sm" onClick={async()=>{await fetch('/api/ab-test?id='+v.id,{method:'DELETE'});loadAB();}}>✕</Btn></div>
              </div>
              <div style={{ color:P.textSec, fontSize:11, lineHeight:1.5, whiteSpace:'pre-wrap', maxHeight:60, overflow:'hidden' }}>{v.content}</div>
            </div>
          ))}
        </Panel>
      </div>}

      {subTab==='templates' && <Panel>
        <STitle>Templates Guardados ({templates.length})</STitle>
        {templates.length === 0 ? <div style={{ color:P.textDim, fontSize:12, textAlign:'center', padding:24 }}>Sem templates guardados</div> : templates.map((t: any, i: number) => (
          <div key={i} style={{ padding:12, background:P.surface2, borderRadius:8, marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ color:P.text, fontWeight:600, fontSize:12 }}>{t.name}</span>
              <div style={{ display:'flex', gap:6 }}><Btn variant="ghost" size="sm" onClick={()=>setTemplate(t.content)}>Usar</Btn><Btn variant="danger" size="sm" onClick={()=>saveTemplates(templates.filter((_,j)=>j!==i))}>✕</Btn></div>
            </div>
            <div style={{ color:P.textSec, fontSize:11, lineHeight:1.4, whiteSpace:'pre-wrap', maxHeight:40, overflow:'hidden' }}>{t.content}</div>
          </div>
        ))}
      </Panel>}

      {subTab==='scheduled' && <ScheduledMessagesTab />}
    </div>
  );
}