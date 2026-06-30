import { NextResponse } from 'next/server';

// Notifications sem Prisma - frontend gere tudo
export async function GET() {
  return NextResponse.json({ messages: [], unreadCount: 0 });
}

export async function PATCH() {
  return NextResponse.json({ status: 'ok' });
}
