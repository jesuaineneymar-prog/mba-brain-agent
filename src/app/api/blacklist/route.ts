import { NextResponse } from 'next/server';

// Blacklist sem Prisma - frontend gere em localStorage
export async function GET() {
  return NextResponse.json({ blacklist: [] });
}

export async function POST() {
  return NextResponse.json({ created: true }, { status: 201 });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}
