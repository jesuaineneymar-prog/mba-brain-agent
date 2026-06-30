import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Backup nao disponivel no modo serverless' }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: 'Backup nao disponivel no modo serverless' }, { status: 501 });
}