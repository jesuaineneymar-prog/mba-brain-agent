import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const format = searchParams.get('format') || 'json';

    const where: Record<string, unknown> = {};
    if (campaignId) where.campaignId = campaignId;

    const profiles = await db.profile.findMany({
      where,
      orderBy: { score: 'desc' },
      include: { messages: { orderBy: { sentAt: 'asc' } } },
    });

    if (format === 'csv') {
      const headers = ['Username', 'Nome', 'Plataforma', 'Seguidores', 'Posts', 'Score', 'Estado', 'Categoria', 'Localização'];
      const rows = profiles.map(p => [
        p.username, p.displayName || '', p.platform, p.followers, p.postsCount,
        p.score, p.status, p.category || '', p.location || ''
      ].map(v => `"${v}"`).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      return new NextResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename=mba_prospects.csv' },
      });
    }

    return NextResponse.json({ profiles, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Erro na exportação' }, { status: 500 });
  }
}
