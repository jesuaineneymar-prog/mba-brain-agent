import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const recent = await db.message.findMany({
      where: { direction: 'inbound', isRead: false },
      orderBy: { sentAt: 'desc' },
      take: 20,
      include: { profile: { select: { username: true, displayName: true, platform: true, avatarUrl: true } } },
    });
    const unreadCount = await db.message.count({ where: { direction: 'inbound', isRead: false } });
    return NextResponse.json({ messages: recent, unreadCount });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json({ error: 'Erro ao carregar notificações' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { ids } = await request.json();
    if (ids?.length) {
      await db.message.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}