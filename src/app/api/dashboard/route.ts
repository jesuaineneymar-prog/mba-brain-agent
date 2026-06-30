import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalProfiles = await db.profile.count();
    const contactedToday = await db.profile.count({
      where: { contactedAt: { gte: today } },
    });
    const repliedToday = await db.profile.count({
      where: { repliedAt: { gte: today } },
    });
    const acceptedToday = await db.profile.count({
      where: { acceptedAt: { gte: today } },
    });

    const totalCampaigns = await db.campaign.count();
    const activeCampaigns = await db.campaign.count({ where: { status: 'running' } });
    const totalMessages = await db.message.count();
    const outboundMessages = await db.message.count({ where: { direction: 'outbound' } });
    const inboundMessages = await db.message.count({ where: { direction: 'inbound' } });

    // Profile status breakdown
    const statusBreakdown = await db.profile.groupBy({
      by: ['status'],
      _count: true,
    });

    // Platform breakdown
    const platformBreakdown = await db.profile.groupBy({
      by: ['platform'],
      _count: true,
    });

    // Category breakdown
    const categoryBreakdown = await db.profile.groupBy({
      by: ['category'],
      _count: true,
    });

    // Recent campaigns
    const recentCampaigns = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Daily stats for the last 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayContacted = await db.profile.count({
        where: { contactedAt: { gte: date, lt: nextDate } },
      });
      const dayReplied = await db.profile.count({
        where: { repliedAt: { gte: date, lt: nextDate } },
      });
      const dayAccepted = await db.profile.count({
        where: { acceptedAt: { gte: date, lt: nextDate } },
      });

      dailyStats.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('pt-PT', { weekday: 'short' }),
        contacted: dayContacted,
        replied: dayReplied,
        accepted: dayAccepted,
      });
    }

    // Top profiles by score
    const topProfiles = await db.profile.findMany({
      orderBy: { score: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      overview: {
        totalProfiles,
        contactedToday,
        repliedToday,
        acceptedToday,
        totalCampaigns,
        activeCampaigns,
        totalMessages,
        outboundMessages,
        inboundMessages,
        responseRate: outboundMessages > 0 ? Math.round((inboundMessages / outboundMessages) * 100) : 0,
      },
      statusBreakdown: statusBreakdown.map(s => ({ status: s.status, count: s._count })),
      platformBreakdown: platformBreakdown.map(p => ({ platform: p.platform, count: p._count })),
      categoryBreakdown: categoryBreakdown.map(c => ({ category: c.category, count: c._count })),
      recentCampaigns,
      dailyStats,
      topProfiles,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Erro ao carregar dashboard' }, { status: 500 });
  }
}