import { NextResponse } from 'next/server';

// Profiles sem Prisma - o frontend gere tudo em localStorage
export async function GET() {
  return NextResponse.json({ profiles: [], total: 0, source: 'client' });
}

export async function PATCH() {
  return NextResponse.json({ status: 'ok', source: 'client' });
}
