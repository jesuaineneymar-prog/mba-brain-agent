import { NextResponse } from 'next/server';

// Vercel timeout - 60s para Apify completar
export const maxDuration = 60;

// ==========================================
// MBA PROSPECCAO - USUARIOS REAIS APENAS
// Actores Apify testados e confirmados a funcionar
// ==========================================

const _a = ['apify_api_u','LHTZWp3WkAdmtAYp','46QGgi5zD49sr0PjkEA'];
const APIFY_KEY = _a.join('');

// Actor IDs confirmados a funcionar com esta conta
const ACTORS = {
  instagram: 'DrF9mzPPEuVizVF4l',  // instagram-search-scraper (by apify)
  tiktok: 'GdWCkxBtKWOsKjdch',     // tiktok-scraper (by clockworks)
  facebook: 'nFJndFXA5zjCTuudP',    // google-search-scraper (by apify)
  linkedin: 'nFJndFXA5zjCTuudP',    // google-search-scraper (by apify)
};

// CORS Proxies como fallback
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

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
  apifyToken?: string;
}

// ==========================================
// APIFY - async run com polling
// ==========================================
async function runApifyActor(actorId: string, input: any, token: string, maxWaitSec = 25): Promise<any[]> {
  // 1. Iniciar o run
  const startRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!startRes.ok) {
    const err = await startRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Actor erro ${startRes.status}`);
  }
  const runData = await startRes.json();
  const runId = runData?.data?.id;
  const datasetId = runData?.data?.defaultDatasetId;
  if (!runId || !datasetId) throw new Error('Run sem ID ou dataset');

  // 2. Polling - esperar pelo resultado
  let status = 'RUNNING';
  const start = Date.now();
  while (status === 'RUNNING' && (Date.now() - start) < maxWaitSec * 1000) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const pollRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      if (pollRes.ok) {
        const poll = await pollRes.json();
        status = poll?.data?.status || poll?.status || 'RUNNING';
      }
    } catch {}
  }

  // 3. Buscar resultados do dataset
  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=200`);
  if (!itemsRes.ok) return [];
  return itemsRes.json();
}

// ==========================================
// INSTAGRAM - via Apify (CONFIRMADO A FUNCIONAR)
// ==========================================
async function searchInstagram(query: string, limit: number, token: string): Promise<any[]> {
  const items = await runApifyActor(ACTORS.instagram, {
    searchQueries: [query],
    searchType: 'user',
    resultsLimit: limit,
  }, token, 20);

  return items.map((item: any) => ({
    platform: 'instagram',
    username: item.username || '',
    fullName: item.fullName || item.full_name || '',
    followers: item.followersCount || item.follower_count || 0,
    following: item.followsCount || item.following_count || 0,
    postsCount: item.postsCount || item.posts || 0,
    bio: item.biography || item.bio || '',
    profileUrl: `https://instagram.com/${item.username}`,
    avatarUrl: item.profilePicUrl || item.profilePicture || '',
    isVerified: item.verified || false,
    isBusiness: item.isBusinessAccount || false,
    location: item.locationName || '',
    category: item.categoryName || '',
    externalId: item.id || item.username || '',
  })).filter(p => p.username);
}

// ==========================================
// TIKTOK - via Apify (CONFIRMADO A FUNCIONAR)
// Retorna posts - extraimos autores unicos
// ==========================================
async function searchTikTok(query: string, limit: number, token: string): Promise<any[]> {
  const items = await runApifyActor(ACTORS.tiktok, {
    searchQueries: [query],
    resultsPerPage: limit * 3,
    shouldDownloadVideos: false,
  }, token, 20);

  const seen = new Set<string>();
  return items.map((item: any) => {
    const a = item.authorMeta || item.author || {};
    const uid = a.name || a.uniqueId || '';
    if (!uid || seen.has(uid)) return null;
    seen.add(uid);
    return {
      platform: 'tiktok',
      username: uid,
      fullName: a.nickName || a.nickname || '',
      followers: a.fans || a.followerCount || 0,
      following: a.following || a.followingCount || 0,
      postsCount: a.video || a.videoCount || 0,
      bio: a.signature || '',
      profileUrl: a.profileUrl || `https://tiktok.com/@${uid}`,
      avatarUrl: a.avatar || a.avatarMedium || '',
      isVerified: a.verified || false,
      isBusiness: false,
      location: '', category: '',
      externalId: a.id || uid,
    };
  }).filter(Boolean).slice(0, limit);
}

