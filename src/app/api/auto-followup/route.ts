import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const due = await db.followUp.findMany({
      where: { status: 'pending', scheduledAt: { lte: now } },
      include: { profile: true },
    });
    let sent = 0;
    for (const fu of due) {
      if (fu.message && fu.profile) {
        await db.message.create({
          data: {
            profileId: fu.profileId,
            campaignId: fu.profile.campaignId,
            direction: 'outbound',
            content: fu.message,
          },
        });
        sent++;
      }
      await db.followUp.update({ where: { id: fu.id }, data: { status: 'completed', sentAt: now } });
      await db.activityLog.create({ data: { action: 'FOLLOWUP_AUTO_SENT', details: `Follow-up automático para ${fu.username}` } });
    }
    return NextResponse.json({ checked: due.length, sent });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}