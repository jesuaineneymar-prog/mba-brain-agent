import { NextResponse } from 'next/server';

// ==========================================
// PROSPECCAO DIRECTA - Sem Prisma, Sem DB
// Tudo guardado no frontend (localStorage)
// Este endpoint so faz scraping e retorna dados
// ==========================================

// Credenciais para scraping (fallbacks embutidos)
const META_TOKEN = 'EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuSdCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZAVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxKOMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2VIyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV33TUQZDZD';

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

    // Executar todas as plataformas em paralelo
    const results = await Promise.allSettled(
      platforms.map(async (platform) => {
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
          return { platform, profiles, error: null };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[MBA PROSPECT] ${platform} erro:`, msg);
          return { platform, profiles: [], error: msg };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allProfiles.push(...r.value.profiles);
        if (r.value.error) errors.push(`${r.value.platform}: ${r.value.error}`);
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

    if (filtered.length === 0 && allProfiles.length === 0) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        profilesFound: 0,
        totalRaw: 0,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `Nenhuma plataforma retornou resultados. Erros: ${errors.length > 0 ? errors.join('; ') : 'Verifica a tua ligacao e tenta novamente.'}`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    if (filtered.length === 0) {
      return NextResponse.json({
        success: true,
        status: 'completed',
        profilesFound: 0,
        totalRaw: allProfiles.length,
        profiles: [],
        campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
        message: `${allProfiles.length} perfis encontrados mas todos filtrados. Tenta: (1) reduzir seguidores minimos, (2) desmarcar "contas regulares", ou (3) usar palavras-chave mais especificas.${errors.length ? ' Avisos: ' + errors.join('; ') : ''}`,
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
// INSTAGRAM - Multi-strategy approach
// Strategy 1: Public JSON API (no auth)
// Strategy 2: HTML page scraping
// ==========================================
async function scrapeInstagram(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  // STRATEGY 1: Try public API with mobile headers
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=${encodeURIComponent(query)}&count=${limit}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.1.37 Mobile Safari/604.1',
          'X-IG-App-ID': '936619743392459',
          'Accept': 'application/json',
          'Accept-Language': 'pt-PT,pt;q=0.9',
          'X-Requested-With': 'com.instagram.android',
        },
        redirect: 'follow',
      }
    );

    if (res.ok) {
      const data = await res.json();
      const users = data?.users || [];
      for (const item of users) {
        const u = item?.user;
        if (!u || !u.username) continue;

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
          location: '',
          category: u.category_name || '',
          externalId: u.pk || '',
        });
      }
      if (profiles.length > 0) return profiles;
    }
  } catch (e) {
    console.log('[IG] Strategy 1 failed:', e instanceof Error ? e.message : 'unknown');
  }

  // STRATEGY 2: Scrape public Instagram search page HTML
  try {
    const res = await fetch(
      `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.1.37 Mobile Safari/604.1',
          'Accept': 'text/html,application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );

    if (res.ok) {
      const text = await res.text();
      // Try to parse as JSON (Instagram sometimes returns JSON with HTML wrapper)
      try {
        const jsonMatch = text.match(/\{["']users["']\s*:/);
        if (jsonMatch) {
          const startIdx = text.indexOf(jsonMatch[0]);
          // Find the matching closing brace
          let depth = 0;
          let endIdx = startIdx;
          for (let i = startIdx; i < text.length; i++) {
            if (text[i] === '{') depth++;
            if (text[i] === '}') depth--;
            if (depth === 0) { endIdx = i + 1; break; }
          }
          const jsonStr = text.substring(startIdx, endIdx);
          // This is embedded in a larger object, find the users array
          const usersMatch = jsonStr.match(/"users"\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/);
          if (usersMatch) {
            // Simple extraction of usernames from the JSON
            const usernameRegex = /"username"\s*:\s*"([^"]+)"/g;
            const fullNameRegex = /"full_name"\s*:\s*"([^"]+)"/g;
            const followerRegex = /"follower_count"\s*:\s*(\d+)/g;
            const picRegex = /"profile_pic_url"\s*:\s*"([^"]+)"/g;

            const usernames: string[] = [];
            const fullNames: string[] = [];
            const followerCounts: number[] = [];
            const picUrls: string[] = [];

            let m;
            while ((m = usernameRegex.exec(usersMatch[0])) !== null) usernames.push(m[1]);
            while ((m = fullNameRegex.exec(usersMatch[0])) !== null) fullNames.push(m[1]);
            while ((m = followerRegex.exec(usersMatch[0])) !== null) followerCounts.push(parseInt(m[1]) || 0);
            while ((m = picRegex.exec(usersMatch[0])) !== null) picUrls.push(m[1]);

            for (let i = 0; i < usernames.length && i < limit; i++) {
              profiles.push({
                platform: 'instagram',
                username: usernames[i],
                fullName: fullNames[i] || '',
                followers: followerCounts[i] || 0,
                following: 0,
                postsCount: 0,
                bio: '',
                profileUrl: `https://instagram.com/${usernames[i]}`,
                avatarUrl: picUrls[i] || '',
                isVerified: false,
                isBusiness: false,
                location: '',
                category: '',
                externalId: '',
              });
            }
          }
        }
      } catch {
        // HTML parsing failed, continue
      }
    }
  } catch (e) {
    console.log('[IG] Strategy 2 failed:', e instanceof Error ? e.message : 'unknown');
  }

  // STRATEGY 3: Use Google as proxy to find Instagram profiles
  if (profiles.length === 0) {
    try {
      const googleRes = await fetch(
        `https://www.google.com/search?q=site%3Ainstagram.com+${encodeURIComponent(query)}&num=${limit}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          },
        }
      );
      if (googleRes.ok) {
        const html = await googleRes.text();
        const igRegex = /instagram\.com\/([a-zA-Z0-9_.]+)/g;
        const matches: Set<string> = new Set();
        let m;
        while ((m = igRegex.exec(html)) !== null) {
          const u = m[1];
          // Filter out non-profile URLs
          if (u && !['p', 'explore', 'reel', 'stories', 'direct', 'accounts', 'www', 'api', 'web'].includes(u) && !u.includes('/')) {
            matches.add(u);
          }
        }
        for (const username of Array.from(matches).slice(0, limit)) {
          profiles.push({
            platform: 'instagram',
            username,
            fullName: username.replace(/[._]/g, ' '),
            followers: 0,
            following: 0,
            postsCount: 0,
            bio: '',
            profileUrl: `https://instagram.com/${username}`,
            avatarUrl: '',
            isVerified: false,
            isBusiness: false,
            location: '',
            category: '',
            externalId: '',
          });
        }
      }
    } catch (e) {
      console.log('[IG] Strategy 3 failed:', e instanceof Error ? e.message : 'unknown');
    }
  }

  if (profiles.length === 0) {
    throw new Error('Instagram nao retornou resultados. A sessao pode ter expirado.');
  }

  return profiles;
}