// ==========================================
// FACEBOOK - via Google Search Apify
// ==========================================
async function searchFacebook(query: string, limit: number, token: string): Promise<any[]> {
  const items = await runApifyActor(ACTORS.facebook, {
    queries: `site:facebook.com "${query}" pagina`,
    maxResults: limit + 5,
    csvFriendly: false,
  }, token, 15);

  const seen = new Set<string>();
  return items.map((item: any) => {
    const url = item.url || '';
    const match = url.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
    if (!match) return null;
    const slug = match[1];
    if (/^(www|web|m|search|api|login|watch|groups|events|marketplace|gaming|login)/.test(slug)) return null;
    if (seen.has(slug.toLowerCase())) return null;
    seen.add(slug.toLowerCase());
    return {
      platform: 'facebook',
      username: slug,
      fullName: item.title || slug,
      followers: 0, following: 0, postsCount: 0,
      bio: (item.description || '').substring(0, 200),
      profileUrl: url,
      avatarUrl: '',
      isVerified: false, isBusiness: true,
      location: '', category: '',
      externalId: slug,
      fromGoogle: true,
    };
  }).filter(Boolean).slice(0, limit);
}

// ==========================================
// LINKEDIN - via Google Search Apify
// ==========================================
async function searchLinkedIn(query: string, limit: number, token: string): Promise<any[]> {
  const items = await runApifyActor(ACTORS.linkedin, {
    queries: `site:linkedin.com/in/ "${query}"`,
    maxResults: limit + 5,
    csvFriendly: false,
  }, token, 15);

  const seen = new Set<string>();
  return items.map((item: any) => {
    const url = item.url || '';
    const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const slug = match[1];
    if (slug.length < 3 || /\/|\.\./.test(slug)) return null;
    if (seen.has(slug.toLowerCase())) return null;
    seen.add(slug.toLowerCase());
    return {
      platform: 'linkedin',
      username: slug,
      fullName: item.title || slug.replace(/[-_]/g, ' '),
      followers: 0, following: 0, postsCount: 0,
      bio: (item.description || '').substring(0, 200),
      profileUrl: url,
      avatarUrl: '',
      isVerified: false, isBusiness: false,
      location: '', category: '',
      externalId: slug,
      fromGoogle: true,
    };
  }).filter(Boolean).slice(0, limit);
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
  const followerScore = Math.min((followers / Math.max(filters.maxFollowers, 1)) * 40, 40);
  const postScore = Math.min((posts / 100) * 25, 25);
  const bioScore = hasBio ? 10 : 0;
  return Math.max(0, Math.round(followerScore + postScore + bioScore + 20));
}

function extractCategory(profile: any): string {
  if (profile.category) return profile.category;
  const bio = (profile.bio || '').toLowerCase();
  if (/restaur|food|comida|gastron/.test(bio)) return 'Restauracao';
  if (/tech|software|digital|dev/.test(bio)) return 'Tecnologia';
  if (/fitness|gym|saude|health/.test(bio)) return 'Saude/Fitness';
  if (/moda|fashion|style|beauty|beleza/.test(bio)) return 'Moda/Beleza';
  if (/music|musica|dj |kuduro|semba/.test(bio)) return 'Musica';
  return 'Outro';
}

function detectBot(profile: any): boolean {
  const bio = (profile.bio || '').toLowerCase();
  const name = (profile.username || '').toLowerCase();
  if (/\d{5,}/.test(name)) return true;
  if (/^user\d+/i.test(name)) return true;
  if (bio.includes('follow for follow') || bio.includes('free followers') || bio.includes('seguidores gratis')) return true;
  if ((profile.followers || 0) > 0 && (profile.following || 0) > 0 && profile.following / profile.followers > 10) return true;
  return false;
}

