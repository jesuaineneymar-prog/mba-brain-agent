import { NextResponse } from 'next/server';

export var maxDuration = 60;

var SCRAPINGANT_KEY = '897af2903f4848fba1f603a46273d842';
var SCRAPINGANT_BASE = 'https://api.scrapingant.com/v1/general';

var ANGOLA_WORDS = [
  'angola', 'angolana', 'angolano', 'luanda', 'benguela',
  'huambo', 'lobito', 'cabinda', 'lubango', 'namibe',
  'malanje', 'sumbe', 'soyo', 'dundo', 'huila',
  'cuanza', 'zaire', 'cunene', 'moxico', 'lunda',
  'bie', '_ao', '_angola', '+244', 'angol',
  'luandense', 'benguelense', 'cabindense', 'huambiense',
  'loanda', 'angolan'
];

var LUSO_WORDS = [
  'portugal', 'portuguesa', 'portugues', 'lisboa', 'porto',
  'brasil', 'brasileira', 'brasileiro', 'sao paulo', 'brasilia',
  'mozambique', 'moçambicana', 'moçambicano', 'maputo',
  'caboverde', 'cabo verde', 'cabo-verdiano', 'praia',
  'guine-bissau', 'guine bissau', 'bissau',
  'sao tome', 'sao tome e principe', 'timor', 'timor-leste',
  'lusofono', 'lusofona', 'fala portugues', 'pt-br', 'pt_pt',
  'dili', 'beira', 'nampula', 'mozambican', 'cape verdean'
];

var BLOCK_WORDS = [
  'nigeria', 'nigerian', 'kenya', 'kenyan', 'ghana', 'ghanaian',
  'south africa', 'south_africa', 'johannesburg', 'lagos', 'nairobi',
  'accra', 'ethiopia', 'tanzania', 'uganda', 'cameroon', 'congo (drc)',
  'kinshasa', 'abidjan', 'dakar', 'casablanca', 'cairo', 'pretoria',
  'india', 'indian', 'pakistan', 'bangladesh', 'philippines', 'filipino',
  'mexico', 'mexican', 'colombia', 'colombian', 'argentina', 'argentine',
  'usa', 'american', 'united states', 'california', 'new york',
  'london', 'uk ', 'united kingdom', 'dubai', 'paris', 'berlin',
  'russia', 'russian', 'turkey', 'turkish', 'japan', 'japanese',
  'china', 'chinese', 'korea', 'korean', 'thailand', 'thai',
  'modeling agency', 'model agency', 'onlyfans', 'only fans',
  'promo ', 'promoter', 'crypto trader', 'forex trader',
  'giveaway', 'free money', 'earn money', 'click here'
];

function scoreProfile(p: any): number {
  var score = 0;
  var bio = (p.bio || '').toLowerCase();
  var name = (p.fullName || '').toLowerCase();
  var un = (p.username || '').toLowerCase();
  var cat = (p.category || '').toLowerCase();
  var all = bio + ' ' + name + ' ' + un + ' ' + cat;

  // Bloquear perfis de paises claramente nao lusofonos
  for (var bi = 0; bi < BLOCK_WORDS.length; bi++) {
    if (all.indexOf(BLOCK_WORDS[bi]) >= 0) return -1;
  }

  // Pontuacao Angola (prioridade maxima)
  for (var ai = 0; ai < ANGOLA_WORDS.length; ai++) {
    if (all.indexOf(ANGOLA_WORDS[ai]) >= 0) { score += 50; break; }
  }

  // Pontuacao outros lusofonos
  for (var li = 0; li < LUSO_WORDS.length; li++) {
    if (all.indexOf(LUSO_WORDS[li]) >= 0) { score += 30; break; }
  }

  return score;
}

