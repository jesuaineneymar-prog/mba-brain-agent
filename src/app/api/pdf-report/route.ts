import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const totalProfiles = await db.profile.count();
    const byStatus = await db.profile.groupBy({ by: ['status'], _count: true });
    const byPlatform = await db.profile.groupBy({ by: ['platform'], _count: true });
    const byCategory = await db.profile.groupBy({ by: ['category'], _count: true });
    const totalMessages = await db.message.count();
    const outbound = await db.message.count({ where: { direction: 'outbound' } });
    const inbound = await db.message.count({ where: { direction: 'inbound' } });
    const totalCampaigns = await db.campaign.count();
    const campaigns = await db.campaign.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { profiles: true, messages: true } } } });
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      const nd = new Date(d); nd.setDate(nd.getDate() + 1);
      dailyStats.push({
        date: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('pt-PT', { weekday: 'short' }),
        contacted: await db.profile.count({ where: { contactedAt: { gte: d, lt: nd } } }),
        replied: await db.profile.count({ where: { repliedAt: { gte: d, lt: nd } } }),
        accepted: await db.profile.count({ where: { acceptedAt: { gte: d, lt: nd } } }),
      });
    }
    const topProfiles = await db.profile.findMany({ orderBy: { score: 'desc' }, take: 10 });
    const pendingFollowUps = await db.followUp.count({ where: { status: 'pending' } });
    return NextResponse.json({
      totalProfiles, totalMessages, outbound, inbound, totalCampaigns,
      responseRate: outbound > 0 ? Math.round((inbound / outbound) * 100) : 0,
      byStatus, byPlatform, byCategory, dailyStats, topProfiles, campaigns, pendingFollowUps,
    });
  } catch (error) {
    console.error('PDF report error:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}