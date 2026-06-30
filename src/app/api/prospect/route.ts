import { NextResponse } from 'next/server';

// ==========================================
// PROSPECCAO DIRECTA - Sem Prisma, Sem DB
// Tudo guardado no frontend (localStorage)
// Este endpoint so faz scraping e retorna dados
// ==========================================

// Credenciais para scraping
const IG_SESSION = process.env.IG_SESSIONID || '22987806071%3APJEKR4ZKC0zjTw%3A2%3AAYi0iJ8xriE5IrXzp-0aNrMgYSP7ifTVENxiaQqmyA';
const IG_CSRF = process.env.IG_CSRFTOKEN || 'h8hqhQ0rEsQw9nI0mW0Xbv1eYOFRGniR';
const TT_SESSION = process.env.TT_SESSIONID || 'dd79eded99c88d754997376786cab26b';
const TT_CSRF = process.env.TT_CSRF_TOKEN || 'AyfiABpC-i_oOFH5Mqeqef9imWi9LqKSKh3U';
const META_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuSdCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZAVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxKOMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2VIyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV33TUQZDZD';

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
  try {
    const filters: ProspectRequest = await request.json();

    const platforms = filters.platform === 'all'
      ? ['instagram', 'tiktok', 'facebook', 'linkedin']
      : [filters.platform];

    const allProfiles: any[] = [];
    const errors: string[] = [];
    const keywords = (filters.keywords || '').trim();
    const location = (filters.location || 'Angola').trim();
    const query = keywords ? `${keywords} ${location}` : location;

    for (const platform of platforms) {
      try {
        let profiles: any[] = [];
        switch (platform) {
          case 'instagram':
            profiles = await scrapeInstagram(query, filters.targetCount);
            break;
          case 'tiktok':
            profiles = await scrapeTikTok(query, filters.targetCount);
            break;
          case 'facebook':
            profiles = await scrapeFacebook(query, filters.targetCount);
            break;
          case 'linkedin':
            profiles = await scrapeLinkedIn(query, filters.targetCount);
            break;
        }
        console.log(`[MBA PROSPECT] ${platform}: ${profiles.length} perfis encontrados`);
        allProfiles.push(...profiles);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${platform}: ${msg}`);
        console.error(`[MBA PROSPECT] ${platform} erro:`, msg);
      }
    }

    // Filtrar e atribuir scores
    const filtered = allProfiles.filter(p => {
      const followers = p.followers || 0;
      if (followers < filters.minFollowers || followers > filters.maxFollowers) return false;
      if (filters.requireRegular && (p.postsCount || 0) < 10) return false;
      if (p.isVerified || p.isBusiness) return false;
      if (p.isBot) return false;
      if (!p.username) return false;
      return true;
    }).map(p => ({
      id: generateId(),
      campaignId: generateId(),
      platform: p.platform || 'unknown',
      username: p.username || '',
      displayName: p.fullName || '',
      followers: p.followers || 0,
      following: p.following || 0,
      postsCount: p.postsCount || 0,
      monthsActive: estimateMonthsActive(p),
      isRegular: (p.postsCount || 0) > 20,
      isVerified: p.isVerified || false,
      score: calculateScore(p, filters),
      category: extractCategory(p),
      location: p.location || location,
      bio: p.bio || '',
      profileUrl: p.profileUrl || '',
      avatarUrl: p.avatarUrl || '',
      status: 'prospect',
      isBot: detectBot(p),
      isBusiness: p.isBusiness || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      notes: '',
    })).slice(0, filters.targetCount);

    if (filtered.length === 0) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        profilesFound: 0,
        totalRaw: allProfiles.length,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `Nenhum perfil encontrado com os filtros actuais. ${allProfiles.length} perfis encontrados mas todos filtrados. Tenta alargar os filtros de seguidores.${errors.length ? ' Erros: ' + errors.join('; ') : ''}`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      profilesFound: filtered.length,
      totalRaw: allProfiles.length,
      platformsSearched: platforms,
      profiles: filtered,
      campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      message: `Prospeccao concluida! ${filtered.length} perfis encontrados em ${platforms.length} plataformas.`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Prospect error:', error);
    return NextResponse.json({ error: 'Erro ao iniciar prospeccao: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

// ==========================================
// INSTAGRAM - Direct API via cookies
// ==========================================
async function scrapeInstagram(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  const igUid = IG_SESSION.split('%3A')[0];
  const headers: Record<string, string> = {
    'Cookie': `sessionid=${IG_SESSION}; csrftoken=${IG_CSRF}; ds_user_id=${igUid}`,
    'X-CSRFToken': IG_CSRF,
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.1.37 Mobile Safari/604.1',
    'X-IG-App-ID': '936619743392459',
    'X-IG-WWW-Claim': '0',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const res = await fetch(
    `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}&rank_token=0.5`,
    { headers }
  );

  if (!res.ok) {
    throw new Error(`Instagram API retornou HTTP ${res.status}`);
  }

  const data = await res.json();
  const users = data?.users || [];

  for (const item of users) {
    const u = item?.user;
    if (!u) continue;

    let followerCount = parseInt(u.follower_count || u.followerCount || '0') || 0;
    let postCount = parseInt(u.media_count || u.mediaCount || '0') || 0;

    // Se follower_count e 0, tentar buscar dados completos
    if (followerCount === 0 && u.pk) {
      try {
        await new Promise(r => setTimeout(r, 500));
        const profileRes = await fetch(
          `https://www.instagram.com/api/v1/users/${u.pk}/info/`,
          { headers }
        );
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const userData = profileData?.user || {};
          followerCount = userData.follower_count || userData.followerCount || 0;
          postCount = userData.media_count || userData.mediaCount || 0;
        }
      } catch { /* usar defaults */ }
    }

    profiles.push({
      platform: 'instagram',
      username: u.username || '',
      fullName: u.full_name || u.fullName || '',
      followers: followerCount,
      following: parseInt(u.following_count || u.followingCount || '0') || 0,
      postsCount: postCount,
      bio: u.biography || u.bio || '',
      profileUrl: `https://instagram.com/${u.username || ''}`,
      avatarUrl: u.profile_pic_url || u.profilePicUrl || u.profilePictureUrl || '',
      isVerified: u.is_verified || u.isVerified || false,
      isBusiness: u.is_business || u.isProfessionalAccount || false,
      location: '',
      category: u.category || '',
      externalId: u.pk || u.id || '',
    });
  }

  return profiles;
}

