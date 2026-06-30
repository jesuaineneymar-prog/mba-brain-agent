import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code || code !== process.env.ACCESS_CODE) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 401 });
    }
    return NextResponse.json({ success: true, sessionId: 'ses_' + Date.now() });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}