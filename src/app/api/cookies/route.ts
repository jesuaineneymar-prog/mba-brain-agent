import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ cookies: [] });
}

export async function PATCH() {
  return NextResponse.json({ error: 'Gestao de cookies via ficheiro nao disponivel no modo serverless' }, { status: 501 });
}