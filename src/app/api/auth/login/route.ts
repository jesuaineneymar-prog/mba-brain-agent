import { NextResponse } from 'next/server';

const ACCESS = process.env.ACCESS_CODE || 'MBA2026';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code || code !== ACCESS) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 401 });
    }
    return NextResponse.json({ success: true, sessionId: 'ses_' + Date.now() });
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}