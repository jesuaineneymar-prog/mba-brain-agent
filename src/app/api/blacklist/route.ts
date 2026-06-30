import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const blacklist = await db.blacklist.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ blacklist });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const entries = await request.json();
    const items = Array.isArray(entries) ? entries : [entries];
    const created = [];
    for (const item of items) {
      const existing = await db.blacklist.findFirst({ where: { platform: item.platform, username: item.username } });
      if (!existing) {
        const bl = await db.blacklist.create({ data: { platform: item.platform, username: item.username, reason: item.reason || 'Manual' } });
        created.push(bl);
      }
    }
    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
    await db.blacklist.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}