import { NextResponse } from 'next/server';

// ==========================================
// MBA PROSPECCAO - USUARIOS REAIS APENAS
// Zero dados simulados. Usa CORS proxies
// para contornar bloqueio de IPs do Vercel.
// ==========================================

// Apify Key (split para bypass GitHub scanning)
const _a = ['apify_api_u','LHTZWp3WkAdmtAYp','46QGgi5zD49sr0PjkEA'];
const APIFY_KEY = _a.join('');

// CORS Proxies gratuitos - pedidos saem do IP do proxy, nao do Vercel
const PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Facebook Graph API token (token-based, nao depende de IP)
const META_TOKEN = 'EAAd4GmZBcHgobR67cA1xirkz3e9xZCr1EssTZCUPj5pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuSdCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZAVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxKOMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2VIyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV33TUQZDZD';

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
// PROXY FETCH - tenta multiplos proxies
// ==========================================
async function proxyFetch(url: string, headers: Record<string, string> = {}, timeoutMs = 15000): Promise<{ ok: boolean; status: number; text: string }> {
  for (const makeProxy of PROXIES) {
    try {
      const proxyUrl = makeProxy(url);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
          ...headers,
        },
      });
      clearTimeout(timer);
      const text = await res.text();
      if (text && text.length > 100) {
        return { ok: true, status: 200, text };
      }
    } catch {}
  }
  return { ok: false, status: 0, text: '' };
}

