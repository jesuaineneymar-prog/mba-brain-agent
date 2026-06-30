import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const due = await db.message.findMany({
      where: { scheduledAt: { lte: now }, direction: 'outbound' },
      include: { profile: true },
      take: 10,
    });
    let sent = 0;
    for (const msg of due) {
      await db.message.update({ where: { id: msg.id }, data: { scheduledAt: null } });
      await db.activityLog.create({ data: { action: 'SCHEDULED_SENT', details: `Mensagem agendada enviada para ${msg.profile?.username || 'desconhecido'}` } });
      sent++;
    }
    return NextResponse.json({ checked: due.length, sent });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}