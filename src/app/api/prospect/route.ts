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
  'vietnam', 'vietnamese', 'indonesia', 'indonesian',
  'italy', 'italian', 'spain', 'spanish', 'france', 'french',
  'germany', 'german', 'canada', 'canadian', 'australia', 'australian'
];

function gid() { return Math.random().toString(36).substring(2, 10) + Date.now().toString(36); }

function scoreProfile(p: any): number {
  var bio = ((p.bio || '') + ' ' + (p.category || '') + ' ' + (p.fullName || '')).toLowerCase();
  var loc = (p.location || '').toLowerCase();
  var text = bio + ' ' + loc;
  for (var i = 0; i < BLOCK_WORDS.length; i++) { if (text.indexOf(BLOCK_WORDS[i]) >= 0) return -1; }
  var score = 0;
  for (var i = 0; i < ANGOLA_WORDS.length; i++) { if (text.indexOf(ANGOLA_WORDS[i]) >= 0) { score += 50; break; } }
  if (score === 0) { for (var i = 0; i < LUSO_WORDS.length; i++) { if (text.indexOf(LUSO_WORDS[i]) >= 0) { score += 30; break; } } }
  if (p._angolaQuery && score === 0) score += 10;
  return score;
}

function isBot(p: any): boolean {
  var b = ((p.bio || '') + ' ' + (p.fullName || '')).toLowerCase();
  var u = (p.username || '').toLowerCase();
  if (/bot$|_bot|botahead|auto|script|fake/i.test(u)) return true;
  if (b.indexOf('bot') >= 0 && b.indexOf('robot') >= 0) return true;
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

/* ===== FETCH HTML com fallback duplo ===== */

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  // Metodo 1: ScrapingAnt (proxy, sem JS)
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, timeoutMs);
    var fullUrl = SCRAPINGANT_BASE + '?url=' + encodeURIComponent(url) +
      '&x-api-key=' + SCRAPINGANT_KEY + '&browser=false';
    var res = await fetch(fullUrl, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) {
      var data = await res.json();
      if (data && data.content && data.content.length > 200) return data.content;
    }
  } catch(e) { /* ScrapingAnt falhou, tentar directo */ }

  // Metodo 2: Fetch directo (sem proxy)
  try {
    var ctrl2 = new AbortController();
    var tid2 = setTimeout(function() { ctrl2.abort(); }, Math.min(timeoutMs, 10000));
    var res2 = await fetch(url, {
      signal: ctrl2.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8'
      }
    });
    clearTimeout(tid2);
    if (res2.ok) {
      var text = await res2.text();
      if (text && text.length > 200) return text;
    }
  } catch(e) { /* Fetch directo falhou */ }

  return null;
}

/* ===== DuckDuckGo search ===== */

async function searchDDG(query: string, urlPattern: RegExp, timeoutMs: number): Promise<string[]> {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  var html = await fetchHtml(ddgUrl, timeoutMs);
  if (!html) return [];
  var found: string[] = [];
  var re = new RegExp(urlPattern.source, urlPattern.flags);
  var m;

  // Busca 1: regex directo no HTML
  while ((m = re.exec(html)) !== null) {
    if (found.indexOf(m[1]) < 0) found.push(m[1]);
  }

  // Busca 2: extrair todos os href= do HTML e procurar neles (inclui URLs encoded em redirects DDG)
  var hrefRe = /href=["']([^"']+)["']/gi;
  var hm;
  while ((hm = hrefRe.exec(html)) !== null) {
    var href = hm[1];
    re.lastIndex = 0;
    while ((m = re.exec(href)) !== null) {
      if (found.indexOf(m[1]) < 0) found.push(m[1]);
    }
    // Tentar decodificar o href (para redirect URLs tipo uddg=...)
    try {
      var dh = decodeURIComponent(href);
      if (dh !== href) {
        re.lastIndex = 0;
        while ((m = re.exec(dh)) !== null) {
          if (found.indexOf(m[1]) < 0) found.push(m[1]);
        }
      }
    } catch(e) { /* ignore decode errors */ }
  }

  return found;
}

/* ===== ENRICH TT profile ===== */

