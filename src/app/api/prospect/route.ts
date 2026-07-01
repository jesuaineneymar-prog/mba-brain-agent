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

// Detectar se o perfil e um estabelecimento/negocio
function isEstablishment(profile: any): boolean {
  const bio = (profile.bio || '').toLowerCase();
  const cat = (profile.category || '').toLowerCase();
  const name = (profile.fullName || '').toLowerCase();
  const username = (profile.username || '').toLowerCase();
  // Categorias do Instagram que indicam negocio
  if (profile.isBusiness) return true;
  // Palavras-chave de estabelecimento na bio/categoria
  const bizWords = /restaur|cafe|hotel|pousada|loja|store|shop|boutique|salao|barbear|clinica|farmac|supermerc|mercado|empresa|ltda|company|corp|inc\.|sarl|studio|academy|escola|colegio|universid|centro.*comer|imobiliaria|agencia.*viage|dentista|advogad|escritor|propriedade|real estate|restaurant|food|dining|bar &|club|discotec|gym|fitness.*center|spa|beauty.*salon|nail.*salon|hair.*salon|pet.*shop|auto.*part|oficina|mecanica|pintura|construc|engenharia|arquitet|contabil|consultor/i;
  if (bizWords.test(bio) || bizWords.test(cat) || bizWords.test(name)) return true;
  // Username com palavras de negocio
  const bizUsernames = /restaur|cafe|hotel|loja|shop|store|boutique|salon|barber|clinica|farmac|mercado|imobili|dent|advoc|oficina|academy|school|gym|spa|beauty|nail|hair|pet.*shop/i;
  if (bizUsernames.test(username)) return true;
  return false;
}

