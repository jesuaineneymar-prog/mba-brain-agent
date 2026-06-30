

function ProfileDetailModal({ profile, onClose, onUpdate }: { profile: any; onClose: () => void; onUpdate?: () => void }) {
  const [notes, setNotes] = useState(profile.notes || '');
  const changeStatus = async (s: string) => {
    await fetch('/api/profiles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: profile.id, status: s }) });
    profile.status = s; onUpdate?.();
  };
  return (
    <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:P.surface,border:'1px solid '+P.borderHi,borderRadius:12,padding:24,maxWidth:600,width:'100%',maxHeight:'80vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}><STitle>{profile.username||profile.handle}</STitle><button onClick={onClose} style={{ background:'none',border:'none',color:P.textSec,fontSize:18,cursor:'pointer' }}>✕</button></div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16 }}>{[['Plataforma',profile.platform],['Seguidores',(profile.followers||0).toLocaleString('pt-PT')],['Score',String(profile.score)],['Categoria',profile.category||'N/A'],['Posts',String(profile.postsCount||0)],['Localizacao',profile.location||'N/A']].map(([l,v])=>(<div key={String(l)}><Lbl>{l}</Lbl><div style={{ color:P.text,fontSize:13 }}>{v}</div></div>))}</div>
        <div style={{ marginBottom:16 }}><Lbl>Estado</Lbl><div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>{['prospect','contacted','replied','accepted','rejected','blacklisted'].map(s=>(<button key={s} onClick={()=>changeStatus(s)} style={{ padding:'4px 10px',borderRadius:4,border:'1px solid '+(profile.status===s?(statusColors[s]||P.red):P.border),background:profile.status===s?(statusColors[s]||P.red)+'18':'transparent',color:profile.status===s?(statusColors[s]||P.red):P.textSec,fontSize:11,cursor:'pointer',textTransform:'capitalize' }}>{statusLabels[s]||s}</button>))}</div></div>
        <div style={{ marginBottom:16 }}><Lbl>Notas</Lbl><textarea value={notes} onChange={e=>setNotes(e.target.value)} onBlur={async()=>{await fetch('/api/profiles',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:profile.id,notes})});}} rows={3} style={INP} /></div>
        <div style={{ marginBottom:16 }}><STitle>Score</STitle><Bar value={profile.score} max={100} color={profile.score>=80?P.green:profile.score>=65?P.red:P.textSec} h={12} /></div>
        {(profile.messages||[]).length>0&&<div><STitle>Historico de Mensagens</STitle><div style={{ display:'flex',flexDirection:'column',gap:8,maxHeight:200,overflowY:'auto' }}>{(profile.messages||[]).map((m:any,i:number)=>(<div key={i} style={{ padding:'8px 10px',borderRadius:6,background:m.direction==='outbound'?P.redDim:'rgba(59,130,246,0.08)',border:'1px solid '+(m.direction==='outbound'?P.border:'rgba(59,130,246,0.2)') }}><div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}><span style={{ color:m.direction==='outbound'?P.redB:P.blue,fontSize:10,fontWeight:700 }}>{m.direction==='outbound'?'ENVIADA':'RECEBIDA'}</span><span style={{ color:P.textDim,fontSize:10 }}>{fmtDt(m.sentAt)}</span></div><div style={{ color:P.text,fontSize:12,whiteSpace:'pre-wrap' }}>{m.content}</div></div>))}</div></div>}
      </div>
    </div>);
}