function gid(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function isBot(p: any): boolean {
  var n = (p.username || '').toLowerCase();
  var b = (p.bio || '').toLowerCase();
  if (/\d{5,}/.test(n)) return true;
  if (/^user\d+/i.test(n)) return true;
  if (b.indexOf('follow for follow') >= 0) return true;
  if (b.indexOf('free followers') >= 0) return true;
  return false;
}

function isBiz(p: any): boolean {
  var b = ((p.bio || '') + ' ' + (p.category || '') + ' ' + (p.fullName || '')).toLowerCase();
  var u = (p.username || '').toLowerCase();
  var words = [
    'restauran', 'hotel', 'pousada', 'clinica', 'farmac', 'supermerc',
    'imobiliaria', 'dentista', 'advogad', 'oficina mecanic',
    'engenharia', 'contabil', 'logistica', 'transporte',
    'telecomunica', 'seguranca privada', 'seguros', 'imobili',
    'loja', 'shop', 'store', 'boutique', 'salao', 'barbeari',
    'marketplace', 'ecommerce', 'e-commerce', 'negocio', 'negocios',
    'empresa', 'ltda', 'lda', 'sarl'
  ];
  for (var i = 0; i < words.length; i++) { if (b.indexOf(words[i]) >= 0) return true; }
  if (/^(loja|shop|store|boutique|hotel|clinica)/i.test(u)) return true;
  if (/^(compra|venda|imoveis|aluguel)/i.test(u)) return true;
  return false;
}

function makeProfile(p: any, loc: string): any {
  return {
    id: gid(), campaignId: gid(), platform: p.platform,
    username: p.username, displayName: p.fullName || '',
    followers: p.followers || 0, following: p.following || 0,
    postsCount: p.postsCount || 0, monthsActive: 12, isRegular: true,
    isVerified: p.isVerified || false, score: 50,
    category: p.category || 'Outro', location: loc, bio: p.bio || '',
    profileUrl: p.profileUrl || '', avatarUrl: p.avatarUrl || '',
    status: 'prospect', isBot: false, isBusiness: false,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    messages: [], notes: ''
  };
}

function isValidIG(un: string): boolean {
  if (!un || un.length < 3 || un.length > 30) return false;
  var bad = ['p', 'explore', 'reel', 'reels', 'stories', 'direct',
    'accounts', 'about', 'api', 'blog', 'help', 'press',
    'developer', 'legal', 'privacy', 'terms', 'web', 'email',
    'insta', 'instagram', 'reel', 'graphql', 'www'];
  if (bad.indexOf(un.toLowerCase()) >= 0) return false;
  if (/^\d/.test(un)) return false;
  if (un.toLowerCase().indexOf('official') >= 0 && un.length < 8) return false;
  return true;
}

function isValidFB(name: string): boolean {
  if (!name || name.length < 3 || name.length > 60) return false;
  var bad = ['events', 'groups', 'watch', 'marketplace', 'reels',
    'gaming', 'login', 'recover', 'help', 'pages', 'p',
    'l', 'n', 'r', 'media', 'photo', 'photos', 'video',
    'videos', 'post', 'posts', 'comment', 'plugins',
    'dialog', 'sharer', 'ajax', 'm', 'mobile', 'www',
    'apps', 'privacy', 'terms', 'careers', 'directory',
    'people', 'places', 'games', 'business', 'story',
    'public', 'profile.php', 'watch', 'fundraiser',
    'plugins', 'policies', 'campaign', 'landing',
    'sharer', 'share', 'watch', 'login', 'recover',
    'policies', 'create', 'settings', 'edit', 'nfx',
    'stories', 'reel', 'explore', 'story'];
  if (bad.indexOf(name.toLowerCase()) >= 0) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

function isValidTT(un: string): boolean {
  if (!un || un.length < 2 || un.length > 24) return false;
  if (/^user\d+/i.test(un)) return false;
  if (/\d{5,}/.test(un)) return false;
  return true;
}

/* ===== SCRAPINGANT FETCH ===== */

async function saFetch(url: string, timeoutMs: number): Promise<{ content: string; status_code: number } | null> {
  var ctrl = new AbortController();
  var tid = setTimeout(function() { ctrl.abort(); }, timeoutMs);
  try {
    var fullUrl = SCRAPINGANT_BASE + '?url=' + encodeURIComponent(url) +
      '&x-api-key=' + SCRAPINGANT_KEY + '&browser=false';
    var res = await fetch(fullUrl, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    clearTimeout(tid);
    return null;
  }
}

/* ===== DuckDuckGo search ===== */

async function searchDDG(query: string, urlPattern: RegExp, timeoutMs: number): Promise<string[]> {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' +
    encodeURIComponent(query) + '&num=50';
  var result = await saFetch(ddgUrl, timeoutMs);
  if (!result || !result.content) return [];
  var found: string[] = [];
  var m;
  var re = new RegExp(urlPattern.source, urlPattern.flags);
  while ((m = re.exec(result.content)) !== null) {
    if (found.indexOf(m[1]) < 0) found.push(m[1]);
  }
  return found;
}

/* ===== ENRICH TT profile ===== */

async function enrichTTProfile(username: string): Promise<any> {
  var result = await saFetch('https://www.tiktok.com/@' + username, 8000);
  if (!result || !result.content) return null;
  var c = result.content;
  var nickname = (c.match(/"nickname":"([^"]*)"/) || [])[1] || '';
  var signature = (c.match(/"signature":"([^"]*)"/) || [])[1] || '';
  var followers = parseInt((c.match(/"followerCount":(\d+)/) || [])[1]) || 0;
  var following = parseInt((c.match(/"followingCount":(\d+)/) || [])[1]) || 0;
  var videoCount = parseInt((c.match(/"videoCount":(\d+)/) || [])[1]) || 0;
  var avatar = (c.match(/"avatarMedium":"([^"]*)"/) || [])[1] || '';
  var verified = c.indexOf('"verified":true') >= 0;
  if (!nickname && !signature && followers === 0) return null;
  return { nickname, signature, followers, following, videoCount, avatar, verified };
}

/* ===== ENRICH IG profile ===== */

async function enrichIGProfile(username: string): Promise<any> {
  var result = await saFetch('https://www.instagram.com/' + username + '/', 8000);
  if (!result || !result.content) return null;
  var c = result.content;
  var followers = 0, following = 0, posts = 0, bio = '', fullName = '', avatar = '', verified = false, category = '';

  function decodeEntities(t: string): string {
    return t.replace(/&#x([0-9A-Fa-f]+);/g, function(_a: any, hex: string) { return String.fromCharCode(parseInt(hex, 16)); })
            .replace(/&#(\d+);/g, function(_a: any, dec: string) { return String.fromCharCode(parseInt(dec, 10)); })
            .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  function parseCount(str: string, suffix: string): number {
    var num = parseFloat(str.replace(/,/g, ''));
    if (isNaN(num)) return 0;
    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1000000);
    if (suffix === 'B') return Math.round(num * 1000000000);
    return Math.round(num);
  }

  var ogDescMatch = c.match(/property="og:description"\s+content="([^"]*)"/i);
  var descSource = ogDescMatch ? ogDescMatch[1] : '';
  if (!descSource) {
    var metaDesc = c.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (metaDesc) descSource = metaDesc[1];
  }

  if (descSource) {
    var desc = decodeEntities(descSource);
    var fMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Followers/i);
    if (fMatch) followers = parseCount(fMatch[1], fMatch[2]);
    var pMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Posts/i);
    if (pMatch) posts = parseCount(pMatch[1], pMatch[2]);
    var fwMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Following/i);
    if (fwMatch) following = parseCount(fwMatch[1], fwMatch[2]);
    var nameMatch = desc.match(/^([^,(·-]+)/);
    if (nameMatch) fullName = nameMatch[1].trim().replace(/\s*\d[\d,.]*\s*[KMB]?\s*Followers.*/i, '').trim();
  }

  var scripts = c.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    var sc = scripts[i];
    if (sc.indexOf('"biography"') >= 0 && !bio) {
      var bm = sc.match(/"biography":"((?:[^"\\]|\\.)*)"/);
      if (bm) bio = bm[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    if (sc.indexOf('"category_name"') >= 0 && !category) {
      var cm = sc.match(/"category_name":"([^"]+)"/);
      if (cm) category = cm[1];
    }
    if (sc.indexOf('"profile_pic_url"') >= 0 && !avatar) {
      var am = sc.match(/"profile_pic_url(?:_hd)":"([^"]+)"/);
      if (am) avatar = am[1];
    }
    if (sc.indexOf('"is_verified":true') >= 0) verified = true;
  }

  return { fullName, followers, following, posts, bio, avatar, verified, category };
}

