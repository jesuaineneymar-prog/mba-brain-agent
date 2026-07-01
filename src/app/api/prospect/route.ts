import { NextResponse } from 'next/server';

// ==========================================
// PROSPECCAO - DuckDuckGo proxy + fallback inteligente
// DuckDuckGo permite requests de servidor (ao contrario do Google)
// ==========================================

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
    const warnings: string[] = [];
    const keywords = (filters.keywords || '').trim();
    const location = (filters.location || 'Angola').trim();
    const query = keywords ? `${keywords} ${location}` : location;

    const results = await Promise.allSettled(
      platforms.map(async (platform) => {
        try {
          let profiles: any[] = [];
          switch (platform) {
            case 'instagram': profiles = await searchInstagram(query, filters.targetCount); break;
            case 'tiktok': profiles = await searchTikTok(query, filters.targetCount); break;
            case 'facebook': profiles = await searchFacebook(query, filters.targetCount); break;
            case 'linkedin': profiles = await searchLinkedIn(query, filters.targetCount); break;
          }
          console.log(`[MBA] ${platform}: ${profiles.length} perfis`);
          return { platform, profiles, warning: profiles.length === 0 ? `${platform}: sem resultados via DuckDuckGo` : null };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[MBA] ${platform}:`, msg);
          return { platform, profiles: [], warning: `${platform}: ${msg}` };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allProfiles.push(...r.value.profiles);
        if (r.value.warning) warnings.push(r.value.warning);
      }
    }

    // Se nenhuma plataforma real retornou resultados, usar dados de demonstracao
    const useDemo = allProfiles.length === 0;
    let demoProfiles: any[] = [];
    if (useDemo) {
      demoProfiles = generateDemoProfiles(query, platforms, filters.targetCount);
      console.log(`[MBA] Modo demonstracao: ${demoProfiles.length} perfis gerados`);
    }

    const source = useDemo ? demoProfiles : allProfiles;

    const filtered = source.filter(p => {
      const followers = p.followers || 0;
      if (!useDemo && (followers < filters.minFollowers || followers > filters.maxFollowers)) return false;
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
      isBot: false,
      isBusiness: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      notes: '',
    })).slice(0, filters.targetCount);

    const msg = useDemo
      ? `Modo demonstracao: ${filtered.length} perfis gerados para "${query}". As plataformas estao a bloquear pedidos do servidor Vercel. Para resultados reais, usa a app localmente com "bun run dev".`
      : (filtered.length > 0
        ? `Prospeccao concluida! ${filtered.length} perfis encontrados.`
        : `${allProfiles.length} perfis encontrados mas todos filtrados. Tenta reduzir seguidores minimos.`);

    return NextResponse.json({
      success: true,
      status: 'completed',
      profilesFound: filtered.length,
      totalRaw: source.length,
      profiles: filtered,
      demo: useDemo,
      campaignName: filters.campaignName || `Campanha ${new Date().toLocaleDateString('pt-PT')}`,
      message: msg,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('Prospect error:', error);
    return NextResponse.json({ error: 'Erro: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

// ==========================================
// DUCKDUCKGO PROXY - funciona de servidores
// ==========================================
async function duckSearch(query: string, site: string, limit: number): Promise<{ usernames: string[], html: string }> {
  const searchQuery = site ? `${query} site:${site}` : query;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html',
      'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    },
  });

  if (!res.ok) return { usernames: [], html: '' };

  const html = await res.text();
  const usernames: string[] = [];

  // DuckDuckGo HTML results contain links in <a class="result__a" href="...">
  const linkRegex = /href="(https?:\/\/[^"]+)"/g;
  const siteDomain = site.replace('www.', '').replace('https://', '').replace('http://', '').replace(/\/.*$/, '');

  let m;
  const seen = new Set<string>();
  while ((m = linkRegex.exec(html)) !== null) {
    const link = m[1];
    if (link.includes(siteDomain) || (siteDomain === '')) {
      // Extract username from the URL
      const patterns: Record<string, RegExp> = {
        'instagram.com': /instagram\.com\/([a-zA-Z0-9_.]+)\/?$/,
        'tiktok.com': /tiktok\.com\/@([a-zA-Z0-9_.]+)/,
        'facebook.com': /facebook\.com\/([a-zA-Z0-9_.]+)\/?$/,
        'linkedin.com': /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/,
      };
      const pattern = patterns[siteDomain];
      if (pattern) {
        const match = link.match(pattern);
        if (match && match[1] && !seen.has(match[1])) {
          const u = match[1];
          // Filter out generic pages
          if (!['p', 'explore', 'reel', 'stories', 'direct', 'accounts', 'watch', 'reel', 'groups', 'events', 'marketplace', 'login', 'help', 'about', 'privacy', 'terms', 'sitemap'].includes(u.toLowerCase())) {
            usernames.push(u);
            seen.add(u);
          }
        }
      }
    }
    if (usernames.length >= limit) break;
  }

  return { usernames, html };
}

// ==========================================
// INSTAGRAM via DuckDuckGo
// ==========================================
async function searchInstagram(query: string, limit: number): Promise<any[]> {
  const { usernames } = await duckSearch(query, 'instagram.com', limit);
  if (usernames.length === 0) return [];

  return usernames.map(username => ({
    platform: 'instagram',
    username,
    fullName: username.replace(/[._]/g, ' '),
    followers: 0, following: 0, postsCount: 0,
    bio: '', profileUrl: `https://instagram.com/${username}`,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=C0001C&color=fff&size=128`,
    isVerified: false, isBusiness: false,
    location: '', category: '', externalId: '',
  }));
}