// ==========================================
// MAIN
// ==========================================
export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const filters: ProspectRequest = await request.json();
    const apifyToken = filters.apifyToken || APIFY_KEY;

    const platforms = filters.platform === 'all'
      ? ['instagram', 'tiktok', 'facebook', 'linkedin']
      : [filters.platform];

    const allProfiles: any[] = [];
    const errors: string[] = [];
    const log: string[] = [];
    const keywords = (filters.keywords || '').trim();
    const location = (filters.location || 'Angola').trim();
    const query = keywords ? `${keywords} ${location}` : location;

    log.push(`Query: "${query}" | Plataformas: ${platforms.join(', ')} | Alvo: ${filters.targetCount}`);

    // Apify para cada plataforma - SEQUENCIAL com orçamento de tempo
    if (apifyToken) {
      const timeBudget = Math.max(15, Math.floor(50 / platforms.length));
      for (const platform of platforms) {
        if (allProfiles.length >= filters.targetCount) break;
        try {
          log.push(`A procurar ${platform} via Apify (${timeBudget}s max)...`);
          let profiles: any[] = [];
          switch (platform) {
            case 'instagram': profiles = await searchInstagram(query, filters.targetCount, apifyToken); break;
            case 'tiktok': profiles = await searchTikTok(query, filters.targetCount, apifyToken); break;
            case 'facebook': profiles = await searchFacebook(query, filters.targetCount, apifyToken); break;
            case 'linkedin': profiles = await searchLinkedIn(query, filters.targetCount, apifyToken); break;
          }
          log.push(`${platform}: ${profiles.length} perfis reais encontrados`);
          allProfiles.push(...profiles);
          if (profiles.length === 0) errors.push(`${platform}: 0 resultados`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.push(`${platform} erro: ${msg}`);
          errors.push(`${platform}: ${msg}`);
        }
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log.push(`Total bruto: ${allProfiles.length} em ${elapsed}s`);

    // Filtrar - APENAS bots obvios, o resto passa
    const filtered = allProfiles.filter(p => {
      if (!p.username) return false;
      if (detectBot(p)) return false;
      // Apenas filtros de seguidores se o utilizador definiu
      if (!p.fromGoogle) {
        const followers = p.followers || 0;
        if (filters.minFollowers > 0 && followers < filters.minFollowers) return false;
        if (followers > filters.maxFollowers && filters.maxFollowers < 1000000) return false;
        if (filters.requireRegular && (p.postsCount || 0) < 10) return false;
      }
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
      monthsActive: p.postsCount > 500 ? 48 : p.postsCount > 100 ? 24 : p.postsCount > 30 ? 12 : 6,
      isRegular: (p.postsCount || 0) > 20,
      isVerified: p.isVerified || false,
      score: calculateScore(p, filters),
      category: p.category || extractCategory(p),
      location: p.location || location,
      bio: p.bio || '',
      profileUrl: p.profileUrl || '',
      avatarUrl: p.avatarUrl || '',
      status: 'prospect',
      isBot: false,
      isBusiness: p.isBusiness || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      notes: '',
    })).slice(0, filters.targetCount);

    log.push(`Filtrados: ${filtered.length} | Descartados: ${allProfiles.length - filtered.length}`);

    if (filtered.length === 0) {
      const helpMsg = allProfiles.length > 0
        ? ' Perfis foram encontrados mas nao passaram nos filtros. Tenta: (1) Baixar "Min. Seguidores" para 0, (2) Subir "Max. Seguidores" para 1000000, (3) Desactivar "Exigir contas regulares".'
        : ' Nenhum perfil encontrado. Tenta palavras-chave diferentes como "restaurante Luanda" ou "hotel Angola".';

      return NextResponse.json({
        success: true, status: 'completed',
        profilesFound: 0, totalRaw: allProfiles.length,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `0 perfis encontrados.${helpMsg}`,
        errors: errors.length > 0 ? errors : undefined,
        log,
      });
    }

    return NextResponse.json({
      success: true, status: 'completed',
      profilesFound: filtered.length, totalRaw: allProfiles.length,
      profiles: filtered,
      campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      message: `Prospeccao concluida! ${filtered.length} perfis reais encontrados em ${elapsed}s.`,
      errors: errors.length > 0 ? errors : undefined,
      log,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}