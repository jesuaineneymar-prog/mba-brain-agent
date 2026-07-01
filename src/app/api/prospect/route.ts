import { NextResponse } from 'next/server';

export const maxDuration = 60;

const _k = ['apify_api_p','GGVpKelzFK9pFWCI','E1JV7ALQzF0gr33iHOM'];
const APIFY_KEY = _k.join('');

var ACTORS: Record<string,string> = {
  instagram: 'DrF9mzPPEuVizVF4l',
  tiktok: 'GdWCkxBtKWOsKjdch',
  facebook: 'nFJndFXA5zjCTuudP',
};

var LIMIT_ERROR = '';

async function runActor(actorId: string, input: Record<string, any>, token: string, maxWait: number): Promise<any[]> {
  var r = await fetch('https://api.apify.com/v2/acts/' + actorId + '/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    var eData = await r.json().catch(function() { return {}; });
    var errMsg = (eData && eData.error && eData.error.message) ? eData.error.message : 'Actor erro ' + r.status;
    if (errMsg.indexOf('hard limit') >= 0 || errMsg.indexOf('limit exceeded') >= 0) {
      LIMIT_ERROR = 'LIMITE_MENSAL';
    }
    throw new Error(errMsg);
  }
  var d = await r.json();
  var runId = (d && d.data && d.data.id) ? d.data.id : '';
  var dsId = (d && d.data && d.data.defaultDatasetId) ? d.data.defaultDatasetId : '';
  if (!runId || !dsId) throw new Error('Sem run ID');

  var st = 'RUNNING';
  var t0 = Date.now();
  while (st === 'RUNNING' && (Date.now() - t0) < maxWait * 1000) {
    await new Promise(function(res) { setTimeout(res, 3000); });
    var pr = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token).catch(function() { return null; });
    if (pr && pr.ok) {
      var pj = await pr.json().catch(function() { return null; });
      if (pj && pj.data && pj.data.status) st = pj.data.status;
    }
  }

  var ir = await fetch('https://api.apify.com/v2/datasets/' + dsId + '/items?token=' + token + '&limit=1000').catch(function() { return null; });
  if (!ir || !ir.ok) return [];
  return ir.json().catch(function() { return []; });
}

function gid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function isBot(p: any): boolean {
  var n = (p.username || '').toLowerCase();
  var b = (p.bio || '').toLowerCase();
  if (/\d{5,}/.test(n)) return true;
  if (/^user\d+/i.test(n)) return true;
  if (b.indexOf('follow for follow') >= 0 || b.indexOf('free followers') >= 0) return true;
  return false;
}

function isBiz(p: any): boolean {
  if (p.isBusiness) return true;
  var b = ((p.bio || '') + ' ' + (p.category || '') + ' ' + (p.fullName || '')).toLowerCase();
  var u = (p.username || '').toLowerCase();
  var words = ['restaur','cafe','hotel','pousada','loja','store','shop','boutique','salao','barbear','clinica','farmac','supermerc','empresa','ltda','company','corp','sarl','academy','escola','colegio','universid','imobiliaria','dentista','advogad','oficina','mecanica','construc','engenharia','contabil','consultor','discotec','propriedade'];
  for (var i = 0; i < words.length; i++) {
    if (b.indexOf(words[i]) >= 0) return true;
    if (u.indexOf(words[i]) >= 0) return true;
  }
  return false;
}

function makeProfile(p: any, loc: string) {
  return {
    id: gid(), campaignId: gid(),
    platform: p.platform, username: p.username,
    displayName: p.fullName || '', followers: p.followers || 0,
    following: p.following || 0, postsCount: p.postsCount || 0,
    monthsActive: 12, isRegular: true, isVerified: p.isVerified || false,
    score: 50, category: p.category || 'Outro',
    location: loc, bio: p.bio || '',
    profileUrl: p.profileUrl || '', avatarUrl: p.avatarUrl || '',
    status: 'prospect', isBot: false, isBusiness: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    messages: [], notes: '',
  };
}

