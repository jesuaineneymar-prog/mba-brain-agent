function ProfileDetailModal({ profile, onClose, onUpdate }: { profile: any; onClose:()=>void; onUpdate?:()=>void }) {
  const [status, setStatus] = useState(profile.status);
  const [notes, setNotes] = useState(profile.notes || '');
  const changeStatus = async (newStatus: string) => {
    setStatus(newStatus);
    await fetch('/api/profiles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:profile.id, status:newStatus }) });
    onUpdate?.();
  };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:P.surface, border:'1px solid '+P.borderHi, borderRadius:12, padding:24, maxWidth:600, width:'100%', maxHeight:'80vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <STitle>{profile.username || profile.handle}</STitle>
          <button onClick={onClose} style={{ background:'none', border:'none', color:P.textSec, fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          {[['Plataforma',profile.platform],['Seguidores',(profile.followers||0).toLocaleString('pt-PT')],['Score',String(profile.score)],['Categoria',profile.category||'N/A'],['Localização',profile.location||'N/A'],['Posts',String(profile.postsCount||0)]].map(([l,v])=>(
            <div key={String(l)}><Lbl>{l}</Lbl><div style={{ color:P.text, fontSize:13 }}>{v}</div></div>
          ))}
        </div>
        <div style={{ marginBottom:16 }}><Lbl>Estado</Lbl>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{['prospect','contacted','replied','accepted','rejected','blacklisted'].map(s=>(
            <button key={s} onClick={()=>changeStatus(s)} style={{ padding:'4px 10px', borderRadius:4, border:'1px solid '+(status===s?(statusColors[s]||P.red):P.border), background:status===s?(statusColors[s]||P.red)+'18':'transparent', color:status===s?(statusColors[s]||P.red):P.textSec, fontSize:11, cursor:'pointer', textTransform:'capitalize' }}>{s}</button>
          ))}</div>
        </div>
        <div style={{ marginBottom:16 }}><Lbl>Notas</Lbl><textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={async()=>{ await fetch('/api/profiles', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:profile.id, notes }) }); }} rows={3} style={INP} /></div>
        <div><STitle>Score</STitle><Bar value={profile.score} max={100} color={profile.score>=80?P.green:profile.score>=65?P.red:P.textSec} h={12} /></div>
      </div>
    </div>
  );
}
const statusColors: Record<string, string> = { prospect: P.textSec, contacted: P.orange, replied: P.blue, accepted: P.green, rejected: '#ff6b6b', blacklisted: '#666' };

