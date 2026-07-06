import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const RAPID_KEY = process.env.RAPIDAPI_KEY || '';

const RAPID_HOSTS: Record<string, string> = {
  instagram: 'instagram-scraper-stable-api.p.rapidapi.com',
  tiktok: 'tiktok-scraper7.p.rapidapi.com',
  facebook: 'facebook-scraper3.p.rapidapi.com',
};

interface ProspectRequest {
  platform: string;
  minFollowers: number;
  maxFollowers: number;
  minMonthsActive: number;
  requireRegular: boolean;
  targetCount: number;
  campaignName: string;
  maxPerDay: number;
  keywords?: string;
  location?: string;
}

export async function POST(request: Request) {
  const filters: ProspectRequest = await request.json();

  const campaign = await db.campaign.create({
    data: {
      name: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      status: 'running',
      targetCount: filters.targetCount,
      minFollowers: filters.minFollowers,
      maxFollowers: filters.maxFollowers,
      minMonthsActive: filters.minMonthsActive,
      requireRegular: filters.requireRegular,
      platform: filters.platform,
      maxPerDay: filters.maxPerDay,
    },
  });

  const platforms = filters.platform === 'all'
    ? ['instagram', 'tiktok', 'facebook']
    : [filters.platform];

  const baseKeyword = filters.keywords || 'Angola';
  const queries = buildQueries(baseKeyword, filters.location || 'Angola');
  const perPlatform = Math.ceil(filters.targetCount / Math.max(platforms.length, 1));

  const searchCalls = platforms.map(async (platform) => {
    const host = RAPID_HOSTS[platform];
    if (!host || !RAPID_KEY) return [];

    const results: any[] = [];

    for (const q of queries) {
      const data = await searchPlatform(platform, host, q, 20);
      const normalized = (data || []).map(normalizeProfile(platform));
      results.push(...normalized);
      if (results.length >= perPlatform * 3) break;
    }

    return results;
  });

  const allResults = await Promise.all(searchCalls);
  const allProfiles = allResults.flat();

  const filtered = allProfiles.filter(p => {
    const followers = p.followers || 0;
    const isFb = p.platform === 'facebook';
    if (!isFb && (followers < filters.minFollowers || followers > filters.maxFollowers)) return false;
    if (filters.requireRegular && (p.postsCount || 0) < 10 && !isFb) return false;
    if (!isFb && p.isVerified) return false;
    if (p.isBot) return false;
    return true;
  }).slice(0, filters.targetCount);

  for (const profile of filtered) {
    await db.profile.create({
      data: {
        campaignId: campaign.id,
        platform: profile.platform || 'unknown',
        username: profile.username || '',
        displayName: profile.fullName || '',
        followers: profile.followers || 0,
        following: profile.following || 0,
        postsCount: profile.postsCount || 0,
        monthsActive: profile.monthsActive || estimateMonthsActive(profile),
        isRegular: (profile.postsCount || 0) > 20,
        isVerified: profile.isVerified || false,
        score: calculateScore(profile, filters),
        category: profile.category || extractCategory(profile),
        location: profile.location || filters.location || 'Angola',
        bio: profile.bio || '',
        profileUrl: profile.profileUrl || '',
        avatarUrl: profile.avatarUrl || '',
        status: 'prospect',
        isBot: detectBot(profile),
      },
    });
  }

  await db.campaign.update({
    where: { id: campaign.id },
    data: { sentCount: filtered.length },
  });

  await db.activityLog.create({
    data: {
      action: 'PROSPECT_COMPLETE',
      details: `Campanha "${campaign.name}": ${filtered.length} perfis reais encontrados via RapidAPI`,
    },
  });

  return NextResponse.json({
    success: true,
    campaignId: campaign.id,
    profilesFound: filtered.length,
    profiles: filtered,
  });
}

function buildQueries(keyword: string, location: string): string[] {
  const loc = location || 'Angola';
  const kw = keyword.toLowerCase().trim();
  const base = [kw, `${kw} ${loc}`, `${kw} business`];
  const extras = ['marketing digital', 'social media', 'empreendedor', 'negocio', 'influencer', 'content creator', 'freelancer'];
  const combined = extras.map(e => `${e} ${loc}`);
  return [...base, ...combined];
}

async function searchPlatform(platform: string, host: string, query: string, count: number): Promise<any[]> {
  if (platform === 'instagram') return searchInstagram(host, query, count);
  if (platform === 'tiktok') return searchTikTok(host, query, count);
  if (platform === 'facebook') return searchFacebook(host, query, count);
  return [];
}

