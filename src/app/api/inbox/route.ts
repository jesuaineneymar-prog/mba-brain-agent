import { NextResponse } from 'next/server';

// Inbox sem Prisma - frontend gere tudo
export async function GET() {
  return NextResponse.json({ messages: [], metaConversations: [] });
}
