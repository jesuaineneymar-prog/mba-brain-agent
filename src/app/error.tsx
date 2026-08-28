'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ width:'100vw', height:'100vh', background:'#05050B', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#F2F2FA', fontFamily:'monospace', padding:20 }}>
      <div style={{ color:'#C0001C', fontSize:20, fontWeight:700, marginBottom:16 }}>ERRO DETECTADO</div>
      <div style={{ color:'#ff6b6b', fontSize:13, maxWidth:600, wordBreak:'break-all', marginBottom:16, background:'#141428', padding:16, borderRadius:8, border:'1px solid rgba(192,0,28,0.3)' }}>
        {error.message || 'Erro desconhecido'}
      </div>
      <div style={{ color:'#9090AA', fontSize:11, marginBottom:8 }}>
        Stack: {error.stack ? error.stack.split('\n').slice(0, 5).join('\n') : 'N/A'}
      </div>
      <div style={{ color:'#505068', fontSize:10, marginBottom:16 }}>
        {error.digest ? 'Digest: ' + error.digest : ''}
      </div>
      <button onClick={reset} style={{ padding:'10px 24px', background:'rgba(192,0,28,0.15)', border:'1px solid #C0001C', color:'#FF1A3C', borderRadius:6, fontSize:13, fontWeight:600, cursor:'pointer' }}>Tentar novamente</button>
    </div>
  );
}