// ==========================================
// TIKTOK - Search via cookies
// ==========================================
async function scrapeTikTok(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
  };

  const res = await fetch(
    `https://www.tiktok.com/api/search/user/general/?keyword=${encodeURIComponent(query)}&count=${limit}&offset=0&source=normal`,
    { headers }
  );

  if (!res.ok) return profiles;

  const text = await res.text();

  try {
    const data = JSON.parse(text);
    const users = data?.user_list || [];
    for (const item of users) {
      const u = item?.user || {};
      profiles.push({
        platform: 'tiktok',
        username: u.uniqueId || u.nickname || '',
        fullName: u.nickname || '',
        followers: u.followerCount || 0,
        following: u.followingCount || 0,
        postsCount: u.videoCount || 0,
        bio: u.signature || '',
        profileUrl: `https://tiktok.com/@${u.uniqueId || ''}`,
        avatarUrl: u.avatarMedium || u.avatarThumb || '',
        isVerified: u.verified || false,
        isBusiness: u.commerceUserInfo?.commerceUser || false,
        location: '',
        category: '',
        externalId: u.id || u.uid || '',
      });
    }
  } catch {
    console.log('[MBA PROSPECT] TikTok retornou HTML. Pesquisa TikTok nao disponivel via server-side.');
  }

  return profiles;
}

// ==========================================
// FACEBOOK - Search via Graph API
// ==========================================
async function scrapeFacebook(query: string, limit: number): Promise<any[]> {
  if (!META_TOKEN) return [];

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(query)}&limit=${limit}&access_token=${META_TOKEN}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.data || [];
    return pages.map((p: any) => ({
      platform: 'facebook',
      username: p.name?.replace(/\s+/g, '_').toLowerCase() || '',
      fullName: p.name || '',
      followers: p.likes || p.fan_count || 0,
      following: 0,
      postsCount: 0,
      bio: p.description || p.about || '',
      profileUrl: `https://facebook.com/${p.id || ''}`,
      avatarUrl: p.picture?.data?.url || '',
      isVerified: false,
      isBusiness: true,
      location: p.location?.city || '',
      category: p.category || '',
      externalId: p.id || '',
    }));
  } catch {
    return [];
  }
}

