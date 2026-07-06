import { NextResponse } from 'next/server';

// AB Test sem Prisma - frontend gere em localStorage
export async function GET() {
  return NextResponse.json({ variants: [], groupStats: {} });
}

export async function POST() {
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function PATCH() {
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}
