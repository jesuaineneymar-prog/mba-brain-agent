import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ campaigns: [] });
}

export async function POST(request: Request) {
  const data = await request.json().catch(() => ({}));
  return NextResponse.json({ ...data, id: 'local_' + Date.now() }, { status: 201 });
}

export async function PATCH(request: Request) {
  const data = await request.json().catch(() => ({}));
  return NextResponse.json(data);
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}