// ==========================================
// LINKEDIN - Search via Google as proxy
// ==========================================
async function scrapeLinkedIn(query: string, limit: number): Promise<any[]> {
  try {
    const googleRes = await fetch(
      `https://www.google.com/search?q=site%3Alinkedin.com%2Fin+${encodeURIComponent(query)}&num=${limit}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } }
    );
    if (!googleRes.ok) return [];
    const html = await googleRes.text();

    const profileRegex = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/g;
    const matches: Set<string> = new Set();
    let match;
    while ((match = profileRegex.exec(html)) !== null) {
      if (match[1] && !match[1].includes('...')) {
        matches.add(match[1]);
      }
    }

    return Array.from(matches).slice(0, limit).map(username => ({
      platform: 'linkedin',
      username,
      fullName: username.replace(/[-_]/g, ' '),
      followers: 0,
      following: 0,
      postsCount: 0,
      bio: '',
      profileUrl: `https://linkedin.com/in/${username}`,
      avatarUrl: '',
      isVerified: false,
      isBusiness: false,
      location: '',
      category: '',
      externalId: '',
    }));
  } catch {
    return [];
  }
}

// ==========================================
// HELPERS
// ==========================================
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function calculateScore(profile: any, filters: ProspectRequest): number {
  const followers = profile.followers || 0;
  const posts = profile.postsCount || 0;
  const hasBio = (profile.bio || '').length > 20;
  const hasLocation = !!profile.location;
  const followerScore = Math.min((followers / Math.max(filters.maxFollowers, 1)) * 40, 40);
  const postScore = Math.min((posts / 100) * 25, 25);
  const bioScore = hasBio ? 10 : 0;
  const locationScore = hasLocation ? 5 : 0;
  const verifiedPenalty = profile.isVerified ? -20 : 0;
  const businessPenalty = profile.isBusiness ? -15 : 0;
  return Math.max(0, Math.round(followerScore + postScore + bioScore + locationScore + 20 + verifiedPenalty + businessPenalty));
}

function extractCategory(profile: any): string {
  if (profile.category) return profile.category;
  const bio = (profile.bio || '').toLowerCase();
  const name = (profile.fullName || profile.username || '').toLowerCase();
  const combined = bio + ' ' + name;
  if (/restaur|food|comida|gastron|churras|pizza|caf[eé]|hotel/.test(combined)) return 'Restauracao/Hotel';
  if (/tech|software|digital|programador|developer|startup|dev/.test(combined)) return 'Tecnologia';
  if (/fitness|gym|saúde|health|treino|academia|workout/.test(combined)) return 'Saude/Fitness';
  if (/moda|fashion|style|beauty|beleza|makeup|cosmetic/.test(combined)) return 'Moda/Beleza';
  if (/marketing|agency|social media|branding|publicidade/.test(combined)) return 'Marketing';
  if (/music|musica|dj |kuduro|semba|kizomba|artista|cantor|rapper/.test(combined)) return 'Musica';
  if (/fotograf|photo|video|film|producao|conteudo|content/.test(combined)) return 'Media';
  if (/imob|real estate|construc|casas|apartamento/.test(combined)) return 'Imobiliario';
  return 'Outro';
}

function estimateMonthsActive(profile: any): number {
  const posts = profile.postsCount || 0;
  if (posts > 500) return 48;
  if (posts > 200) return 36;
  if (posts > 100) return 24;
  if (posts > 30) return 12;
  return 6;
}

function detectBot(profile: any): boolean {
  const bio = (profile.bio || '').toLowerCase();
  const name = (profile.username || '').toLowerCase();
  if (/\d{5,}/.test(name)) return true;
  if (/^user\d+/i.test(name)) return true;
  if (bio.includes('follow for follow') || bio.includes('gain_follower') || bio.includes('ganhar seguidor')) return true;
  if (bio.includes('free followers') || bio.includes('free likes') || bio.includes('seguidores gratis')) return true;
  if (bio.includes('buy followers') || bio.includes('comprar seguidores')) return true;
  if (bio.includes('s4s') || bio.includes('f4f') || bio.includes('l4l')) return true;
  if ((profile.followers || 0) > 0 && (profile.following || 0) > 0) {
    const ratio = profile.following / profile.followers;
    if (ratio > 10) return true;
  }
  return false;
}
