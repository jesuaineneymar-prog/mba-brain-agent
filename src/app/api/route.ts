import { NextResponse } from 'next/server';

// Endpoint de debug para verificar variaveis de ambiente no Vercel
// Retira info sensivel - so mostra se existe ou nao
export async function GET() {
  const envStatus: Record<string, string> = {
    DATABASE_URL: process.env.DATABASE_URL ? 'OK' : 'EM FALTA',
    ACCESS_CODE: process.env.ACCESS_CODE ? `OK (${process.env.ACCESS_CODE.substring(0, 3)}...)` : 'EM FALTA',
    APIFY_API_KEY: process.env.APIFY_API_KEY ? `OK (comeca: ${process.env.APIFY_API_KEY.substring(0, 10)}...)` : 'EM FALTA',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `OK (comeca: ${process.env.OPENROUTER_API_KEY.substring(0, 10)}...)` : 'EM FALTA',
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN ? 'OK' : 'EM FALTA',
    IG_SESSIONID: process.env.IG_SESSIONID ? 'OK' : 'EM FALTA',
    IG_CSRFTOKEN: process.env.IG_CSRFTOKEN ? 'OK' : 'EM FALTA',
    FB_C_USER: process.env.FB_C_USER ? 'OK' : 'EM FALTA',
    FB_XS: process.env.FB_XS ? 'OK' : 'EM FALTA',
    LI_AT: process.env.LI_AT ? 'OK' : 'EM FALTA',
    TT_SESSIONID: process.env.TT_SESSIONID ? 'OK' : 'EM FALTA',
    TT_CSRF_TOKEN: process.env.TT_CSRF_TOKEN ? 'OK' : 'EM FALTA',
  };

  const total = Object.keys(envStatus).length;
  const ok = Object.values(envStatus).filter(v => v.startsWith('OK')).length;

  return NextResponse.json({
    status: ok === total ? 'TUDO CONFIGURADO' : 'FALTAM CREDENCIAIS',
    configured: ok,
    total,
    variables: envStatus,
    timestamp: new Date().toISOString(),
  });
}