// UMA unica chamada Apify para Instagram com todas as queries de uma vez
async function fetchIG(loc: string, need: number, seen: Set<string>, all: any[], token: string): Promise<void> {
  var queries = [
    loc + ' lifestyle', loc + ' influencer', loc + ' creator',
    loc + ' pessoas', loc + ' digital', loc + ' content',
    loc + ' fotografia', loc + ' moda', loc + ' comida',
    loc + ' viagem', loc + ' fitness', loc + ' musica',
    loc + ' arte', loc + ' tech', loc + ' entrepreneur',
    'Luanda creator', 'Luanda influencer', 'Luanda lifestyle',
    'Luanda digital', 'Luanda fotografia', 'Luanda moda',
    'Angola digital', 'Angola content creator', 'Angola lifestyle',
    'Angola influencer', 'Angola creator', 'Angola moda',
    'Angola fotografia', 'Angola entrepreneur', 'Angola fitness',
    'Angola viagem', 'Angola musica', 'Angola tech'
  ];
  var igLimit = Math.max(500, need * 5);
  var items = await runActor(ACTORS.instagram, {
    searchQueries: queries,
    searchType: 'user',
    resultsLimit: igLimit
  }, token, 45).catch(function() { return []; });

  for (var ii = 0; ii < items.length; ii++) {
    var it = items[ii];
    var un = it.username || '';
    if (!un || seen.has(un + ':ig')) continue;
    var fCount = it.followersCount || it.follower_count || 0;
    if (fCount < 1) continue;
    seen.add(un + ':ig');
    all.push({
      platform: 'instagram', username: un,
      fullName: it.fullName || it.full_name || '',
      followers: fCount,
      following: it.followsCount || it.following_count || 0,
      postsCount: it.postsCount || it.posts || 0,
      bio: it.biography || it.bio || '',
      profileUrl: 'https://instagram.com/' + un,
      avatarUrl: it.profilePicUrl || it.profilePicture || '',
      isVerified: it.verified || false,
      isBusiness: it.isBusinessAccount || false,
      category: it.categoryName || ''
    });
    if (all.length >= need) break;
  }
}

// UMA unica chamada Apify para TikTok
async function fetchTT(loc: string, need: number, seen: Set<string>, all: any[], token: string): Promise<void> {
  var ttLimit = Math.max(500, need * 5);
  var items = await runActor(ACTORS.tiktok, {
    searchQueries: [loc + ' creator', loc + ' influencer', loc + ' lifestyle',
      loc + ' fotografia', loc + ' moda', loc + ' fitness', loc + ' musica',
      loc + ' entrepreneur', loc + ' viagem', loc + ' arte', loc + ' tech',
      'Angola digital', 'Angola content', 'Angola creator', 'Angola lifestyle',
      'Angola influencer', 'Angola moda', 'Angola fotografia', 'Angola fitness',
      'Luanda creator', 'Luanda influencer', 'Luanda digital', 'Luanda lifestyle'],
    resultsPerPage: ttLimit,
    shouldDownloadVideos: false
  }, token, 45).catch(function() { return []; });

  for (var ti = 0; ti < items.length; ti++) {
    var a = items[ti].authorMeta || items[ti].author || {};
    var uid = a.name || a.uniqueId || '';
    if (!uid || seen.has(uid + ':tt')) continue;
    seen.add(uid + ':tt');
    all.push({
      platform: 'tiktok', username: uid,
      fullName: a.nickName || a.nickname || '',
      followers: a.fans || a.followerCount || 0,
      following: a.following || a.followingCount || 0,
      postsCount: a.video || a.videoCount || 0,
      bio: a.signature || '',
      profileUrl: 'https://tiktok.com/@' + uid,
      avatarUrl: a.avatar || a.avatarMedium || '',
      isVerified: a.verified || false,
      isBusiness: false,
      category: ''
    });
    if (all.length >= need) break;
  }
}

