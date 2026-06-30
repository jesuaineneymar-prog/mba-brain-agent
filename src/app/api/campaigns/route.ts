import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { profiles: true, messages: true } } },
    });
    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Campaigns error:', error);
    return NextResponse.json({ error: 'Erro ao carregar campanhas' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const campaign = await db.campaign.create({ data });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error('Campaign create error:', error);
    return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const campaign = await db.campaign.update({ where: { id }, data });
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error('Campaign update error:', error);
    return NextResponse.json({ error: 'Erro ao actualizar campanha' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await db.campaign.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Campaign delete error:', error);
    return NextResponse.json({ error: 'Erro ao eliminar campanha' }, { status: 500 });
  }
}