/* ===== ENRICH FB page ===== */

async function enrichFBPage(name: string): Promise<any> {
  var result = await saFetch('https://www.facebook.com/' + encodeURIComponent(name) + '/', 8000);
  if (!result || !result.content) return null;
  var c = result.content;
  var fullName = '', followers = 0, bio = '', category = '', avatar = '', verified = false;

  var titleMatch = c.match(/<title>([^|<]+?)(?:\s*\|\s*Facebook)?<\/title>/i);
  if (titleMatch) fullName = titleMatch[1].trim();

  var ogDesc = c.match(/property="og:description"\s+content="([^"]*)"/i);
  if (ogDesc) bio = ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  var fMatch = c.match(/([\d,.]+)\s*([KMB]?)\s*(?:followers|likes|seguidores|curtidas)/i);
  if (fMatch) {
    var num = parseFloat(fMatch[1].replace(/,/g, ''));
    var mult = fMatch[2] === 'K' ? 1000 : fMatch[2] === 'M' ? 1000000 : 1;
    followers = Math.round(num * mult);
  }

  var catMatch = c.match(/"category":"([^"]+)"/) || c.match(/page_category["':]+\s*"?([^"',]+)/i);
  if (catMatch) category = catMatch[1].trim();

  var avMatch = c.match(/"profilepic(?:_full)?"\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                 c.match(/property="og:image"\s+content="([^"]+)"/i);
  if (avMatch) avatar = avMatch[1];

  if (!fullName && followers === 0) return null;
  return { fullName, followers, bio, category, avatar, verified };
}

