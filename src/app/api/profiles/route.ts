import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
 try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;
    if (platform) where.platform = platform;
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { displayName: { contains: search } },
        { bio: { contains: search } },
      ];
    }

    const [profiles, total] = await Promise.all([
      db.profile.findMany({
        where,
        orderBy: { score: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 5,
          },
        },
      }),
      db.profile.count({ where }),
    ]);

    return NextResponse.json({ profiles, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Profiles error:', error);
    return NextResponse.json({ error: 'Erro ao carregar perfis' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...data } = await request.json();

    if (data.status === 'accepted') {
      data.acceptedAt = new Date();
    }
    if (data.status === 'contacted') {
      data.contactedAt = new Date();
    }

    const profile = await db.profile.update({ where: { id }, data });

    await db.activityLog.create({
      data: {
        action: 'PROFILE_UPDATE',
        details: `Perfil ${profile.username} actualizado para ${data.status}`,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Erro ao actualizar perfil' }, { status: 500 });
  }
}