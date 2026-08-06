import { NextResponse } from 'next/server';

// Dashboard sem Prisma - o frontend calcula tudo a partir dos dados locais
export async function GET() {
  // O frontend calcula dashboard a partir de localStorage
  // Este endpoint retorna sucesso para o codigo funcionar, mas o dashboard real
  // e calculado client-side
  return NextResponse.json({ status: 'ok', source: 'client' });
}