/* ===== QUERY GENERATORS ===== */

function getTTQueries(): string[] {
  var q = [
    'angola influencer tiktok site:tiktok.com',
    'angolano tiktok creator site:tiktok.com',
    'luanda tiktok influencer site:tiktok.com',
    'angola tiktok kizomba site:tiktok.com',
    'angola tiktok lifestyle site:tiktok.com',
    'angola tiktok musica site:tiktok.com',
    'angola tiktok moda site:tiktok.com',
    'angola tiktok fitness site:tiktok.com',
    'angola tiktok comedia site:tiktok.com',
    'benguela tiktok site:tiktok.com',
    'angola content creator tiktok site:tiktok.com',
    'angola tiktok dance site:tiktok.com',
    'cabinda tiktok site:tiktok.com',
    'angola tiktok comedian site:tiktok.com',
    'luanda tiktok moda site:tiktok.com',
    'angola tiktoker site:tiktok.com',
    'huambo tiktok site:tiktok.com',
    'lobito tiktok site:tiktok.com',
    'angola tiktok food site:tiktok.com',
    'angola tiktok vlog site:tiktok.com',
    'luanda tiktoker influencia site:tiktok.com',
    'angola tiktok entertainment site:tiktok.com',
    'namibe angola tiktok site:tiktok.com',
    'malanje tiktok site:tiktok.com'
  ];
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

function getIGQueries(): string[] {
  var q = [
    'angola influencer instagram site:instagram.com',
    'angolano instagram creator site:instagram.com',
    'luanda instagram influencer site:instagram.com',
    'angola instagram kizomba site:instagram.com',
    'angola instagram lifestyle site:instagram.com',
    'angola instagram musica site:instagram.com',
    'angola instagram moda site:instagram.com',
    'angola instagram fitness site:instagram.com',
    'angola instagram comedia site:instagram.com',
    'benguela instagram site:instagram.com',
    'angola instagram dance site:instagram.com',
    'cabinda instagram site:instagram.com',
    'luanda instagram moda site:instagram.com',
    'angola instagram entrepreneur site:instagram.com',
    'angola instagram food site:instagram.com',
    'angola instagrammer site:instagram.com',
    'huambo instagram site:instagram.com',
    'angola instagram photography site:instagram.com',
    'angola instagram travel site:instagram.com',
    'lobito instagram angola site:instagram.com',
    'angola ig influencer site:instagram.com',
    'luanda influenciador instagram site:instagram.com',
    'angola instagram vlog site:instagram.com',
    'angola instagram comedy site:instagram.com'
  ];
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

function getFBQueries(): string[] {
  var q = [
    'site:facebook.com "angola" influencer',
    'site:facebook.com "angola" "content creator"',
    'site:facebook.com "luanda" influencer',
    'site:facebook.com "angola" "kizomba"',
    'site:facebook.com "angola" "moda"',
    'site:facebook.com "angola" "musica"',
    'site:facebook.com "angola" page',
    'site:facebook.com "luanda" "lifestyle"',
    'site:facebook.com "angola" "fitness"',
    'site:facebook.com "benguela"',
    'site:facebook.com "angola" "dance"',
    'site:facebook.com "angola" "comedia"',
    'site:facebook.com "angola" "fashion"',
    'site:facebook.com "angola" "entrepreneur"',
    'site:facebook.com "luanda" page',
    'site:facebook.com "angola" "food"',
    'site:facebook.com "cabinda" page',
    'site:facebook.com "angola" "photography"',
    'site:facebook.com "huambo" angola',
    'site:facebook.com "angola" "entertainment"'
  ];
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

/* ===== TIME CHECK ===== */

function timeLeft(t0: number, limitMs: number): boolean {
  return Date.now() - t0 < limitMs;
}

/* ===== MAIN HANDLER ===== */

export async function POST(request: any) {
  var t0 = Date.now();
  var body = await request.json();
  var platform = body.platform || 'all';
  var minF = body.minFollowers || 500;
  var maxF = body.maxFollowers || 100000;
  var target = body.targetCount || 50;
  var loc = (body.location || 'Angola').trim();
  var logs: string[] = [];

  var doTT = platform === 'all' || platform === 'tiktok';
  var doIG = platform === 'all' || platform === 'instagram';
  var doFB = platform === 'all' || platform === 'facebook';

  logs.push('Platform:' + platform + ' TT:' + doTT + ' IG:' + doIG + ' FB:' + doFB + ' target:' + target + ' minF:' + minF);

  var ttRaw: any[] = [], ttSeen = new Set<string>();
  var igRaw: any[] = [], igSeen = new Set<string>();
  var fbRaw: any[] = [], fbSeen = new Set<string>();

  // =============================================
  // PHASE 1: DISCOVERY — DDG para TODAS as plataformas
  // TT: 0-10s, IG: 10-20s, FB: 20-28s
  // =============================================

  if (doTT) {
    var ttQ = getTTQueries();
    var ttUrlRe = /tiktok\.com\/@([a-zA-Z0-9_.]+)/g;
    for (var qi = 0; qi < ttQ.length && timeLeft(t0, 10000); qi++) {
      var ttUsers = await searchDDG(ttQ[qi], ttUrlRe, 9000);
      for (var ti = 0; ti < ttUsers.length; ti++) {
        var un = ttUsers[ti];
        if (isValidTT(un) && !ttSeen.has(un.toLowerCase())) {
          ttSeen.add(un.toLowerCase());
          ttRaw.push({
            platform: 'tiktok', username: un, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://tiktok.com/@' + un, avatarUrl: '',
            isVerified: false, category: '', _angolaQuery: true
          });
        }
      }
    }
    logs.push('TT DDG: ' + ttRaw.length + ' users');
  }

  if (doIG) {
    var igQ = getIGQueries();
    var igUrlRe = /instagram\.com\/([a-zA-Z0-9_.]{3,30})(?:\/|$|[\s"'])/g;
    for (var iqi = 0; iqi < igQ.length && timeLeft(t0, 20000); iqi++) {
      var igUsers = await searchDDG(igQ[iqi], igUrlRe, 9000);
      for (var ii = 0; ii < igUsers.length; ii++) {
        var igUn = igUsers[ii];
        if (isValidIG(igUn) && !igSeen.has(igUn.toLowerCase())) {
          igSeen.add(igUn.toLowerCase());
          igRaw.push({
            platform: 'instagram', username: igUn, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://instagram.com/' + igUn, avatarUrl: '',
            isVerified: false, category: '', _angolaQuery: true
          });
        }
      }
    }
    logs.push('IG DDG: ' + igRaw.length + ' users');
  }

  if (doFB) {
    var fbQ = getFBQueries();
    var fbUrlRe = /facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})/g;
    for (var fqi = 0; fqi < fbQ.length && timeLeft(t0, 28000); fqi++) {
      var fbPages = await searchDDG(fbQ[fqi], fbUrlRe, 9000);
      for (var fpi = 0; fpi < fbPages.length; fpi++) {
        var fp = fbPages[fpi];
        if (isValidFB(fp) && !fbSeen.has(fp.toLowerCase())) {
          fbSeen.add(fp.toLowerCase());
          fbRaw.push({
            platform: 'facebook', username: fp, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://facebook.com/' + fp, avatarUrl: '',
            isVerified: false, category: '', _angolaQuery: true
          });
        }
      }
    }
    logs.push('FB DDG: ' + fbRaw.length + ' pages');
  }

  logs.push('After discovery: TT=' + ttRaw.length + ' IG=' + igRaw.length + ' FB=' + fbRaw.length);

  // =============================================
  // PHASE 2: Enrichment (28-57s) — ~29s para enriquecer
  // =============================================
  var ttEnriched = 0, igEnriched = 0, fbEnriched = 0;
  var ttIdx = 0, igIdx = 0, fbIdx = 0;

  while (timeLeft(t0, 57000)) {
    var didEnrich = false;

    if (doTT && ttIdx < ttRaw.length && ttRaw[ttIdx].followers === 0) {
      var en = await enrichTTProfile(ttRaw[ttIdx].username);
      if (en) {
        ttEnriched++;
        ttRaw[ttIdx].fullName = en.nickname || ttRaw[ttIdx].fullName;
        ttRaw[ttIdx].followers = en.followers || 0;
        ttRaw[ttIdx].following = en.following || 0;
        ttRaw[ttIdx].postsCount = en.videoCount || 0;
        ttRaw[ttIdx].bio = en.signature || '';
        ttRaw[ttIdx].avatarUrl = en.avatar || '';
        ttRaw[ttIdx].isVerified = en.verified || false;
      }
      ttIdx++;
      didEnrich = true;
    }

    if (!timeLeft(t0, 57000)) break;

    if (doIG && igIdx < igRaw.length && igRaw[igIdx].followers === 0) {
      var igData = await enrichIGProfile(igRaw[igIdx].username);
      if (igData) {
        igEnriched++;
        igRaw[igIdx].fullName = igData.fullName || igRaw[igIdx].fullName;
        igRaw[igIdx].followers = igData.followers || 0;
        igRaw[igIdx].following = igData.following || 0;
        igRaw[igIdx].postsCount = igData.posts || 0;
        igRaw[igIdx].bio = igData.bio || '';
        igRaw[igIdx].avatarUrl = igData.avatar || '';
        igRaw[igIdx].isVerified = igData.verified || false;
        igRaw[igIdx].category = igData.category || '';
      }
      igIdx++;
      didEnrich = true;
    }

    if (!timeLeft(t0, 57000)) break;

    if (doFB && fbIdx < fbRaw.length && fbRaw[fbIdx].followers === 0) {
      var fbData = await enrichFBPage(fbRaw[fbIdx].username);
      if (fbData) {
        fbEnriched++;
        fbRaw[fbIdx].fullName = fbData.fullName || fbRaw[fbIdx].fullName;
        fbRaw[fbIdx].followers = fbData.followers || 0;
        fbRaw[fbIdx].bio = fbData.bio || '';
        fbRaw[fbIdx].category = fbData.category || '';
        fbRaw[fbIdx].avatarUrl = fbData.avatar || '';
        fbRaw[fbIdx].isVerified = fbData.verified || false;
      }
      fbIdx++;
      didEnrich = true;
    }

    if (!didEnrich) break;
  }

  logs.push('Enriched TT:' + ttEnriched + '/' + ttRaw.length + ' IG:' + igEnriched + '/' + igRaw.length + ' FB:' + fbEnriched + '/' + fbRaw.length);

  // =============================================
  // PHASE 3: Score + Filter
  // Scoring: -1 = bloqueado, 0 = sem info, 30 = lusofono, 50 = angola, 80 = angola confirmado
  // Perfis de queries angolanas com score 0 recebem +10 (provavel angolano)
  // =============================================
  function scoreAndFilter(rawList: any[]): any[] {
    var result: any[] = [];
    for (var i = 0; i < rawList.length; i++) {
      var p = rawList[i];
      if (!p.username || isBot(p) || isBiz(p)) continue;
      var s = scoreProfile(p);
      if (s < 0) continue; // bloqueado

      // Perfis encontrados via query angolana: bonus de confianca
      if (p._angolaQuery && s === 0) s = 10; // provavel angolano (encontrado via search angola)

      var f = p.followers || 0;
      if (f > maxF) continue;
      if (f < minF) continue;

      var profile = makeProfile(p, loc);
      profile._lusoScore = s;
      result.push(profile);
    }
    return result;
  }

  var ttQual = doTT ? scoreAndFilter(ttRaw) : [];
  var igQual = doIG ? scoreAndFilter(igRaw) : [];
  var fbQual = doFB ? scoreAndFilter(fbRaw) : [];
  logs.push('Filtered TT:' + ttQual.length + ' IG:' + igQual.length + ' FB:' + fbQual.length);

  // =============================================
  // PHASE 4: Sort — Angola primeiro, depois lusofonos, depois provaveis, por seguidores
  // =============================================
  function sortByScore(a: any, b: any) {
    // Angola confirmado (50+) primeiro, depois outros lusofonos (30+), depois provaveis (10)
    if (b._lusoScore !== a._lusoScore) return (b._lusoScore || 0) - (a._lusoScore || 0);
    // Dentro do mesmo nivel, mais seguidores primeiro
    return (b.followers || 0) - (a.followers || 0);
  }
  ttQual.sort(sortByScore);
  igQual.sort(sortByScore);
  fbQual.sort(sortByScore);

  // =============================================
  // PHASE 5: Interleave — priorizar Angola em cada grupo de 3
  // =============================================
  var qualified: any[] = [];

  // Primeiro: adicionar todos os perfis com score >= 50 (Angola confirmado) intercalados
  // Depois: os com score >= 30 (outros lusofonos)
  // Por fim: os com score >= 10 (provaveis angolanos)
  var buckets: any[][] = [[], [], []];
  for (var qi = 0; qi < ttQual.length; qi++) {
    var s = ttQual[qi]._lusoScore || 0;
    if (s >= 50) buckets[0].push(ttQual[qi]);
    else if (s >= 30) buckets[1].push(ttQual[qi]);
    else buckets[2].push(ttQual[qi]);
  }
  for (var qi = 0; qi < igQual.length; qi++) {
    var s2 = igQual[qi]._lusoScore || 0;
    if (s2 >= 50) buckets[0].push(igQual[qi]);
    else if (s2 >= 30) buckets[1].push(igQual[qi]);
    else buckets[2].push(igQual[qi]);
  }
  for (var qi = 0; qi < fbQual.length; qi++) {
    var s3 = fbQual[qi]._lusoScore || 0;
    if (s3 >= 50) buckets[0].push(fbQual[qi]);
    else if (s3 >= 30) buckets[1].push(fbQual[qi]);
    else buckets[2].push(fbQual[qi]);
  }
  logs.push('Buckets - Angola:' + buckets[0].length + ' Lusofono:' + buckets[1].length + ' Provavel:' + buckets[2].length);

  // Preencher do bucket 0 (Angola), depois 1 (Lusofono), depois 2 (Provavel)
  for (var b = 0; b < 3; b++) {
    if (qualified.length >= target) break;
    for (var bi = 0; bi < buckets[b].length && qualified.length < target; bi++) {
      qualified.push(buckets[b][bi]);
    }
  }

  // Se ainda nao chega ao target, aceitar perfis nao enriquecidos (0 seguidores = "—")
  // Mas perfis enriquecidos com < minF continuam bloqueados
  if (qualified.length < target) {
    var allRaw = (doTT ? ttRaw : []).concat(doIG ? igRaw : []).concat(doFB ? fbRaw : []);
    var seenIds = new Set(qualified.map(function(p) { return p.username; }));
    for (var ri = 0; ri < allRaw.length && qualified.length < target; ri++) {
      var rp = allRaw[ri];
      if (seenIds.has(rp.username)) continue;
      if (!rp.username || isBot(rp) || isBiz(rp)) continue;
      if (scoreProfile(rp) < 0) continue;
      // Bloquear enriquecidos com poucos seguidores, aceitar nao enriquecidos (0 = "—")
      var rf = rp.followers || 0;
      if (rf > 0 && rf < minF) continue;
      if (rf > maxF) continue;
      seenIds.add(rp.username);
      var ep = makeProfile(rp, loc);
      ep._lusoScore = 0;
      qualified.push(ep);
    }
    logs.push('Backfill to ' + qualified.length);
  }

  var elapsed = Math.round((Date.now() - t0) / 1000);
  var finalProfiles = qualified.slice(0, target);
  var totalRaw = ttRaw.length + igRaw.length + fbRaw.length;
  var campaignName = body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT');

  var message = '';
  if (finalProfiles.length === 0) {
    message = '0 perfis encontrados. Tenta diminuir o minimo de seguidores. ' + logs.join(' | ');
  } else {
    message = ttQual.length + ' TT + ' + igQual.length + ' IG + ' + fbQual.length + ' = ' + finalProfiles.length + ' perfis em ' + elapsed + 's';
  }

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: finalProfiles.length, totalRaw: totalRaw,
    profiles: finalProfiles, campaignName: campaignName,
    message: message, log: logs, cookiesExpired: false
  });
}
