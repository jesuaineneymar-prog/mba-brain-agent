import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ checked: 0, sent: 0 });
}