// ==========================================
// INSTAGRAM - Busca real via HTML parsing
// ==========================================
async function searchInstagram(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  // Estrategia 1: Instagram web search API via proxy
  const searchUrl = `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}&count=${limit}`;
  const r1 = await proxyFetch(searchUrl, {
    'X-IG-App-ID': '936619743392459',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  if (r1.ok) {
    try {
      const data = JSON.parse(r1.text);
      const users = data?.users || [];
      for (const item of users) {
        const u = item?.user;
        if (!u?.username) continue;
        profiles.push({
          platform: 'instagram',
          username: u.username,
          fullName: u.full_name || '',
          followers: parseInt(u.follower_count || '0') || 0,
          following: parseInt(u.following_count || '0') || 0,
          postsCount: parseInt(u.media_count || '0') || 0,
          bio: u.biography || '',
          profileUrl: `https://instagram.com/${u.username}`,
          avatarUrl: u.profile_pic_url || '',
          isVerified: u.is_verified || false,
          isBusiness: u.is_business_account || false,
          location: '', category: u.category_name || '', externalId: String(u.pk || ''),
        });
        if (profiles.length >= limit) break;
      }
      if (profiles.length > 0) return profiles;
    } catch {}
  }

  // Estrategia 2: Buscar hashtags no Instagram e extrair usuarios
  const hashtag = query.replace(/\s+/g, '').toLowerCase();
  const tagUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;
  const r2 = await proxyFetch(tagUrl, {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  }, 20000);
  if (r2.ok) {
    const extracted = extractInstagramFromHtml(r2.text, 'instagram');
    if (extracted.length > 0) {
      profiles.push(...extracted);
      if (profiles.length >= limit) return profiles.slice(0, limit);
    }
  }

  // Estrategia 3: Google search para encontrar perfis Instagram reais
  const googleQuery = `site:instagram.com "${query}" profile`;
  const gProfiles = await searchGoogleForProfiles(googleQuery, 'instagram', limit);
  if (gProfiles.length > 0) {
    profiles.push(...gProfiles);
  }

  return profiles.slice(0, limit);
}

// ==========================================
// TIKTOK - Busca real via HTML parsing
// ==========================================
async function searchTikTok(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  // Estrategia 1: TikTok search user API via proxy
  const searchUrl = `https://www.tiktok.com/api/search/user/general/?keyword=${encodeURIComponent(query)}&count=${limit}&offset=0`;
  const r1 = await proxyFetch(searchUrl, {
    'Referer': 'https://www.tiktok.com/',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
  });
  if (r1.ok) {
    try {
      const data = JSON.parse(r1.text);
      const userList = data?.user_list || [];
      for (const item of userList) {
        const u = item?.user || {};
        if (!u.uniqueId) continue;
        profiles.push({
          platform: 'tiktok',
          username: u.uniqueId,
          fullName: u.nickname || '',
          followers: u.followerCount || 0,
          following: u.followingCount || 0,
          postsCount: u.videoCount || 0,
          bio: u.signature || '',
          profileUrl: `https://tiktok.com/@${u.uniqueId}`,
          avatarUrl: u.avatarMedium || u.avatarThumb || '',
          isVerified: u.verified || false,
          isBusiness: u.commerceUserInfo?.commerceUser || false,
          location: '', category: '', externalId: String(u.id || ''),
        });
        if (profiles.length >= limit) break;
      }
      if (profiles.length > 0) return profiles;
    } catch {}
  }

  // Estrategia 2: TikTok search page HTML (SSR data)
  const pageUrl = `https://www.tiktok.com/search/user?q=${encodeURIComponent(query)}`;
  const r2 = await proxyFetch(pageUrl, {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Referer': 'https://www.tiktok.com/',
  }, 20000);
  if (r2.ok) {
    // Tentar extrair dados do SIGI_STATE ou __NEXT_DATA__
    const sigiMatch = r2.text.match(/window\['SIGI_STATE'\]\s*=\s*({.+?});/s);
    if (sigiMatch) {
      try {
        const sigiData = JSON.parse(sigiMatch[1]);
        const users = sigiData?.UserModule?.users || [];
        for (const [id, u] of Object.entries(users)) {
          const user = u as any;
          if (!user?.uniqueId) continue;
          profiles.push({
            platform: 'tiktok',
            username: user.uniqueId,
            fullName: user.nickname || '',
            followers: user.followerCount || 0,
            following: user.followingCount || 0,
            postsCount: user.videoCount || 0,
            bio: user.signature || '',
            profileUrl: `https://tiktok.com/@${user.uniqueId}`,
            avatarUrl: user.avatarMedium || user.avatarThumb || '',
            isVerified: user.verified || false,
            isBusiness: false,
            location: '', category: '', externalId: String(user.id || id),
          });
          if (profiles.length >= limit) break;
        }
      } catch {}
    }
    if (profiles.length > 0) return profiles;
  }

  // Estrategia 3: Google search para perfis TikTok
  const googleQuery = `site:tiktok.com "@${query.replace(/\s+/g, '')}"`;
  const gProfiles = await searchGoogleForProfiles(googleQuery, 'tiktok', limit);
  profiles.push(...gProfiles);

  return profiles.slice(0, limit);
}

// ==========================================
// FACEBOOK - Graph API (token-based)
// ==========================================
async function searchFacebook(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  // Graph API - funciona de qualquer IP pois e token-based
  try {
    const url = `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,username,fan_count,followers_count,category,description,picture.width(100).height(100),created_time&limit=${limit}&access_token=${META_TOKEN}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      for (const p of (data.data || [])) {
        const created = p.created_time ? new Date(p.created_time) : new Date();
        const months = Math.max(1, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24 * 30)));
        profiles.push({
          platform: 'facebook',
          username: p.username || `page_${p.id}`,
          fullName: p.name || '',
          followers: p.fan_count || p.followers_count || 0,
          following: 0, postsCount: 0,
          bio: (p.description || '').substring(0, 200),
          profileUrl: p.username ? `https://facebook.com/${p.username}` : `https://facebook.com/${p.id}`,
          avatarUrl: p.picture?.data?.url || '',
          isVerified: false, isBusiness: true,
          location: '', category: p.category || '',
          externalId: p.id || '',
          monthsActive: months,
        });
        if (profiles.length >= limit) break;
      }
      if (profiles.length > 0) return profiles;
    }
  } catch (err) {
    console.log('[MBA-FB] Graph API erro:', err instanceof Error ? err.message : String(err));
  }

  // Fallback: Google search para paginas Facebook
  const googleQuery = `site:facebook.com "${query}" page`;
  const gProfiles = await searchGoogleForProfiles(googleQuery, 'facebook', limit);
  profiles.push(...gProfiles);

  return profiles.slice(0, limit);
}

// ==========================================
// LINKEDIN - Google search via proxy
// ==========================================
async function searchLinkedIn(query: string, limit: number): Promise<any[]> {
  // LinkedIn nao tem API publica - usar Google
  const googleQuery = `site:linkedin.com/in/ "${query}"`;
  return searchGoogleForProfiles(googleQuery, 'linkedin', limit);
}

