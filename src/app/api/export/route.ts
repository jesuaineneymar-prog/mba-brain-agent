import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ profiles: [], exportedAt: new Date().toISOString() });
}