function ProspectingTab({ profiles, setProfiles }: { profiles:any[]; setProfiles:(p:any[])=>void }) {
  const plats = ['instagram','facebook','linkedin','tiktok'];
  const [f, setF] = useState({ platforms:['instagram'], minF:1000, maxF:50000, months:12, regular:true, qty:200, keyword:'' });
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const allSel = plats.every(p => f.platforms.includes(p));
  const tp = (p:string) => setF(x=>({...x, platforms: x.platforms.includes(p)?x.platforms.filter(q=>q!==p):[...x.platforms,p]}));

  const start = async () => {
    if (!f.platforms.length) { setError('Seleccione pelo menos uma plataforma.'); return; }
    setStatus('running'); setError(''); setLog(['A iniciar pesquisa de perfis via Apify...']); setProgress(15);
    try {
      const res = await fetch('/api/prospect', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ platform:f.platforms.length===4?'all':f.platforms.join(','), minFollowers:f.minF, maxFollowers:f.maxF, minMonthsActive:f.months, requireRegular:f.regular, targetCount:f.qty, campaignName:'Pesquisa '+(f.keyword||'geral'), maxPerDay:30, keywords:f.keyword||undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro '+res.status);
      const found: any[] = data.profiles || [];
      const seen = getSeenProfiles();
      const filtered = found
        .filter(p => p.username || p.handle)
        .filter(p => !seen.has(String(p.id || p.username)))
        .filter(p => !BUSINESS_KW.some(kw => ((p.username||'')+' '+(p.displayName||'')+ ' '+(p.bio||'')).toLowerCase().includes(kw)))
        .filter(p => { const fol=p.followers||0; return fol>=f.minF && fol<=f.maxF; })
        .map(p => ({ ...p, id: String(p.id || p.username||p.handle).replace('@',''), handle: p.username||p.handle, status:'Identificado', score: Math.min(99, Math.max(50, p.score||65)) }));
      saveSeenProfiles(filtered);
      setProfiles(filtered); setProgress(100);
      setLog(l => [...l, '✓ '+filtered.length+' perfis qualificados encontrados.']);
      setStatus('done');
    } catch(e: any) { setLog(l => [...l, '⚠ Erro: '+e.message]); setStatus('error'); setError(e.message); }
  };

  return (
    <div style={{ padding:16, overflowY:'auto', height:'100%' }}>
      <div className="mba-grid-2" style={{ display:'grid', gridTemplateColumns:'minmax(280px,1fr) 2fr', gap:16 }}>
        <Panel>
          <STitle>Filtros de Pesquisa</STitle>
          <div style={{ marginBottom:14 }}><Lbl>Plataformas</Lbl>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
              <button onClick={()=>setF(x=>({...x, platforms:allSel?[]:plats}))} style={{ padding:'5px 12px', borderRadius:5, border:'1px solid '+(allSel?P.red:P.border), background:allSel?P.redDim:'transparent', color:allSel?P.redB:P.textSec, fontSize:11, fontWeight:600, cursor:'pointer' }}>{allSel?'✓ Todas':'Todas'}</button>
              {plats.map(p=><button key={p} onClick={()=>tp(p)} style={{ padding:'5px 10px', borderRadius:5, border:'1px solid '+(f.platforms.includes(p)?P.red:P.border), background:f.platforms.includes(p)?P.redDim:'transparent', color:f.platforms.includes(p)?P.redB:P.textSec, fontSize:11, cursor:'pointer', textTransform:'capitalize' }}>{p}</button>)}
            </div>
          </div>
          {[{l:'Seguidores mínimos',k:'minF'},{l:'Seguidores máximos',k:'maxF'},{l:'Antiguidade mínima (meses)',k:'months'},{l:'Quantidade de perfis',k:'qty'}].map(s=>(
            <div key={s.k} style={{ marginBottom:12 }}><Lbl>{s.l}</Lbl><input type="number" min={0} value={f[s.k as keyof typeof f]} onChange={e=>setF(x=>({...x,[s.k]:Math.max(0,+e.target.value)}))} style={INP} /></div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><Lbl>Posts regulares (2+/semana)</Lbl><Toggle on={f.regular} onChange={v=>setF(x=>({...x,regular:v}))} /></div>
          <div style={{ marginBottom:16 }}><Lbl>Palavra-chave (opcional)</Lbl><input value={f.keyword} onChange={e=>setF(x=>({...x,keyword:e.target.value}))} placeholder="ex: fitness, moda..." style={INP} /></div>
          <button onClick={start} disabled={status==='running'} style={{ width:'100%', padding:13, background:status==='running'?P.redDim:'rgba(192,0,28,0.15)', border:'1px solid '+(status==='running'?'rgba(192,0,28,0.25)':P.red), borderRadius:6, color:status==='running'?'rgba(192,0,28,0.5)':P.redB, fontSize:12, fontWeight:700, cursor:status==='running'?'not-allowed':'pointer' }}>
            {status==='running'?'A pesquisar… '+Math.round(progress)+'%':'▶  Iniciar Prospecção'}
          </button>
          {error && <div style={{ marginTop:10, color:P.orange, fontSize:12, lineHeight:1.5 }}>{error}</div>}
        </Panel>
        <div>
          {(status==='running'||status==='error') && <Panel style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}><STitle>Progresso</STitle><span style={{ color:P.red, fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700 }}>{Math.round(progress)}%</span></div>
            <Bar value={progress} max={100} h={4} />
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, maxHeight:120, overflowY:'auto', marginTop:10 }}>{log.map((l,i)=><div key={i} style={{ color:i===log.length-1?P.text:P.textSec, marginBottom:3, lineHeight:1.5 }}>{l}</div>)}</div>
          </Panel>}
          {profiles.length>0 && <Panel>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}><STitle>{profiles.length} perfis encontrados</STitle><div style={{ display:'flex', gap:8 }}><Btn variant="ghost" size="sm" onClick={()=>exportCSV(profiles)}>Exportar CSV</Btn></div></div>
            <div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>{['Perfil','Seguidores','Plataforma','Score','Acções'].map(h=><th key={h} style={{ color:P.textSec, fontSize:10, fontWeight:600, textAlign:'left', padding:'7px 10px', borderBottom:'1px solid '+P.border }}>{h}</th>)}</tr></thead>
              <tbody>{profiles.slice(0,50).map((r,i)=><tr key={i} style={{ borderBottom:'1px solid '+P.border }}>
                <td style={{ padding:'9px 10px' }}><a href={r.profileUrl} target="_blank" rel="noopener noreferrer" style={{ color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:600, textDecoration:'none' }}>{r.handle||r.username}</a></td>
                <td style={{ padding:'9px 10px', color:P.text, fontFamily:"'JetBrains Mono',monospace" }}>{(r.followers||0).toLocaleString('pt-PT')}</td>
                <td style={{ padding:'9px 10px', color:P.textSec, textTransform:'capitalize', fontSize:11 }}>{r.platform}</td>
                <td style={{ padding:'9px 10px' }}><span style={{ padding:'2px 8px', borderRadius:3, background:'rgba(192,0,28,0.15)', border:'1px solid '+P.border, color:P.redB, fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:600 }}>{r.score}</span></td>
                <td style={{ padding:'9px 10px' }}><Btn variant="ghost" size="sm">Ver</Btn></td>
              </tr>)}</tbody>
            </table></div>
            {profiles.length>50 && <div style={{ color:P.textDim, fontSize:11, textAlign:'center', padding:12 }}>Mostrando 50 de {profiles.length} perfis</div>}
          </Panel>}
          {status==='idle' && !profiles.length && <Panel><div style={{ textAlign:'center', padding:48, color:P.textDim }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>◎</div><div style={{ color:P.text, fontSize:14, fontWeight:600 }}>Sem pesquisa efectuada</div><div style={{ fontSize:12, marginTop:6 }}>Configure os filtros e inicie a prospecção.</div></div></Panel>}
        </div>
      </div>
    </div>
  );
}