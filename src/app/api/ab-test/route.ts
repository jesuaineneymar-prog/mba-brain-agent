import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const variants = await db.aBTestVariant.findMany({ orderBy: { createdAt: 'desc' } });
    const groupStats: Record<string, { sent: number; replies: number }> = {};
    for (const v of variants) {
      const sent = await db.message.count({ where: { abTestGroup: v.groupName, direction: 'outbound' } });
      const replies = await db.message.count({ where: { abTestGroup: v.groupName, direction: 'inbound' } });
      groupStats[v.groupName] = { sent, replies };
    }
    return NextResponse.json({ variants, groupStats });
  } catch (error) {
    console.error('AB Test error:', error);
    return NextResponse.json({ error: 'Erro ao carregar variantes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const existing = await db.aBTestVariant.findUnique({ where: { groupName: data.group } });
    if (existing) return NextResponse.json({ error: 'Grupo já existe' }, { status: 409 });
    const variant = await db.aBTestVariant.create({ data: {
      name: data.name || `Variante ${data.group}`,
      groupName: data.group,
      content: data.content,
      isActive: true,
    }});
    return NextResponse.json({ variant }, { status: 201 });
  } catch (error) {
    console.error('AB Test create error:', error);
    return NextResponse.json({ error: 'Erro ao criar variante' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();
    const variant = await db.aBTestVariant.update({ where: { id }, data });
    return NextResponse.json({ variant });
  } catch (error) {
    console.error('AB Test update error:', error);
    return NextResponse.json({ error: 'Erro ao actualizar variante' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await db.aBTestVariant.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao eliminar variante' }, { status: 500 });
  }
}