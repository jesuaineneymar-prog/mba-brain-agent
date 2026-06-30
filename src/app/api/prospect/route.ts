import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const APIFY_TOKEN = process.env.APIFY_API_KEY || '';

// Actor IDs verificados na API do Apify - todos existem e activos
const ACTORS: Record<string, string> = {
  instagram: 'apify~instagram-scraper',
  tiktok: 'clockworks~tiktok-scraper',
  facebook: 'apify~facebook-search-scraper', // mudado: pages-scraper nao suporta busca por keyword
  linkedin: 'apify~google-search-scraper',
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

// In-memory store para polling (sobrevive entre requests no Vercel serverless)
const activeRuns: Record<string, { runIds: string[]; campaignId: string; filters: ProspectRequest; platforms: string[]; startedAt: number }> = {};

export async function POST(request: Request) {
  try {
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
      ? ['instagram', 'tiktok', 'facebook', 'linkedin']
      : [filters.platform];

    const runIds: string[] = [];
    const errors: string[] = [];

    // Verificar credenciais antes de comecar
    if (!APIFY_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'APIFY_API_KEY nao configurada. Va a Settings > Environment Variables no Vercel e adicione a variavel APIFY_API_KEY.',
      }, { status: 400 });
    }

    for (const platform of platforms) {
      const actorId = ACTORS[platform];
      if (!actorId) continue;

      try {
        // Passa o actorId como propriedade para o polling saber qual plataforma e qual actor
        const actorConfig = getActorConfig(platform, filters);
        console.log(`[MBA PROSPECT] ${platform} actor=${actorId} config:`, JSON.stringify(actorConfig).substring(0, 400));

        const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APIFY_TOKEN}`,
          },
          body: JSON.stringify(actorConfig),
        });

        if (runResponse.ok) {
          const runData = await runResponse.json();
          const runId = runData.data?.id || runData.id;
          if (runId) {
            runIds.push(runId);
            console.log(`[MBA PROSPECT] ${platform} run started: ${runId}`);
          }
        } else {
          const errText = await runResponse.text();
          errors.push(`${platform}: HTTP ${runResponse.status}`);
          console.error(`[MBA PROSPECT] ${platform} FAILED:`, runResponse.status, errText.substring(0, 500));
          await db.activityLog.create({
            data: { action: 'APIFY_ERROR', details: `Apify ${platform} (HTTP ${runResponse.status}): ${errText.substring(0, 500)}` },
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${platform}: ${errMsg}`);
        console.error(`[MBA PROSPECT] ${platform} exception:`, errMsg);
      }
    }

    const runKey = campaign.id;
    activeRuns[runKey] = { runIds, campaignId: campaign.id, filters, platforms, startedAt: Date.now() };

    await db.activityLog.create({
      data: {
        action: 'PROSPECT_STARTED',
        details: `Campanha "${campaign.name}": ${runIds.length}/${platforms.length} runs Apify [${platforms.join(', ')}]. ${errors.length ? 'Erros: ' + errors.join('; ') : 'OK'}`,
      },
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      status: 'running',
      apifyRuns: runIds,
      platformsLaunched: platforms,
      message: runIds.length > 0
        ? `Prospecção iniciada em ${runIds.length} plataformas: ${platforms.filter((_, i) => runIds[i]).join(', ')}. A processar dados reais...`
        : 'Nenhum run iniciado. Verifique as credenciais do Apify.',
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Prospect POST error:', error);
    return NextResponse.json({ error: 'Erro ao iniciar prospecção' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');

  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId obrigatorio' }, { status: 400 });
  }

  const runInfo = activeRuns[campaignId];
  if (!runInfo) {
    return NextResponse.json({ error: 'Prospecção não encontrada' }, { status: 404 });
  }

  const { runIds, campaignId: cid, filters, platforms } = runInfo;
  const statuses: Record<string, string> = {};
  let allProfiles: any[] = [];
  let allDone = true;
  const apiErrors: string[] = [];

  for (let i = 0; i < runIds.length; i++) {
    const runId = runIds[i];
    const platform = platforms[i] || 'unknown';
    try {
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
      if (!statusRes.ok) {
        statuses[runId] = 'ERROR';
        apiErrors.push(`${platform}: status check failed`);
        continue;
      }
      const statusData = await statusRes.json();
      const status = statusData.status || 'UNKNOWN';
      statuses[runId] = status;

      if (status === 'SUCCEEDED') {
        // Buscar resultados do dataset do run
        const datasetRes = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=1000`
        );
        if (datasetRes.ok) {
          const items = await datasetRes.json();
          const rawItems = Array.isArray(items) ? items : [];
          console.log(`[MBA PROSPECT] ${platform}: ${rawItems.length} raw items from Apify`);
          allProfiles = allProfiles.concat(rawItems.map(normalizeProfile(platform)));
        } else {
          apiErrors.push(`${platform}: dataset fetch failed`);
        }
      } else if (status === 'RUNNING' || status === 'READY') {
        allDone = false;
      } else if (status === 'FAILED') {
        apiErrors.push(`${platform}: run falhou no Apify`);
      } else if (status === 'ABORTED' || status === 'TIMED-OUT') {
        apiErrors.push(`${platform}: run ${status} no Apify`);
      } else {
        allDone = false;
      }
    } catch (err) {
      statuses[runId] = 'ERROR';
      apiErrors.push(`${platform}: ${String(err)}`);
    }
  }

  // Se todos terminaram e temos resultados
  if (allDone && allProfiles.length > 0) {
    const filtered = allProfiles.filter(p => {
      const followers = p.followers || 0;
      if (followers < filters.minFollowers || followers > filters.maxFollowers) return false;
      if (filters.requireRegular && (p.postsCount || 0) < 10) return false;
      if (p.isVerified || p.isBusiness) return false;
      if (p.isBot) return false;
      if (!p.username) return false;
      return true;
    }).slice(0, filters.targetCount);

    // Guardar perfis na DB (apenas uma vez)
    const existingCount = await db.profile.count({ where: { campaignId: cid } });
    if (existingCount === 0) {
      for (const profile of filtered) {
        await db.profile.create({
          data: {
            campaignId: cid,
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
        where: { id: cid },
        data: { sentCount: filtered.length, status: 'completed' },
      });

      await db.activityLog.create({
        data: {
          action: 'PROSPECT_COMPLETE',
          details: `Campanha "${filters.campaignName || cid}": ${filtered.length} perfis reais guardados (${allProfiles.length} raw, ${allProfiles.length - filtered.length} filtrados) [${platforms.join(', ')}]`,
        },
      });
    }

    delete activeRuns[campaignId];

    return NextResponse.json({
      status: 'completed',
      campaignId: cid,
      profilesFound: filtered.length,
      totalRaw: allProfiles.length,
      runStatuses: statuses,
    });
  }

  // Todos terminaram mas sem resultados
  if (allDone && allProfiles.length === 0) {
    delete activeRuns[campaignId];
    await db.campaign.update({ where: { id: cid }, data: { status: 'failed' } });
    return NextResponse.json({
      status: 'completed',
      campaignId: cid,
      profilesFound: 0,
      runStatuses: statuses,
      message: 'Nenhum perfil encontrado. Tente alterar palavras-chave ou filtros.',
      errors: apiErrors.length > 0 ? apiErrors : undefined,
    });
  }

  // Ainda a processar
  const elapsed = Math.round((Date.now() - runInfo.startedAt) / 1000);
  return NextResponse.json({
    status: 'running',
    campaignId: cid,
    runStatuses: statuses,
    elapsedSeconds: elapsed,
    message: `A prospecção está a processar há ${elapsed}s...${apiErrors.length > 0 ? ' Alertas: ' + apiErrors.join('; ') : ''}`,
  });
}

/**
 * Configs EXACTAS baseadas nos input schemas reais dos actors do Apify
 * Verificado via API: /v2/acts/{actorId} e documentação oficial
 */
function getActorConfig(platform: string, filters: ProspectRequest) {
  const keywords = (filters.keywords || '').trim();
  const location = (filters.location || 'Angola').trim();
  const count = Math.min(Math.max(filters.targetCount, 20), 250);

  switch (platform) {
    // ==========================================
    // INSTAGRAM - apify/instagram-scraper
    // Schema: search (string), searchType (enum), searchLimit (int)
    // ==========================================
    case 'instagram': {
      const searchTerm = keywords
        ? `${keywords} ${location}`
        : location;
      return {
        search: searchTerm,
        searchType: 'profile',  // EXACTO: enum values = hashtag|profile|place|user
        searchLimit: count,      // EXACTO: max 250
        resultsLimit: 1,        // 1 resultado por perfil (apenas metadata)
        addParentData: false,
      };
    }

    // ==========================================
    // TIKTOK - clockworks/tiktok-scraper
    // Schema: searchQueries (array), searchSection (string), maxProfilesPerQuery (int)
    // CRITICAL: searchSection="/user" para perfis, nao "/video" nem ""
    // ==========================================
    case 'tiktok': {
      const queries: string[] = [];
      if (keywords) {
        queries.push(keywords);
        if (location !== 'Angola') queries.push(`${keywords} ${location}`);
      } else {
        queries.push(location);
        queries.push(`trending ${location}`);
      }
      return {
        searchQueries: queries,             // EXACTO: array de strings
        searchSection: '/user',            // CRITICO: "/user" = perfis, "" = top, "/video" = videos
        maxProfilesPerQuery: count,       // EXACTO: so aplica quando searchSection="/user", default=10
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSlideshowImages: false,
        scrapeAdditionalAuthorMeta: true,   // traz dados completos do perfil
        proxyCountryCode: 'AO',           // proxy Angola para evitar geo-bloqueios
      };
    }

    // ==========================================
    // FACEBOOK - apify/facebook-search-scraper (NAO pages-scraper!)
    // O pages-scraper so aceita URLs directas
    // O search-scraper aceita queries de busca
    // ==========================================
    case 'facebook': {
      const searchQuery = keywords
        ? `${keywords} ${location}`
        : location;
      return {
        searchQueries: [searchQuery],  // Campo de busca
        maxResults: count,
        includeReviews: false,
      };
    }

    // ==========================================
    // LINKEDIN - apify/google-search-scraper
    // Schema: queries (string, newline-separated), site (string)
    // site="linkedin.com/in" adiciona automaticamente o operador site:
    // ==========================================
    case 'linkedin': {
      const baseQuery = keywords || 'professional';
      const locationQuery = location !== 'Angola' ? location : 'Angola';
      // Multiple queries separated by \n
      const queries = [
        `${baseQuery} ${locationQuery}`,
        `entrepreneur ${locationQuery}`,
      ];
      return {
        queries: queries.join('\n'),         // EXACTO: newline-separated
        site: 'linkedin.com/in',            // EXACTO: adiciona site: automaticamente
        maxPagesPerQuery: 3,                // ~30 resultados por query
        countryCode: 'us',                  // google.com
        forceExactMatch: false,
      };
    }

    default:
      return {};
  }
}

/**
 * Normaliza os resultados de cada actor para formato unificado
 * Cada actor retorna campos diferentes - mapeamos tudo para o mesmo schema
 */
function normalizeProfile(platform: string) {
  return (item: any) => {
    // Extrair username de varios formatos que cada actor retorna
    let username = item.username || item.handle || item.screenName || item.uniqueId ||
      item.title?.replace(/\s+/g, '_')?.toLowerCase() ||
      item.url?.split('/').filter(Boolean).pop() || '';
    if (username.startsWith('@')) username = username.substring(1);
    if (username.startsWith('http')) username = username.split('/').pop() || '';
    username = username.split('?')[0]; // remover query strings

    // Nome completo - cada actor usa campo diferente
    const fullName = item.fullName || item.displayName || item.title || item.name ||
      item.realName || item.authorName || item.text?.substring(0, 80) || '';

    // Seguidores - nomes diferentes por actor
    const followers = item.followers || item.followerCount || item.subscribersCount ||
      item.subscriberCount || item.fansCount || item.ideosCount || item.followersCount ||
      item.likesCount || 0;

    // Following
    const following = item.following || item.followingCount || item.friendsCount ||
      item.followeesCount || 0;

    // Posts/conteudo
    const postsCount = item.postsCount || item.posts || item.videosCount || item.videos ||
      item.pinsCount || item.mediaCount || item.itemCount || item.videoCount || 0;

    // Bio/descricao
    const bio = item.bio || item.biography || item.description || item.about ||
      item.text || item.headline || item.snippet || item.content || '';

    // URL do perfil
    let profileUrl = item.profileUrl || item.url || item.instagramUrl || item.linkedInUrl ||
      item.webUrl || item.website || item.profile || '';
    if (!profileUrl && username) {
      const urlMap: Record<string, string> = {
        instagram: `https://instagram.com/${username}`,
        tiktok: `https://tiktok.com/@${username}`,
        facebook: `https://facebook.com/${username}`,
        linkedin: `https://linkedin.com/in/${username}`,
      };
      profileUrl = urlMap[platform] || '';
    }

    // Avatar
    const avatarUrl = item.avatarUrl || item.profilePicUrl || item.imgUrl || item.avatar ||
      item.profilePicture || item.thumbnail || item.avatarMedium || '';

    // Localizacao
    const location = item.location || item.city || item.country || item.livesIn ||
      item.address || item.geoLocation || '';

    // Categoria
    const category = item.category || item.businessCategory || item.industry ||
      item.occupation || item.businessName || '';

    return {
      platform,
      username,
      fullName,
      followers,
      following,
      postsCount,
      isVerified: item.isVerified || item.verified || false,
      isBusiness: item.isBusiness || item.isProfessionalAccount || item.isCreator || false,
      bio,
      profileUrl,
      avatarUrl,
      location,
      category,
      externalId: item.id || item.uid || item.pk || item.uniqueId || '',
    };
  };
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
  if (/restaur|food|comida|gastron|churras|pizza|caf[eé]/.test(combined)) return 'Restauração';
  if (/tech|software|digital|programador|developer|startup|dev/.test(combined)) return 'Tecnologia';
  if (/fitness|gym|saúde|health|treino|academia|workout/.test(combined)) return 'Saúde/Fitness';
  if (/moda|fashion|style|beauty|beleza|makeup|cosmetic/.test(combined)) return 'Moda/Beleza';
  if (/marketing|agency|social media|branding|publicidade/.test(combined)) return 'Marketing';
  if (/music|musica|dj |kuduro|semba|kizomba|artista|cantor|rapper/.test(combined)) return 'Música';
  if (/fotograf|photo|video|film|producao|conteudo|content/.test(combined)) return 'Media';
  if (/imob|real estate|construc|casas|apartamento/.test(combined)) return 'Imobiliário';
  if (/barbear|hair|salao|unhas|estetic|spa/.test(combined)) return 'Beleza/Estética';
  if (/comerci|loja|vendas|store|shop/.test(combined)) return 'Comércio';
  return 'Outro';
}

function estimateMonthsActive(profile: any): number {
  if (profile.monthsActive) return profile.monthsActive;
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