// ==========================================
// TIKTOK via DuckDuckGo
// ==========================================
async function searchTikTok(query: string, limit: number): Promise<any[]> {
  const { usernames } = await duckSearch(query, 'tiktok.com', limit);
  if (usernames.length === 0) return [];

  return usernames.map(username => ({
    platform: 'tiktok',
    username,
    fullName: username,
    followers: 0, following: 0, postsCount: 0,
    bio: '', profileUrl: `https://tiktok.com/@${username}`,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=000000&color=ff0050&size=128`,
    isVerified: false, isBusiness: false,
    location: '', category: '', externalId: '',
  }));
}

// ==========================================
// FACEBOOK via Graph API + DuckDuckGo fallback
// ==========================================
async function searchFacebook(query: string, limit: number): Promise<any[]> {
  // Try Graph API first
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/pages/search?q=${encodeURIComponent(query)}&fields=id,name,category,fan_count,description&limit=${limit}&access_token=${META_TOKEN}`
    );
    if (res.ok) {
      const data = await res.json();
      const pages = data?.data || [];
      if (pages.length > 0) {
        return pages.map((p: any) => ({
          platform: 'facebook',
          username: p.username || `page_${p.id}`,
          fullName: p.name || '',
          followers: p.fan_count || 0,
          following: 0, postsCount: 0,
          bio: (p.description || '').substring(0, 200),
          profileUrl: `https://facebook.com/${p.id}`,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'FB')}&background=1877F2&color=fff&size=128`,
          isVerified: false, isBusiness: true,
          location: '', category: p.category || '',
          externalId: p.id || '',
        }));
      }
    }
  } catch { /* fallback to DuckDuckGo */ }

  const { usernames } = await duckSearch(query, 'facebook.com', limit);
  return usernames.map(username => ({
    platform: 'facebook',
    username,
    fullName: username.replace(/[._]/g, ' '),
    followers: 0, following: 0, postsCount: 0,
    bio: '', profileUrl: `https://facebook.com/${username}`,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1877F2&color=fff&size=128`,
    isVerified: false, isBusiness: false,
    location: '', category: '', externalId: '',
  }));
}

// ==========================================
// LINKEDIN via DuckDuckGo
// ==========================================
async function searchLinkedIn(query: string, limit: number): Promise<any[]> {
  const { usernames } = await duckSearch(query, 'linkedin.com', limit);
  return usernames.map(username => ({
    platform: 'linkedin',
    username,
    fullName: username.replace(/[-_]/g, ' '),
    followers: 0, following: 0, postsCount: 0,
    bio: '', profileUrl: `https://linkedin.com/in/${username}`,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0A66C2&color=fff&size=128`,
    isVerified: false, isBusiness: false,
    location: '', category: '', externalId: '',
  }));
}

// ==========================================
// DEMO DATA - perfis realistas quando APIs falham
// ==========================================
function generateDemoProfiles(query: string, platforms: string[], count: number): any[] {
  const kw = query.toLowerCase();
  const isFood = /restaur|food|comida|hotel|cafe|gastron|churras|pizza/.test(kw);
  const isTech = /tech|software|digital|programador|developer|startup|dev|ti/.test(kw);
  const isMusic = /music|musica|dj |kuduro|semba|kizomba|artista|cantor|rapper|producer/.test(kw);
  const isFashion = /moda|fashion|style|beauty|beleza|makeup|cosmetic|hair|cabelo/.test(kw);
  const isFitness = /fitness|gym|saude|health|treino|academia|workout|nutri/.test(kw);

  const namesByCategory: Record<string, string[]> = {
    food: ['Chef Angola Gourmet', 'Sabor Luanda', 'Restaurante Kwanzas', 'Comida de Mae AO', 'Taste of Angola', 'Angola Foodie', 'Luanda Eats', 'Paladar Angolano', 'Cozinha Preta', 'Sabores de Africa', 'Bairro Gastro', 'Mesa de Angola', 'Gourmet Luanda', 'Prato Dia AO', 'Angola Kitchen'],
    tech: ['Dev Angola', 'Code Luanda', 'Angola Digital Hub', 'Tech Startup AO', 'Luanda Developers', 'Byte Angola', 'Angola IT Solutions', 'Dev Community AO', 'Startup Weekend Luanda', 'Code For Angola', 'Digital Luanda', 'AO Innovate', 'Tech Hub Angola', 'Angola Devs', 'Programador AO'],
    music: ['DJ Kuduro AO', 'Semba Master', 'Kizomba Star', 'Angola Beats', 'Producer Luanda', 'MC Angola', 'Kuduro Nation', 'Rapper AO', 'Musica Angolana', 'Sound of Luanda', 'Afro Beat AO', 'Studio Angola', 'Vocalista AO', 'DJ Luanda Mix', 'Angola Rhythm'],
    fashion: ['Style Angola', 'Moda Luanda', 'Fashion AO', 'Beleza Preta', 'Angola Trends', 'Styled in Luanda', 'Fashion Designer AO', 'Look Angola', 'African Style AO', 'Moda Africana', 'Glam Angola', 'Outfit Luanda', 'Beauty Angola', 'Trend AO', 'Fashion Week Luanda'],
    fitness: ['Fit Angola', 'Gym Luanda', 'Saude AO', 'Workout Angola', 'Trainer Luanda', 'Fitness Hub AO', 'Nutricao Angola', 'Academia Luanda', 'Fit Life AO', 'Health Angola', 'Gym Motivation AO', 'Body Fit Luanda', 'Active Angola', 'Sports AO', 'Wellness Luanda'],
    general: ['Angola Creator', 'Luanda Life', 'Angola Digital', 'Content AO', 'Luanda Vibes', 'Angola Online', 'Life in Luanda', 'AO Creative', 'Angola Business', 'Luanda Hustle', 'Young Angola', 'AO Influence', 'Africa Creator', 'Luanda Social', 'Angola Voice'],
  };

  let category = 'general';
  if (isFood) category = 'food';
  else if (isTech) category = 'tech';
  else if (isMusic) category = 'music';
  else if (isFashion) category = 'fashion';
  else if (isFitness) category = 'fitness';

  const names = namesByCategory[category];
  const profiles: any[] = [];
  const usedPlatforms = platforms.length > 0 ? platforms : ['instagram', 'tiktok', 'facebook', 'linkedin'];

  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const platform = usedPlatforms[i % usedPlatforms.length];
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const followers = Math.floor(Math.random() * 45000) + 1000;
    const posts = Math.floor(Math.random() * 300) + 20;

    profiles.push({
      platform,
      username: username + (i >= names.length ? String(i - names.length + 1) : ''),
      fullName: name,
      followers,
      following: Math.floor(followers * (Math.random() * 0.5 + 0.1)),
      postsCount: posts,
      monthsActive: posts > 200 ? 36 : posts > 100 ? 24 : posts > 30 ? 12 : 6,
      bio: `Conteudo sobre ${query}. ${category === 'food' ? 'Comida e gastronomia angolana.' : category === 'tech' ? 'Tecnologia e inovacao em Angola.' : category === 'music' ? 'Musica e cultura angolana.' : category === 'fashion' ? 'Moda e estilo africano.' : category === 'fitness' ? 'Saude e bem-estar.' : 'Criador de conteudo em Angola.'} Segue para mais!`,
      profileUrl: platform === 'instagram' ? `https://instagram.com/${username}` :
                  platform === 'tiktok' ? `https://tiktok.com/@${username}` :
                  platform === 'facebook' ? `https://facebook.com/${username}` :
                  `https://linkedin.com/in/${username}`,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${platform === 'instagram' ? 'C0001C' : platform === 'tiktok' ? '000000' : platform === 'facebook' ? '1877F2' : '0A66C2'}&color=fff&size=128&bold=true`,
      isVerified: false,
      isBusiness: false,
      location: 'Luanda, Angola',
      category: category === 'food' ? 'Restauracao' : category === 'tech' ? 'Tecnologia' : category === 'music' ? 'Musica' : category === 'fashion' ? 'Moda' : category === 'fitness' ? 'Saude' : 'Outro',
      externalId: '',
    });
  }

  return profiles;
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
}// force redeploy Wed Jul  1 00:39:50 UTC 2026
