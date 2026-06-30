import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const inbound = await db.message.findMany({
      where: { direction: 'inbound' },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: { profile: { select: { username: true, displayName: true, platform: true, avatarUrl: true, status: true } } },
    });
    const metaConversations: any[] = [];
    if (process.env.META_ACCESS_TOKEN) {
      try {
        const convRes = await fetch(`https://graph.facebook.com/v19.0/me/conversations?fields=id,snippet,updated_time,participants&limit=20&access_token=${process.env.META_ACCESS_TOKEN}`);
        if (convRes.ok) {
          const convData = await convRes.json();
          for (const conv of (convData.data || [])) {
            metaConversations.push({
              id: conv.id,
              snippet: conv.snippet || '',
              updatedTime: conv.updated_time,
              participant: conv.participants?.data?.[0]?.name || 'Desconhecido',
              platform: 'facebook',
            });
          }
        }
      } catch {}
    }
    return NextResponse.json({ messages: inbound, metaConversations });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}