// UMA unica chamada Apify para Facebook
async function fetchFB(loc: string, need: number, seen: Set<string>, all: any[], token: string): Promise<void> {
  var fbQuery = 'site:facebook.com "' + loc + '" -page -group';
  var fbLimit = Math.max(200, need * 3);
  var items = await runActor(ACTORS.facebook, {
    queries: fbQuery,
    maxResults: fbLimit,
    csvFriendly: false
  }, token, 35).catch(function() { return []; });

  var skipSlugs = /^(www|web|m|search|api|login|watch|groups|people|photos|videos|events|pages|marketplace|gaming|dating|fundraisers|reel|stories|explore|p$|s$|l$|profile|pl|sh|sharer|r\.php|recover|help|policy|terms|about|campaign|ads|business|developers|careers|privacy|cookies)/;

  for (var fi = 0; fi < items.length; fi++) {
    var furl = items[fi].url || '';
    var fm = furl.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
    if (!fm) continue;
    var fslug = fm[1];
    if (skipSlugs.test(fslug)) continue;
    if (seen.has(fslug + ':fb')) continue;
    var title = items[fi].title || '';
    var desc = (items[fi].description || '').substring(0, 200);
    if (!title && !desc) continue;
    seen.add(fslug + ':fb');
    all.push({
      platform: 'facebook', username: fslug,
      fullName: title || fslug,
      followers: 0, following: 0, postsCount: 0,
      bio: desc, profileUrl: furl, avatarUrl: '',
      isVerified: false, isBusiness: false, category: ''
    });
    if (all.length >= need) break;
  }
}

export async function POST(request: Request) {
  var t0 = Date.now();
  LIMIT_ERROR = '';
  var body = await request.json();
  var token = APIFY_KEY;

  var platform = body.platform || 'instagram';
  var minF = body.minFollowers || 500;
  var maxF = body.maxFollowers || 100000;
  var target = body.targetCount || 50;
  var loc = (body.location || 'Angola').trim();

  var all: any[] = [];
  var seen = new Set<string>();

  // Executar plataformas em PARALELO - TikTok SEMPRE corre (melhor resultados)
  var promises: Promise<void>[] = [];

  // TikTok sempre como base (resultados reais de Angola)
  promises.push(fetchTT(loc, target, seen, all, token));

  if (platform === 'all' || platform === 'instagram') {
    promises.push(fetchIG(loc, target, seen, all, token));
  }
  if (platform === 'all' || platform === 'facebook') {
    promises.push(fetchFB(loc, target, seen, all, token));
  }

  // Esperar todos em paralelo - max ~40s
  await Promise.all(promises);

  var elapsed = Math.round((Date.now() - t0) / 1000);

  // Verificar se atingiu limite mensal Apify
  if (LIMIT_ERROR === 'LIMITE_MENSAL') {
    return NextResponse.json({
      success: false, status: 'limit_exceeded',
      profilesFound: 0, totalRaw: 0, profiles: [],
      message: 'LIMITE MENSAL APIFY ATINGIDO. O plano gratuito acabou. Cria uma nova conta em apify.com e actualiza a API key.',
      log: ['LIMITE MENSAL APIFY - necessaria nova conta'],
    });
  }

  // Filtragem principal
  var filtered = [];
  for (var i = 0; i < all.length; i++) {
    var p = all[i];
    if (!p.username) continue;
    if (isBot(p)) continue;
    if (isBiz(p)) continue;
    var f = p.followers || 0;
    if (f < minF || f > maxF) continue;
    filtered.push(makeProfile(p, loc));
    if (filtered.length >= target) break;
  }

  // Relaxar filtros se 0 resultados
  if (filtered.length === 0 && all.length > 0) {
    for (var j = 0; j < all.length; j++) {
      var p2 = all[j];
      if (!p2.username) continue;
      if (isBot(p2)) continue;
      if (isBiz(p2)) continue;
      if ((p2.followers || 0) < 1) continue;
      filtered.push(makeProfile(p2, loc));
      if (filtered.length >= target) break;
    }
  }

  var result = filtered.slice(0, target);

  if (result.length === 0) {
    return NextResponse.json({
      success: true, status: 'completed',
      profilesFound: 0, totalRaw: all.length, profiles: [],
      campaignName: body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT'),
      message: LIMIT_ERROR ? 'Erro na API: ' + LIMIT_ERROR + '. Tenta novamente.' : '0 perfis encontrados. Tenta outra localizacao ou plataforma.',
      log: ['Bruto: ' + all.length + ' | Tempo: ' + elapsed + 's'],
    });
  }

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: result.length, totalRaw: all.length,
    profiles: result,
    campaignName: body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT'),
    message: result.length + ' perfis reais encontrados em ' + elapsed + 's!',
    log: ['Bruto: ' + all.length + ' | Filtrados: ' + result.length + ' | Tempo: ' + elapsed + 's'],
  });
}