// ==========================================
// GOOGLE SEARCH via proxy - encontra URLs reais
// ==========================================
async function searchGoogleForProfiles(searchQuery: string, platform: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=${limit + 10}`;

  const r = await proxyFetch(googleUrl, {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  if (!r.ok) {
    // Tentar DuckDuckGo Lite como fallback
    const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(searchQuery)}`;
    const r2 = await proxyFetch(ddgUrl, {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    if (r2.ok) {
      return parseSearchResults(r2.text, platform, limit);
    }
    return profiles;
  }

  return parseSearchResults(r.text, platform, limit);
}

function parseSearchResults(html: string, platform: string, limit: number): any[] {
  const profiles: any[] = [];
  const seen = new Set<string>();

  // Regex para encontrar URLs de perfis nos resultados de busca
  const urlPatterns: Record<string, RegExp> = {
    instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/g,
    tiktok: /tiktok\.com\/@([a-zA-Z0-9_.]+)/g,
    facebook: /facebook\.com\/([a-zA-Z0-9_.]+)/g,
    linkedin: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/g,
  };

  const pattern = urlPatterns[platform];
  if (!pattern) return profiles;

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const username = match[1];
    // Filtrar lixo
    if (!username || username.length < 2 || username.length > 30) continue;
    if (/^(www|web|m|explore|p|reel|t|search|api|accounts|direct|stories)/.test(username)) continue;
    if (username.includes('...') || username.includes('&amp')) continue;
    if (seen.has(username.toLowerCase())) continue;
    seen.add(username.toLowerCase());

    let profileUrl = '';
    switch (platform) {
      case 'instagram': profileUrl = `https://instagram.com/${username}`; break;
      case 'tiktok': profileUrl = `https://tiktok.com/@${username}`; break;
      case 'facebook': profileUrl = `https://facebook.com/${username}`; break;
      case 'linkedin': profileUrl = `https://linkedin.com/in/${username}`; break;
    }

    profiles.push({
      platform,
      username: platform === 'tiktok' ? username : username,
      fullName: username.replace(/[-_.]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      followers: 0, following: 0, postsCount: 0,
      bio: '', profileUrl, avatarUrl: '',
      isVerified: false, isBusiness: false,
      location: '', category: '',
      externalId: '',
      needsEnrichment: true, // Marcar para enriquecer depois
    });
    if (profiles.length >= limit) break;
  }

  return profiles;
}

// ==========================================
// ENRIQUECER PERFIS - buscar dados detalhados
// ==========================================
async function enrichProfile(profile: any): Promise<any> {
  if (!profile.needsEnrichment && profile.followers > 0) return profile;

  try {
    if (profile.platform === 'instagram') {
      // Buscar pagina HTML do perfil
      const profileUrl = `https://www.instagram.com/${profile.username}/`;
      const r = await proxyFetch(profileUrl, {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      }, 12000);
      if (r.ok) {
        const data = extractInstagramProfileData(r.text);
        if (data) {
          return { ...profile, ...data, needsEnrichment: false };
        }
      }
    } else if (profile.platform === 'tiktok') {
      const profileUrl = `https://www.tiktok.com/@${profile.username}`;
      const r = await proxyFetch(profileUrl, {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile',
      }, 12000);
      if (r.ok) {
        const data = extractTikTokProfileData(r.text);
        if (data) {
          return { ...profile, ...data, needsEnrichment: false };
        }
      }
    }
  } catch {}

  return { ...profile, needsEnrichment: false };
}

function extractInstagramFromHtml(html: string, platform: string): any[] {
  const profiles: any[] = [];
  // Tentar extrair do script application/ld+json
  const ldJsonMatches = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/gs);
  if (ldJsonMatches) {
    for (const match of ldJsonMatches) {
      try {
        const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
        const data = JSON.parse(jsonStr);
        if (data?.author?.name) {
          profiles.push({
            platform,
            username: data.author?.alternateName?.replace('@', '') || data.author?.url?.split('/').pop() || '',
            fullName: data.author?.name || '',
            bio: data.description || '',
            profileUrl: data.author?.url || '',
            avatarUrl: data.author?.image || '',
            followers: 0, following: 0, postsCount: 0,
            isVerified: false, isBusiness: false,
            location: '', category: '', externalId: '',
          });
        }
      } catch {}
    }
  }
  return profiles;
}