async function enrichTTProfile(username: string): Promise<any> {
  var html = await fetchHtml('https://www.tiktok.com/@' + username, 8000);
  if (!html) return null;
  var nickname = (html.match(/"nickname":"([^"]*)"/) || [])[1] || '';
  var signature = (html.match(/"signature":"([^"]*)"/) || [])[1] || '';
  var followers = parseInt((html.match(/"followerCount":(\d+)/) || [])[1]) || 0;
  var following = parseInt((html.match(/"followingCount":(\d+)/) || [])[1]) || 0;
  var videoCount = parseInt((html.match(/"videoCount":(\d+)/) || [])[1]) || 0;
  var avatar = (html.match(/"avatarMedium":"([^"]*)"/) || [])[1] || '';
  var verified = html.indexOf('"verified":true') >= 0;
  if (!nickname && !signature && followers === 0) return null;
  return { nickname, signature, followers, following, videoCount, avatar, verified };
}

/* ===== ENRICH IG profile ===== */

async function enrichIGProfile(username: string): Promise<any> {
  var html = await fetchHtml('https://www.instagram.com/' + username + '/', 8000);
  if (!html) return null;
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

  var ogDescMatch = html.match(/property="og:description"\s+content="([^"]*)"/i);
  var descSource = ogDescMatch ? ogDescMatch[1] : '';
  if (!descSource) {
    var metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
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

  var scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
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
  var html = await fetchHtml('https://www.facebook.com/' + encodeURIComponent(name) + '/', 8000);
  if (!html) return null;
  var fullName = '', followers = 0, bio = '', category = '', avatar = '', verified = false;

  var titleMatch = html.match(/<title>([^|<]+?)(?:\s*\|\s*Facebook)?<\/title>/i);
  if (titleMatch) fullName = titleMatch[1].trim();

  var ogDesc = html.match(/property="og:description"\s+content="([^"]*)"/i);
  if (ogDesc) bio = ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  var fMatch = html.match(/([\d,.]+)\s*([KMB]?)\s*(?:followers|likes|seguidores|curtidas)/i);
  if (fMatch) {
    var num = parseFloat(fMatch[1].replace(/,/g, ''));
    var mult = fMatch[2] === 'K' ? 1000 : fMatch[2] === 'M' ? 1000000 : 1;
    followers = Math.round(num * mult);
  }

  var catMatch = html.match(/"category":"([^"]+)"/) || html.match(/page_category["':]+\s*"?([^"',]+)/i);
  if (catMatch) category = catMatch[1].trim();

  var avMatch = html.match(/"profilepic(?:_full)?"\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                 html.match(/property="og:image"\s+content="([^"]+)"/i);
  if (avMatch) avatar = avMatch[1];

  if (!fullName && followers === 0) return null;
  return { fullName, followers, bio, category, avatar, verified };
}

/* ===== QUERY GENERATORS ===== */

