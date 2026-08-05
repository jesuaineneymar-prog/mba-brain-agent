'use client';
import { useState, useEffect } from 'react';

export default function TestPage() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width:'100vw', height:'100vh', background:'#05050B', display:'flex', alignItems:'center', justifyContent:'center', color:'#F2F2FA', fontFamily:'monospace' }}>Loading...</div>;
  }

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#05050B', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#F2F2FA', fontFamily:'monospace' }}>
      <div style={{ fontSize:42, fontWeight:900, color:'#C0001C', letterSpacing:4, marginBottom:16 }}>MBA</div>
      <div style={{ fontSize:14, color:'#9090AA' }}>MWANGO BRAIN AGENT</div>
      <div style={{ fontSize:12, color:'#505068', marginTop:8 }}>TESTE MINIMO - Se isto aparecer, o Next.js funciona</div>
      {error && <div style={{ color:'#ff6b6b', marginTop:16 }}>{error}</div>}
    </div>
  );
}
