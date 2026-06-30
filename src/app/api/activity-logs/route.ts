import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const page = parseInt(new URL(request.url).searchParams.get('page') || '1');
    const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit') || '50'), 200);
    const actionFilter = new URL(request.url).searchParams.get('action');
    const where: Record<string, unknown> = actionFilter ? { action: actionFilter } : {};
    const [logs, total] = await Promise.all([
      db.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.activityLog.count({ where }),
    ]);
    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}