async function searchInstagram(host: string, query: string, count: number): Promise<any[]> {
  const res = await fetch(`https://${host}/search_ig.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-rapidapi-key': RAPID_KEY,
      'x-rapidapi-host': host,
    },
    body: `search_query=${encodeURIComponent(query)}&search_type=users`,
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data.users || []).slice(0, count).map((u: any) => u.user || u);
}

async function searchTikTok(host: string, query: string, count: number): Promise<any[]> {
  const res = await fetch(`https://${host}/user/search?keywords=${encodeURIComponent(query)}&count=${count}`, {
    headers: {
      'x-rapidapi-key': RAPID_KEY,
      'x-rapidapi-host': host,
    },
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  if (data.code !== 0) return [];
  return (data.data?.user_list || []).slice(0, count).map((u: any) => ({
    ...u.user,
    stats: u.stats,
  }));
}

async function searchFacebook(host: string, query: string, count: number): Promise<any[]> {
  const res = await fetch(`https://${host}/search/pages?query=${encodeURIComponent(query)}`, {
    headers: {
      'x-rapidapi-key': RAPID_KEY,
      'x-rapidapi-host': host,
    },
  }).catch(() => null);
  if (!res || !res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data.results || []).slice(0, count).filter((r: any) => r.type === 'page');
}

function normalizeProfile(platform: string) {
  return (item: any) => {
    if (platform === 'instagram') {
      return {
        platform: 'instagram',
        username: item.username || '',
        fullName: item.full_name || '',
        followers: parseFollowerCount(item.search_social_context) || 0,
        following: 0,
        postsCount: 0,
        isVerified: item.is_verified || false,
        isBusiness: false,
        bio: '',
        profileUrl: `https://instagram.com/${item.username || ''}`,
        avatarUrl: item.profile_pic_url || item.hd_profile_pic_url_info?.url || '',
        location: '',
        category: '',
        externalId: item.pk || item.id || '',
      };
    }
    if (platform === 'tiktok') {
      return {
        platform: 'tiktok',
        username: item.uniqueId || '',
        fullName: item.nickname || '',
        followers: item.stats?.followerCount || item.stats?.heart || 0,
        following: item.stats?.followingCount || 0,
        postsCount: item.stats?.videoCount || 0,
        isVerified: item.verified || false,
        isBusiness: false,
        bio: item.signature || '',
        profileUrl: `https://tiktok.com/@${item.uniqueId || ''}`,
        avatarUrl: item.avatarMedium || item.avatarThumb || item.avatarLarger || '',
        location: item.region || '',
        category: '',
        externalId: item.id || item.secUid || '',
      };
    }
    if (platform === 'facebook') {
      return {
        platform: 'facebook',
        username: item.name || '',
        fullName: item.name || '',
        followers: 0,
        following: 0,
        postsCount: 0,
        isVerified: item.is_verified || false,
        isBusiness: true,
        bio: '',
        profileUrl: item.profile_url || item.url || '',
        avatarUrl: item.image?.uri || '',
        location: '',
        category: '',
        externalId: item.facebook_id || '',
      };
    }
    return { platform, username: '', fullName: '', followers: 0 };
  };
}

function parseFollowerCount(ctx: string): number {
  if (!ctx) return 0;
  const num = ctx.replace(/[^0-9.KMB]/g, '').trim();
  if (!num) return 0;
  const multiplier = ctx.toUpperCase().includes('B') ? 1000000000 : ctx.toUpperCase().includes('M') ? 1000000 : ctx.toUpperCase().includes('K') ? 1000 : 1;
  const base = parseFloat(num.replace(/[^0-9.]/g, ''));
  if (isNaN(base)) return 0;
  return Math.round(base * multiplier);
}

function calculateScore(profile: any, filters: ProspectRequest): number {
  const followers = profile.followers || 0;
  const posts = profile.postsCount || 0;
  const followerScore = Math.min((followers / filters.maxFollowers) * 40, 40);
  const postScore = Math.min((posts / 100) * 30, 30);
  const verifiedPenalty = profile.isVerified ? -20 : 0;
  const businessPenalty = profile.isBusiness ? -15 : 0;
  return Math.max(0, Math.round(followerScore + postScore + 30 + verifiedPenalty + businessPenalty));
}

function extractCategory(profile: any): string {
  if (profile.category) return profile.category;
  const bio = (profile.bio || '').toLowerCase();
  if (bio.includes('restaur') || bio.includes('food')) return 'Restauracao';
  if (bio.includes('tech') || bio.includes('software') || bio.includes('digital')) return 'Tecnologia';
  if (bio.includes('fitness') || bio.includes('gym') || bio.includes('saude') || bio.includes('health')) return 'Saude/Fitness';
  if (bio.includes('moda') || bio.includes('fashion') || bio.includes('style')) return 'Moda';
  if (bio.includes('marketing') || bio.includes('agency') || bio.includes('social media')) return 'Marketing';
  return 'Outro';
}

function estimateMonthsActive(profile: any): number {
  if (profile.monthsActive) return profile.monthsActive;
  const posts = profile.postsCount || 0;
  if (posts > 100) return 24;
  if (posts > 30) return 12;
  return 6;
}

function detectBot(profile: any): boolean {
  const bio = (profile.bio || '').toLowerCase();
  const name = (profile.username || '').toLowerCase();
  if (/\d{5,}/.test(name)) return true;
  if (bio.includes('follow for follow') || bio.includes('gain')) return true;
  if ((profile.followers || 0) > 0 && (profile.following || 0) > 0) {
    const ratio = profile.following / profile.followers;
    if (ratio > 5) return true;
  }
  return false;
}