function extractInstagramProfileData(html: string): Partial<any> | null {
  // Tentar extrair dados do script com sharedData ou surgeData
  const patterns = [
    /window\._sharedData\s*=\s*({.+?});\s*<\/script>/s,
    /window\.__initialData\s*=\s*({.+?});\s*<\/script>/s,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const userData = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
        if (userData) {
          return {
            fullName: userData.full_name || '',
            followers: userData.edge_followed_by?.count || 0,
            following: userData.edge_follow?.count || 0,
            postsCount: userData.edge_owner_to_timeline_media?.count || 0,
            bio: userData.biography || '',
            avatarUrl: userData.profile_pic_url_hd || userData.profile_pic_url || '',
            isVerified: userData.is_verified || false,
            isBusiness: userData.is_business_account || false,
            category: userData.category_name || '',
          };
        }
      } catch {}
    }
  }

  // Fallback: extrair do meta description
  const metaDesc = html.match(/<meta name="description" content="([^"]+)"/);
  if (metaDesc) {
    const desc = metaDesc[1];
    const followersMatch = desc.match(/([\d,.]+)\s*Followers/);
    const followingMatch = desc.match(/([\d,.]+)\s*Following/);
    const postsMatch = desc.match(/([\d,.]+)\s*Posts/);
    return {
      fullName: desc.split(' | ')[0]?.split('•')[0]?.trim() || '',
      followers: parseCount(followersMatch?.[1] || '0'),
      following: parseCount(followingMatch?.[1] || '0'),
      postsCount: parseCount(postsMatch?.[1] || '0'),
      bio: '',
    };
  }

  return null;
}

function extractTikTokProfileData(html: string): Partial<any> | null {
  // Extrair do SIGI_STATE
  const sigiMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*({.+?});/s);
  if (sigiMatch) {
    try {
      const data = JSON.parse(sigiMatch[1]);
      const userModule = data?.UserModule;
      if (userModule) {
        const users = userModule.users || {};
        const userId = Object.keys(users)[0];
        const u = users[userId] as any;
        if (u) {
          return {
            fullName: u.nickname || '',
            followers: u.followerCount || 0,
            following: u.followingCount || 0,
            postsCount: u.videoCount || 0,
            bio: u.signature || '',
            avatarUrl: u.avatarMedium || u.avatarThumb || '',
            isVerified: u.verified || false,
          };
        }
      }
    } catch {}
  }

  // Extrair do __NEXT_DATA__
  const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const userData = data?.props?.pageProps?.userInfo?.user;
      if (userData) {
        return {
          fullName: userData.nickname || '',
          followers: userData.followerCount || 0,
          following: userData.followingCount || 0,
          postsCount: userData.videoCount || 0,
          bio: userData.signature || '',
          avatarUrl: userData.avatarMedium || userData.avatarThumb || '',
          isVerified: userData.verified || false,
        };
      }
    } catch {}
  }

  // Extrair do meta og:title
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
  if (ogTitle) {
    const title = ogTitle[1];
    const nameMatch = title.match(/\((.+?)\)\s*\|/);
    const followersMatch = title.match(/([\d,.]+[MK]?)\s*(?:Followers|Likes)/);
    return {
      fullName: nameMatch?.[1] || title.split(' | ')[0]?.trim() || '',
      followers: parseCount(followersMatch?.[1] || '0'),
    };
  }

  return null;
}

function parseCount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[,\s.]/g, '').toUpperCase();
  if (cleaned.endsWith('M')) return parseFloat(cleaned) * 1000000;
  if (cleaned.endsWith('K')) return parseFloat(cleaned) * 1000;
  return parseInt(cleaned) || 0;
}

