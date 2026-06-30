import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, senderId, senderName, text, timestamp } = body;
    if (!platform || !text) return NextResponse.json({ error: 'Plataforma e texto obrigatórios' }, { status: 400 });
    const profile = await db.profile.findFirst({ where: { platform, externalId: senderId } });
    if (!profile) {
      return NextResponse.json({ success: true, message: 'Perfil não encontrado na base de dados' });
    }
    await db.message.create({
      data: {
        profileId: profile.id,
        campaignId: profile.campaignId,
        direction: 'inbound',
        content: text,
        sentAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });
    await db.profile.update({
      where: { id: profile.id },
      data: { status: 'replied', repliedAt: new Date() },
    });
    await db.activityLog.create({
      data: { action: 'WEBHOOK_RECEIVED', details: `${platform}: ${senderName || senderId} — ${text.slice(0, 80)}` },
    });
    return NextResponse.json({ success: true, profileId: profile.id });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Erro ao processar webhook' }, { status: 500 });
  }
}