function shuffle(arr: string[]): string[] {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function getTTQueries(): string[] {
  return shuffle([
    'angola influencer tiktok site:tiktok.com',
    'angolano tiktok creator site:tiktok.com',
    'luanda tiktok influencer site:tiktok.com',
    'angola tiktok kizomba site:tiktok.com',
    'angola tiktok lifestyle site:tiktok.com',
    'angola tiktok musica site:tiktok.com',
    'angola tiktok moda site:tiktok.com',
    'angola tiktok fitness site:tiktok.com',
    'influenciador angolano tiktok site:tiktok.com',
    'angola tiktok dance site:tiktok.com',
    'angola tiktok comedy site:tiktok.com',
    'angola tiktok food blogger site:tiktok.com',
    'benguela tiktok angola site:tiktok.com',
    'angola tiktok vlog site:tiktok.com',
    'angola tiktok photographer site:tiktok.com'
  ]);
}

function getIGQueries(): string[] {
  return shuffle([
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
    'angola instagram comedy site:instagram.com',
    'angola instagram business site:instagram.com',
    'angola instagram digital creator site:instagram.com',
    'luanda instagram photographer site:instagram.com',
    'angola instagram model site:instagram.com',
    'angola instagram artist site:instagram.com'
  ]);
}

function getFBQueries(): string[] {
  return shuffle([
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
    'site:facebook.com "angola" "entertainment"',
    'site:facebook.com "angola" "business"',
    'site:facebook.com "luanda" "model"',
    'site:facebook.com "angola" "artist"',
    'site:facebook.com "angola" "digital marketing"',
    'site:facebook.com "angola" "influenciador"',
    'site:facebook.com "angola" "creator digital"',
    'site:facebook.com "luanda" "influencer"',
    'site:facebook.com "angola" "vlog"',
    'site:facebook.com "angola" "podcast"'
  ]);
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
  var target = Math.max(body.targetCount || 50, 50);
  var loc = (body.location || 'Angola').trim();
  var logs: string[] = [];

  var doTT = platform === 'all' || platform === 'tiktok';
  var doIG = platform === 'all' || platform === 'instagram';
  var doFB = platform === 'all' || platform === 'facebook';

  logs.push('Platform:' + platform + ' TT:' + doTT + ' IG:' + doIG + ' FB:' + doFB + ' target:' + target + ' minF:' + minF);

  var ttRaw: any[] = [], ttSeen = new Set<string>();
  var igRaw: any[] = [], igSeen = new Set<string>();
  var fbRaw: any[] = [], fbSeen = new Set<string>();

  // Regex patterns
  var igUrlRe = /instagram\.com\/([a-zA-Z0-9_.]{3,30})(?:\/|$|[\s"'<>])/g;
  var fbUrlRe = /facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})(?:\/|$|[\s"'<>])/g;
  var ttUrlRe = /tiktok\.com\/@([a-zA-Z0-9_.]{2,24})(?:\/|$|[\s"'<>])/g;

  // =============================================
  // PHASE 1: DISCOVERY — queries massivas em PARALELO
  // Wave 1: 10 IG + 8 FB + 6 TT = 24 queries (8-10s em paralelo)
  // Wave 2: se necessario, mais queries (10-15s)
  // =============================================

  var igQ = getIGQueries();
  var fbQ = getFBQueries();
  var ttQ = getTTQueries();

  // --- WAVE 1: primeira leva de queries ---
  var wave1Promises: Promise<void>[] = [];

  function addDiscoveryPromise(query: string, urlRe: RegExp, seen: Set<string>, raw: any[], plat: string, validator: Function) {
    wave1Promises.push(
      searchDDG(query, urlRe, 8000).then(function(users) {
        for (var i = 0; i < users.length; i++) {
          var u = users[i];
          if (validator(u) && !seen.has(u.toLowerCase())) {
            seen.add(u.toLowerCase());
            raw.push({
              platform: plat, username: u, fullName: '',
              followers: 0, following: 0, postsCount: 0, bio: '',
              profileUrl: 'https://' + (plat === 'tiktok' ? 'tiktok.com/@' : plat + '.com/') + u,
              avatarUrl: '', isVerified: false, category: '', _angolaQuery: true
            });
          }
        }
      }).catch(function() { /* query falhou, ignorar */ })
    );
  }

  // IG: 10 queries
  for (var qi = 0; qi < Math.min(igQ.length, 10); qi++) {
    addDiscoveryPromise(igQ[qi], igUrlRe, igSeen, igRaw, 'instagram', isValidIG);
  }
  // FB: 8 queries
  for (var qi = 0; qi < Math.min(fbQ.length, 8); qi++) {
    addDiscoveryPromise(fbQ[qi], fbUrlRe, fbSeen, fbRaw, 'facebook', isValidFB);
  }
  // TT: 6 queries
  for (var qi = 0; qi < Math.min(ttQ.length, 6); qi++) {
    addDiscoveryPromise(ttQ[qi], ttUrlRe, ttSeen, ttRaw, 'tiktok', isValidTT);
  }

  await Promise.all(wave1Promises);
  var afterWave1 = Date.now();
  logs.push('Wave1 (' + Math.round(afterWave1 - t0) + 'ms): TT=' + ttRaw.length + ' IG=' + igRaw.length + ' FB=' + fbRaw.length);

  // --- WAVE 2: mais queries se precisamos de mais perfis ---
  var totalRaw = igRaw.length + fbRaw.length + ttRaw.length;
  if (totalRaw < 80 && timeLeft(t0, 30000)) {
    var wave2Promises: Promise<void>[] = [];
    // Mais IG queries (10-19)
    for (var qi = 10; qi < Math.min(igQ.length, 20); qi++) {
      addDiscoveryPromise(igQ[qi], igUrlRe, igSeen, igRaw, 'instagram', isValidIG);
    }
    // Mais FB queries (8-16)
    for (var qi = 8; qi < Math.min(fbQ.length, 17); qi++) {
      addDiscoveryPromise(fbQ[qi], fbUrlRe, fbSeen, fbRaw, 'facebook', isValidFB);
    }
    // Mais TT queries (6-10)
    for (var qi = 6; qi < Math.min(ttQ.length, 11); qi++) {
      addDiscoveryPromise(ttQ[qi], ttUrlRe, ttSeen, ttRaw, 'tiktok', isValidTT);
    }
    await Promise.all(wave2Promises);
    logs.push('Wave2: TT=' + ttRaw.length + ' IG=' + igRaw.length + ' FB=' + fbRaw.length);
  }

  logs.push('Discovery total: TT=' + ttRaw.length + ' IG=' + igRaw.length + ' FB=' + fbRaw.length + ' (' + Math.round(Date.now() - t0) + 'ms)');

  // =============================================
  // PHASE 2: ENRICHMENT — batches paralelos de 6
  // Ordem de prioridade: IG > FB > TT (round-robin)
  // =============================================

  // Construir fila de enriquecimento intercalada: IG, FB, TT, IG, FB, TT, ...
  var enrichQueue: { profile: any; type: string }[] = [];
  var maxLen = Math.max(doIG ? igRaw.length : 0, doFB ? fbRaw.length : 0, doTT ? ttRaw.length : 0);
  for (var ri = 0; ri < maxLen; ri++) {
    if (doIG && ri < igRaw.length && igRaw[ri].followers === 0) {
      enrichQueue.push({ profile: igRaw[ri], type: 'ig' });
    }
    if (doFB && ri < fbRaw.length && fbRaw[ri].followers === 0) {
      enrichQueue.push({ profile: fbRaw[ri], type: 'fb' });
    }
    if (doTT && ri < ttRaw.length && ttRaw[ri].followers === 0) {
      enrichQueue.push({ profile: ttRaw[ri], type: 'tt' });
    }
  }

  var enriched = { ig: 0, fb: 0, tt: 0 };

  for (var bi = 0; bi < enrichQueue.length && timeLeft(t0, 56000); bi += 6) {
    var batch = enrichQueue.slice(bi, bi + 6);
    var batchPromises = batch.map(function(item) {
      return (async function() {
        var data;
        if (item.type === 'ig') {
          data = await enrichIGProfile(item.profile.username);
        } else if (item.type === 'fb') {
          data = await enrichFBPage(item.profile.username);
        } else {
          data = await enrichTTProfile(item.profile.username);
        }
        if (data) {
          item.profile.fullName = data.fullName || data.nickname || item.profile.fullName;
          item.profile.followers = data.followers || 0;
          item.profile.following = data.following || 0;
          item.profile.postsCount = data.posts || data.videoCount || 0;
          item.profile.bio = data.bio || data.signature || '';
          item.profile.avatarUrl = data.avatar || '';
          item.profile.isVerified = data.verified || false;
          if (data.category) item.profile.category = data.category;
          enriched[item.type]++;
        }
      })();
    });
    await Promise.all(batchPromises);
  }

  logs.push('Enriched: TT=' + enriched.tt + '/' + ttRaw.length + ' IG=' + enriched.ig + '/' + igRaw.length + ' FB=' + enriched.fb + '/' + fbRaw.length);

  // =============================================
  // PHASE 3: Score + Filter
  // Apenas filtra seguidores se temos dados (f > 0).
  // Perfis nao enriquecidos (f=0) NAO sao filtrados por minF.
  // =============================================

  function scoreAndFilter(rawList: any[]): any[] {
    var result: any[] = [];
    for (var i = 0; i < rawList.length; i++) {
      var p = rawList[i];
      if (!p.username || isBot(p) || isBiz(p)) continue;
      var s = scoreProfile(p);
      if (s < 0) continue;
      if (p._angolaQuery && s === 0) s = 10;
      var f = p.followers || 0;
      // So filtra por seguidores se temos dados reais (enriquecidos)
      if (f > 0) {
        if (f > maxF) continue;
        if (f < minF) continue;
      }
      var profile = makeProfile(p, loc);
      profile._lusoScore = s;
      result.push(profile);
    }
    return result;
  }

  var ttQual = doTT ? scoreAndFilter(ttRaw) : [];
  var igQual = doIG ? scoreAndFilter(igRaw) : [];
  var fbQual = doFB ? scoreAndFilter(fbRaw) : [];
  logs.push('Qualified: TT=' + ttQual.length + ' IG=' + igQual.length + ' FB=' + fbQual.length);

  // =============================================
  // PHASE 4: Interleave — IG > FB > TT priority
  // =============================================

  var buckets: any[][] = [[], [], []]; // 0: Angola 50+, 1: Luso 30+, 2: Provavel 10+
  [igQual, fbQual, ttQual].forEach(function(qual) {
    for (var i = 0; i < qual.length; i++) {
      var s = qual[i]._lusoScore || 0;
      if (s >= 50) buckets[0].push(qual[i]);
      else if (s >= 30) buckets[1].push(qual[i]);
      else buckets[2].push(qual[i]);
    }
  });

  var platOrder: Record<string, number> = { instagram: 0, facebook: 1, tiktok: 2 };
  var qualified: any[] = [];
  for (var b = 0; b < 3; b++) {
    if (qualified.length >= target) break;
    buckets[b].sort(function(a: any, b2: any) {
      return (platOrder[a.platform] || 9) - (platOrder[b2.platform] || 9);
    });
    for (var bi = 0; bi < buckets[b].length && qualified.length < target; bi++) {
      qualified.push(buckets[b][bi]);
    }
  }

  // =============================================
  // PHASE 5: Backfill — incluir nao enriquecidos se necessario
  // Perfis com f=0 (nao enriquecidos) sao incluidos.
  // Perfis com f>0 mas f<minF continuam bloqueados.
  // =============================================

  if (qualified.length < target) {
    var allRaw = (doIG ? igRaw : []).concat(doFB ? fbRaw : []).concat(doTT ? ttRaw : []);
    var seenIds = new Set(qualified.map(function(p: any) { return (p.platform + ':' + p.username).toLowerCase(); }));
    for (var ri = 0; ri < allRaw.length && qualified.length < target; ri++) {
      var rp = allRaw[ri];
      var key = (rp.platform + ':' + rp.username).toLowerCase();
      if (seenIds.has(key)) continue;
      if (!rp.username || isBot(rp) || isBiz(rp)) continue;
      if (scoreProfile(rp) < 0) continue;
      var rf = rp.followers || 0;
      if (rf > 0 && rf > maxF) continue;
      if (rf > 0 && rf < minF) continue;
      seenIds.add(key);
      var ep = makeProfile(rp, loc);
      ep._lusoScore = rp._angolaQuery ? 10 : 0;
      qualified.push(ep);
    }
    logs.push('Backfill: ' + qualified.length + ' total');
  }

  var elapsed = Math.round((Date.now() - t0) / 1000);
  var finalProfiles = qualified.slice(0, target);
  var totalRawAll = ttRaw.length + igRaw.length + fbRaw.length;
  var campaignName = body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT');

  var message = '';
  if (finalProfiles.length === 0) {
    message = '0 perfis encontrados. Tenta diminuir o minimo de seguidores. ' + logs.join(' | ');
  } else {
    message = igQual.length + ' IG + ' + fbQual.length + ' FB + ' + ttQual.length + ' TT = ' + finalProfiles.length + ' perfis em ' + elapsed + 's';
  }

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: finalProfiles.length, totalRaw: totalRawAll,
    profiles: finalProfiles, campaignName: campaignName,
    message: message, log: logs, cookiesExpired: false
  });
}