import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const followUps = await db.followUp.findMany({
      orderBy: { scheduledAt: 'asc' },
      include: { profile: { select: { id: true, username: true, displayName: true, platform: true, avatarUrl: true } } },
    });
    const pending = followUps.filter(f => f.status === 'pending');
    return NextResponse.json({ followUps, pendingCount: pending.length });
  } catch (error) {
    console.error('FollowUps error:', error);
    return NextResponse.json({ error: 'Erro ao carregar follow-ups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const followUp = await db.followUp.create({ data: {
      profileId: data.profileId,
      username: data.username || '',
      platform: data.platform || '',
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : new Date(),
      notes: data.notes || '',
      message: data.message || '',
    }});
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    console.error('FollowUp create error:', error);
    return NextResponse.json({ error: 'Erro ao criar follow-up' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const followUp = await db.followUp.update({ where: { id }, data });
    return NextResponse.json({ followUp });
  } catch (error) {
    console.error('FollowUp update error:', error);
    return NextResponse.json({ error: 'Erro ao actualizar follow-up' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await db.followUp.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao eliminar follow-up' }, { status: 500 });
  }
}