// ==========================================
// TIKTOK - Multi-strategy
// ==========================================
async function scrapeTikTok(query: string, limit: number): Promise<any[]> {
  const profiles: any[] = [];

  // STRATEGY 1: TikTok search API
  try {
    const res = await fetch(
      `https://www.tiktok.com/api/search/user/general/?keyword=${encodeURIComponent(query)}&count=${limit}&offset=0&source=normal`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
          'Accept': 'application/json',
        },
      }
    );

    if (res.ok) {
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
        if (profiles.length > 0) return profiles;
      } catch {
        // Not JSON, try HTML
      }
    }
  } catch (e) {
    console.log('[TT] Strategy 1 failed');
  }

  // STRATEGY 2: Google proxy
  if (profiles.length === 0) {
    try {
      const res = await fetch(
        `https://www.google.com/search?q=site%3Atiktok.com%2F%40+${encodeURIComponent(query)}&num=${limit}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } }
      );
      if (res.ok) {
        const html = await res.text();
        const ttRegex = /tiktok\.com\/@([a-zA-Z0-9_.]+)/g;
        const matches: Set<string> = new Set();
        let m;
        while ((m = ttRegex.exec(html)) !== null) {
          if (m[1]) matches.add(m[1]);
        }
        for (const username of Array.from(matches).slice(0, limit)) {
          profiles.push({
            platform: 'tiktok',
            username,
            fullName: username,
            followers: 0, following: 0, postsCount: 0,
            bio: '', profileUrl: `https://tiktok.com/@${username}`,
            avatarUrl: '', isVerified: false, isBusiness: false,
            location: '', category: '', externalId: '',
          });
        }
      }
    } catch { /* ignore */ }
  }

  return profiles;
}

// ==========================================
// FACEBOOK - Graph API
// ==========================================
async function scrapeFacebook(query: string, limit: number): Promise<any[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,username,fan_count,followers_count,category,description,picture.width(100).height(100)&limit=${limit}&access_token=${META_TOKEN}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.log('[FB] Graph API error:', res.status, errText.substring(0, 200));
      // Try Google proxy as fallback
      return scrapeFacebookGoogle(query, limit);
    }
    const data = await res.json();
    const pages = data?.data || [];
    if (pages.length === 0) return scrapeFacebookGoogle(query, limit);
    return pages.map((p: any) => ({
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
    }));
  } catch {
    return scrapeFacebookGoogle(query, limit);
  }
}

async function scrapeFacebookGoogle(query: string, limit: number): Promise<any[]> {
  try {
    const res = await fetch(
      `https://www.google.com/search?q=site%3Afacebook.com+${encodeURIComponent(query)}&num=${limit}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } }
    );
    if (!res.ok) return [];
    const html = await res.text();
    const fbRegex = /facebook\.com\/([a-zA-Z0-9_.]+)/g;
    const matches: Set<string> = new Set();
    let m;
    while ((m = fbRegex.exec(html)) !== null) {
      const u = m[1];
      if (u && !['watch', 'reel', 'stories', 'groups', 'events', 'marketplace', 'gaming', 'login', 'recover', 'help'].includes(u)) {
        matches.add(u);
      }
    }
    return Array.from(matches).slice(0, limit).map(username => ({
      platform: 'facebook', username,
      fullName: username.replace(/[._]/g, ' '),
      followers: 0, following: 0, postsCount: 0,
      bio: '', profileUrl: `https://facebook.com/${username}`,
      avatarUrl: '', isVerified: false, isBusiness: false,
      location: '', category: '', externalId: '',
    }));
  } catch { return []; }
}

// ==========================================
// LINKEDIN - Google proxy
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
      platform: 'linkedin', username,
      fullName: username.replace(/[-_]/g, ' '),
      followers: 0, following: 0, postsCount: 0,
      bio: '', profileUrl: `https://linkedin.com/in/${username}`,
      avatarUrl: '', isVerified: false, isBusiness: false,
      location: '', category: '', externalId: '',
    }));
  } catch { return []; }
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
  const verifiedPenalty = profile.isVerified ? -20 : 0;
  const businessPenalty = profile.isBusiness ? -15 : 0;
  return Math.max(0, Math.round(followerScore + postScore + bioScore + 20 + verifiedPenalty + businessPenalty));
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