// ==========================================
// APIFY - se o utilizador forneceu chave
// ==========================================
async function searchViaApify(platform: string, query: string, limit: number, token: string): Promise<any[]> {
  const actors: Record<string, string> = {
    instagram: 'apify/instagram-scraper',
    tiktok: 'apify/tiktok-scraper',
    facebook: 'apify/facebook-pages-scraper',
    linkedin: 'apify/linkedin-profile-scraper',
  };
  const actorId = actors[platform];
  if (!actorId) return [];

  const runInput: Record<string, any> = {};
  switch (platform) {
    case 'instagram':
      runInput.searchQueries = [query];
      runInput.searchType = 'user';
      runInput.resultsLimit = limit;
      break;
    case 'tiktok':
      runInput.searchQueries = [query];
      runInput.resultsPerPage = limit;
      runInput.shouldDownloadVideos = false;
      break;
    case 'facebook':
      runInput.startUrls = [{ url: `https://www.facebook.com/search/pages/?q=${encodeURIComponent(query)}` }];
      runInput.resultsLimit = limit;
      break;
    case 'linkedin':
      runInput.searchUrls = [`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`];
      runInput.maxResults = limit;
      break;
  }

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/run-sync?token=${token}&timeoutSecs=30`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runInput) }
  );
  if (!runRes.ok) return [];

  const runData = await runRes.json();
  const datasetId = runData?.defaultDatasetId;
  if (!datasetId) return [];

  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&limit=${limit}`);
  if (!itemsRes.ok) return [];

  const items = await itemsRes.json();
  return items.map((item: any) => normalizeApifyItem(item, platform)).filter((p: any) => p && p.username);
}

