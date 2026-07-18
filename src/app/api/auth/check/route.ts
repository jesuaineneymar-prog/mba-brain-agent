import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const authHeader = request?.headers?.get?.('authorization');
    const validCodes = [process.env.ACCESS_CODE || 'MBA2026'];
    const token = authHeader?.replace('Bearer ', '');
    if (!token || !validCodes.includes(token)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ valid: true });
  }
}