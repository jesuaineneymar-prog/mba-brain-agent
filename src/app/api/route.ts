import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'MODO LOCAL - DADOS NO BROWSER',
    configured: 0, total: 0,
    variables: {},
    timestamp: new Date().toISOString(),
  });
}