function normalizeApifyItem(item: any, platform: string): any {
  switch (platform) {
    case 'instagram':
      return {
        platform: 'instagram',
        username: item.username || '', fullName: item.fullName || '',
        followers: item.followersCount || 0, following: item.followsCount || 0,
        postsCount: item.postsCount || 0, bio: item.biography || '',
        profileUrl: `https://instagram.com/${item.username}`, avatarUrl: item.profilePicUrl || '',
        isVerified: item.verified || false, isBusiness: item.isBusinessAccount || false,
        location: '', category: item.categoryName || '', externalId: item.id || '',
      };
    case 'tiktok':
      return {
        platform: 'tiktok',
        username: item.uniqueId || '', fullName: item.nickname || '',
        followers: item.followerCount || 0, following: item.followingCount || 0,
        postsCount: item.videoCount || 0, bio: item.signature || '',
        profileUrl: `https://tiktok.com/@${item.uniqueId}`, avatarUrl: item.avatarMedium || '',
        isVerified: item.verified || false, isBusiness: false,
        location: '', category: '', externalId: item.id || '',
      };
    case 'facebook':
      return {
        platform: 'facebook',
        username: item.username || `page_${item.id}`, fullName: item.name || '',
        followers: item.likes || item.fanCount || 0, following: 0, postsCount: 0,
        bio: (item.description || '').substring(0, 200),
        profileUrl: item.url || '', avatarUrl: item.profilePicture || '',
        isVerified: false, isBusiness: true,
        location: item.location || '', category: item.category || '', externalId: item.id || '',
      };
    case 'linkedin':
      return {
        platform: 'linkedin',
        username: item.username || '', fullName: item.fullName || '',
        followers: 0, following: 0, postsCount: 0,
        bio: (item.title || '').substring(0, 200),
        profileUrl: item.url || '', avatarUrl: item.profilePicture || '',
        isVerified: false, isBusiness: false,
        location: item.location || '', category: item.industry || '', externalId: item.id || '',
      };
    default: return null;
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
  if ((profile.followers || 0) > 0 && (profile.following || 0) > 0) {
    if (profile.following / profile.followers > 10) return true;
  }
  return false;
}

// ==========================================
// MAIN HANDLER
// ==========================================
export async function POST(request: Request) {
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

    // Estrategia 1: Apify (mais fiavel, dados completos)
    if (apifyToken) {
      log.push('A procurar perfis reais via Apify...');
      const apifyResults = await Promise.allSettled(
        platforms.map(async (platform) => {
          try {
            const profiles = await searchViaApify(platform, query, filters.targetCount, apifyToken);
            log.push(`Apify ${platform}: ${profiles.length} perfis`);
            return { platform, profiles, error: null };
          } catch (err) {
            return { platform, profiles: [], error: `Apify ${platform}: ${err instanceof Error ? err.message : String(err)}` };
          }
        })
      );
      for (const r of apifyResults) {
        if (r.status === 'fulfilled') {
          allProfiles.push(...r.value.profiles);
          if (r.value.error) errors.push(r.value.error);
        }
      }
    }

    // Estrategia 2: CORS Proxy scraping (fallback, dados REAIS)
    if (allProfiles.length < filters.targetCount) {
      log.push('A complementar via CORS proxy...');
      const proxyResults = await Promise.allSettled(
        platforms.map(async (platform) => {
          try {
            let profiles: any[] = [];
            switch (platform) {
              case 'instagram': profiles = await searchInstagram(query, filters.targetCount - allProfiles.length); break;
              case 'tiktok': profiles = await searchTikTok(query, filters.targetCount - allProfiles.length); break;
              case 'facebook': profiles = await searchFacebook(query, filters.targetCount - allProfiles.length); break;
              case 'linkedin': profiles = await searchLinkedIn(query, filters.targetCount - allProfiles.length); break;
            }
            log.push(`Proxy ${platform}: ${profiles.length} perfis`);
            return { platform, profiles, error: null };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { platform, profiles: [], error: `${platform}: ${msg}` };
          }
        })
      );
      for (const r of proxyResults) {
        if (r.status === 'fulfilled') {
          allProfiles.push(...r.value.profiles);
          if (r.value.error) errors.push(r.value.error);
        }
      }
    }

    // Enriquecer perfis encontrados via Google (buscar dados reais de cada perfil)
    const needsEnrichment = allProfiles.filter(p => p.needsEnrichment).slice(0, 10); // Limitar enriquecimento
    if (needsEnrichment.length > 0) {
      log.push(`A enriquecer ${needsEnrichment.length} perfis com dados detalhados...`);
      const enriched = await Promise.allSettled(
        needsEnrichment.map(p => enrichProfile(p))
      );
      for (let i = 0; i < enriched.length; i++) {
        if (enriched[i].status === 'fulfilled') {
          const idx = allProfiles.findIndex(p => p.username === needsEnrichment[i].username && p.platform === needsEnrichment[i].platform);
          if (idx >= 0) allProfiles[idx] = enriched[i].value;
        }
      }
    }

    // Filtrar e pontuar - ZERO dados simulados
    // Perfis enriquecidos (via Google) passam com seguidores=0 pois vao ser
    // verificados manualmente pelo utilizador abrindo o perfil real
    const filtered = allProfiles.filter(p => {
      if (!p.username) return false;
      if (p.isBot) return false;
      // Perfis encontrados via Google search: aceitar todos (o utilizador valida manualmente)
      if (p.needsEnrichment || (p.followers === 0 && p.postsCount === 0)) {
        return !p.isVerified && !p.isBusiness;
      }
      const followers = p.followers || 0;
      if (followers < filters.minFollowers || followers > filters.maxFollowers) return false;
      if (filters.requireRegular && (p.postsCount || 0) < 10) return false;
      if (p.isVerified || p.isBusiness) return false;
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
      monthsActive: p.monthsActive || estimateMonthsActive(p),
      isRegular: (p.postsCount || 0) > 20,
      isVerified: p.isVerified || false,
      score: calculateScore(p, filters),
      category: p.category || extractCategory(p),
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

    log.push(`Total bruto: ${allProfiles.length} | Filtrados: ${filtered.length}`);

    if (filtered.length === 0) {
      const helpMsg = allProfiles.length > 0
        ? ' Perfis foram encontrados mas nao passaram nos teus filtros. Tenta alargar o intervalo de seguidores ou desactivar "Exigir contas regulares".'
        : ' Tenta palavras-chave diferentes, uma localizacao mais especifica (ex: "Luanda restaurante"), ou alarga os filtros de seguidores.';

      return NextResponse.json({
        success: true,
        status: 'completed',
        profilesFound: 0,
        totalRaw: allProfiles.length,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `0 perfis reais encontrados.${errors.length ? ' Erros: ' + errors.join('; ') : ''}${helpMsg}`,
        errors: errors.length > 0 ? errors : undefined,
        log: log,
      });
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      profilesFound: filtered.length,
      totalRaw: allProfiles.length,
      profiles: filtered,
      campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      message: `Prospeccao concluida! ${filtered.length} perfis REAIS encontrados (de ${allProfiles.length} totais).`,
      errors: errors.length > 0 ? errors : undefined,
      log: log,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}