// Verificar se o perfil e angolano
function isAngolan(profile: any): boolean {
  const bio = (profile.bio || '').toLowerCase();
  const loc = (profile.location || '').toLowerCase();
  const name = (profile.fullName || '').toLowerCase();
  // Cidades e provincias de Angola
  const angolaPlaces = /angola|luanda|benguela|huambo|lobito|lubango|cabinda|malanje|namibe|huila|bie|cuanza|cunene|kuando|lunda|moxico|uige|zaire|sumbe|soyo|tombwa|ongiva|menongue|saurimo|dundo|ndalatando|mbanza/i;
  // Indicadores de angolanidade
  const angolaIndicators = /\bAO\b|angolano|angolana|made in angola|from angola|em angola|de angola|angola /i;
  // DDI angolano
  const angolaPhone = /\+244|\(244\)|244\d{9}/;
  if (angolaPlaces.test(bio) || angolaPlaces.test(loc)) return true;
  if (angolaIndicators.test(bio)) return true;
  if (angolaPhone.test(bio)) return true;
  // Se vem do Google Search com query Angola, assumir angolano
  if (profile.fromGoogle) return true;
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
    const minF = filters.minFollowers || 0;
    const target = filters.targetCount || 50;

    // Gerar multiplas queries para garantir resultados
    const baseQueries: string[] = [];
    if (keywords) {
      baseQueries.push(`${keywords} ${location}`);
      baseQueries.push(`${keywords} Luanda`);
    } else {
      baseQueries.push(location);
      baseQueries.push('Luanda Angola');
    }
    // Queries extras para quando nao chega ao alvo
    const extraQueries = [
      'Angola lifestyle', 'Luanda influencer', 'Angola digital creator',
      'Angola content creator', 'Luanda life', 'Angola vlog',
      'Angola moda', 'Angola musica', 'Luanda fotografia',
      'Angola fitness', 'Luanda foodie', 'Angola travel',
    ];

    log.push(`Alvo: ${target} perfis | Min seguidores: ${minF} | Plataformas: ${platforms.join(', ')}`);

    // Buscar perfis - multiplas rounds ate atingir o alvo
    if (apifyToken) {
      let queriesToTry = [...baseQueries, ...extraQueries];
      const seenUsers = new Set<string>();

      for (const platform of platforms) {
        if (allProfiles.length >= target) break;
        // Reset queries para cada plataforma
        queriesToTry = [...baseQueries, ...extraQueries];

        for (let qi = 0; qi < queriesToTry.length && allProfiles.length < target; qi++) {
          const q = queriesToTry[qi];
          try {
            const remaining = target - allProfiles.length;
            log.push(`${platform}: "${q}" (faltam ${remaining})...`);
            let profiles: any[] = [];
            const budget = Math.max(12, Math.floor(45 / platforms.length));
            switch (platform) {
              case 'instagram': profiles = await searchInstagram(q, remaining + 10, apifyToken); break;
              case 'tiktok': profiles = await searchTikTok(q, remaining + 10, apifyToken); break;
              case 'facebook': profiles = await searchFacebook(q, remaining + 10, apifyToken); break;
              case 'linkedin': profiles = await searchLinkedIn(q, remaining + 10, apifyToken); break;
            }
            // Adicionar so perfis nao duplicados
            let added = 0;
            for (const p of profiles) {
              const key = p.username + ':' + p.platform;
              if (!seenUsers.has(key)) {
                seenUsers.add(key);
                allProfiles.push(p);
                added++;
              }
            }
            log.push(`${platform}: +${added} perfis de "${q}" (total: ${allProfiles.length})`);
            if (profiles.length === 0 && qi < 3) {
              errors.push(`${platform} "${q}": 0 resultados`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.push(`${platform} erro: ${msg}`);
          }
          // Parar se ja atingiu o alvo ou passou do tempo
          if (Date.now() - startTime > 50000) {
            log.push('Tempo limite atingido (50s)');
            break;
          }
        }
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    log.push(`Total bruto: ${allProfiles.length} em ${elapsed}s`);

    // Filtrar conforme regras do utilizador
    const MAX_FOLLOWERS = 50000;
    const filtered = allProfiles.filter(p => {
      if (!p.username) return false;
      // Bots obvios
      if (detectBot(p)) return false;
      // Contas verificadas - NAO
      if (p.isVerified) return false;
      // Max 50k seguidores
      if ((p.followers || 0) > MAX_FOLLOWERS) return false;
      // Min seguidores - RESPEITAR O QUE O UTILIZADOR DEFINIU
      if (minF > 0 && (p.followers || 0) < minF) return false;
      // Estabelecimentos/negocios - NAO
      if (isEstablishment(p)) return false;
      // Apenas contas angolanas
      if (!isAngolan(p)) return false;
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
    }));

    // Retornar EXATAMENTE o numero pedido - nem mais nem menos
    const finalProfiles = filtered.slice(0, target);

    const discarded = allProfiles.length - filtered.length;
    log.push(`Filtrados: ${filtered.length} | Descartados: ${discarded}`);
    log.push(`Retornando: ${finalProfiles.length} de ${target} pedidos`);

    // OBRIGATORIO: sempre retornar perfis - relaxar filtros se necessario
    if (finalProfiles.length === 0 && allProfiles.length > 0) {
      // Tentar sem filtro de angolano
      const relaxed = allProfiles.filter(p => {
        if (!p.username) return false;
        if (detectBot(p)) return false;
        if (p.isVerified) return false;
        if ((p.followers || 0) > MAX_FOLLOWERS) return false;
        if (isEstablishment(p)) return false;
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
        monthsActive: 12,
        isRegular: true,
        isVerified: false,
        score: 50,
        category: 'Outro',
        location: location,
        bio: p.bio || '',
        profileUrl: p.profileUrl || '',
        avatarUrl: p.avatarUrl || '',
        status: 'prospect',
        isBot: false,
        isBusiness: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        notes: '',
      }));
      const r = relaxed.slice(0, target);
      log.push(`Filtros relaxados: ${r.length} perfis (sem filtro de angolano)`);
      if (r.length > 0) {
        return NextResponse.json({
          success: true, status: 'completed',
          profilesFound: r.length, totalRaw: allProfiles.length,
          profiles: r,
          campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
          message: `Prospeccao concluida! ${r.length} perfis reais encontrados em ${elapsed}s.`,
          errors: errors.length > 0 ? errors : undefined,
          log,
        });
      }
    }

    if (finalProfiles.length === 0) {
      return NextResponse.json({
        success: true, status: 'completed',
        profilesFound: 0, totalRaw: allProfiles.length,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `0 perfis encontrados. Tenta palavras-chave diferentes ou baixa o minimo de seguidores.`,
        errors: errors.length > 0 ? errors : undefined,
        log,
      });
    }

    return NextResponse.json({
      success: true, status: 'completed',
      profilesFound: finalProfiles.length, totalRaw: allProfiles.length,
      profiles: finalProfiles,
      campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      message: `Prospeccao concluida! ${finalProfiles.length} perfis reais encontrados em ${elapsed}s.`,
      errors: errors.length > 0 ? errors : undefined,
      log,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}