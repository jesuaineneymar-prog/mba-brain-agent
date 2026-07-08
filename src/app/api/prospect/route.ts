import { NextResponse } from 'next/server';

export var maxDuration = 60;

var SCRAPINGANT_KEY = '897af2903f4848fba1f603a46273d842';
var SCRAPINGANT_BASE = 'https://api.scrapingant.com/v1/general';
var SERPER_KEY = process.env.SERPER_API_KEY || '';
var SERPER_BASE = 'https://google.serper.dev/search';

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
  var words = ['restauran','hotel','pousada','clinica','farmac','supermerc','imobiliaria','dentista','advogad','oficina mecanic','engenharia','contabil','logistica','transporte','telecomunica','seguranca privada','seguros','imobili','loja','shop','store','boutique','salao','barbeari','marketplace','ecommerce','e-commerce','negocio','negocios','empresa','ltda','lda','sarl'];
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
  var bad = ['p','explore','reel','reels','stories','direct','accounts','about','api','blog','help','press','developer','legal','privacy','terms','web','email','insta','instagram','graphql','www'];
  if (bad.indexOf(un.toLowerCase()) >= 0) return false;
  if (/^\d/.test(un)) return false;
  if (un.toLowerCase().indexOf('official') >= 0 && un.length < 8) return false;
  return true;
}
function isValidFB(name: string): boolean {
  if (!name || name.length < 3 || name.length > 60) return false;
  // URLs com path (posts, videos, etc) nao sao nomes de pagina
  if (name.indexOf('/') >= 0) return false;
  if (/^\d+$/.test(name)) return false;
  // Palavras reservadas do Facebook
  var bad = ['events','groups','watch','marketplace','reels','gaming','login','recover','help','pages','page','p','l','n','r','media','photo','photos','video','videos','post','posts','comment','plugins','dialog','sharer','ajax','m','mobile','www','apps','privacy','terms','careers','directory','people','places','games','business','story','public','profile.php','fundraiser','policies','campaign','landing','share','create','settings','edit','nfx','explore','oficial','official'];
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

/* ===== FETCH com multi-fallback ===== */
async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  // Metodo 1: ScrapingAnt proxy
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, timeoutMs);
    var fullUrl = SCRAPINGANT_BASE + '?url=' + encodeURIComponent(url) + '&x-api-key=' + SCRAPINGANT_KEY + '&browser=false';
    var res = await fetch(fullUrl, { signal: ctrl.signal });
    clearTimeout(tid);
    if (res.ok) { var data = await res.json(); if (data && data.content && data.content.length > 200) return data.content; }
  } catch(e) {}
  // Metodo 2: Direct fetch
  try {
    var ctrl2 = new AbortController();
    var tid2 = setTimeout(function() { ctrl2.abort(); }, Math.min(timeoutMs, 10000));
    var res2 = await fetch(url, { signal: ctrl2.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8' } });
    clearTimeout(tid2);
    if (res2.ok) { var text = await res2.text(); if (text && text.length > 200) return text; }
  } catch(e) {}
  return null;
}

/* ===== SERPER: Google Search API ===== */
async function serperSearch(query: string, num: number): Promise<string[]> {
  var urls: string[] = [];
  if (!SERPER_KEY) return urls;
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 8000);
    var res = await fetch(SERPER_BASE, {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: num, gl: 'ao', hl: 'pt' }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    if (!res.ok) return urls;
    var data = await res.json();
    var org = data.organic || [];
    for (var i = 0; i < org.length; i++) { if (org[i].link) urls.push(org[i].link); }
    // Tambem knowledge graph
    if (data.knowledgeGraph && data.knowledgeGraph.website) urls.push(data.knowledgeGraph.website);
  } catch(e) {}
  return urls;
}

/* ===== Extrair usernames de URLs ===== */
function extractUsernamesFromUrls(urls: string[], plat: string): string[] {
  var found: string[] = [];
  var re: RegExp;
  if (plat === 'instagram') re = /instagram\.com\/([a-zA-Z0-9_.]{3,30})(?:\/|$|[\s"'<>?])/;
  else if (plat === 'facebook') re = /facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})(?:\/|$|[\s"'<>?])/;
  else re = /tiktok\.com\/@([a-zA-Z0-9_.]{2,24})(?:\/|$|[\s"'<>?])/;
  var validFn = plat === 'instagram' ? isValidIG : plat === 'facebook' ? isValidFB : isValidTT;
  for (var i = 0; i < urls.length; i++) {
    var m = urls[i].match(re);
    if (m && validFn(m[1]) && found.indexOf(m[1]) < 0) found.push(m[1]);
  }
  return found;
}

/* ===== Extrair usernames de qualquer HTML ===== */
function extractUsernames(html: string, re: RegExp): string[] {
  var found: string[] = [];
  var m;
  var r = new RegExp(re.source, re.flags);
  while ((m = r.exec(html)) !== null) { if (found.indexOf(m[1]) < 0) found.push(m[1]); }
  var hrefRe = /href=["']([^"']+)["']/gi;
  var hm;
  while ((hm = hrefRe.exec(html)) !== null) {
    var href = hm[1];
    r.lastIndex = 0;
    while ((m = r.exec(href)) !== null) { if (found.indexOf(m[1]) < 0) found.push(m[1]); }
    try {
      var dh = decodeURIComponent(href);
      if (dh !== href) { r.lastIndex = 0; while ((m = r.exec(dh)) !== null) { if (found.indexOf(m[1]) < 0) found.push(m[1]); } }
    } catch(e) {}
  }
  return found;
}

/* ===== ENRICH FUNCTIONS ===== */
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
    var num = parseFloat(str.replace(/,/g, '')); if (isNaN(num)) return 0;
    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1000000);
    return Math.round(num);
  }
  var ogDescMatch = html.match(/property="og:description"\s+content="([^"]*)"/i);
  var descSource = ogDescMatch ? ogDescMatch[1] : '';
  if (!descSource) { var metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i); if (metaDesc) descSource = metaDesc[1]; }
  if (descSource) {
    var desc = decodeEntities(descSource);
    var fMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Followers/i); if (fMatch) followers = parseCount(fMatch[1], fMatch[2]);
    var pMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Posts/i); if (pMatch) posts = parseCount(pMatch[1], pMatch[2]);
    var fwMatch = desc.match(/([\d,.]+)\s*([KMB]?)\s*Following/i); if (fwMatch) following = parseCount(fwMatch[1], fwMatch[2]);
    var nameMatch = desc.match(/^([^,(·-]+)/);
    if (nameMatch) fullName = nameMatch[1].trim().replace(/\s*\d[\d,.]*\s*[KMB]?\s*Followers.*/i, '').trim();
  }
  var scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    var sc = scripts[i];
    if (sc.indexOf('"biography"') >= 0 && !bio) { var bm = sc.match(/"biography":"((?:[^"\\]|\\.)*)"/); if (bm) bio = bm[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"'); }
    if (sc.indexOf('"category_name"') >= 0 && !category) { var cm = sc.match(/"category_name":"([^"]+)"/); if (cm) category = cm[1]; }
    if (sc.indexOf('"profile_pic_url"') >= 0 && !avatar) { var am = sc.match(/"profile_pic_url(?:_hd)":"([^"]+)"/); if (am) avatar = am[1]; }
    if (sc.indexOf('"is_verified":true') >= 0) verified = true;
  }
  return { fullName, followers, following, posts, bio, avatar, verified, category };
}

async function enrichFBPage(name: string): Promise<any> {
  var html = await fetchHtml('https://www.facebook.com/' + encodeURIComponent(name) + '/', 8000);
  if (!html) return null;
  var fullName = '', followers = 0, bio = '', category = '', avatar = '', verified = false;
  var titleMatch = html.match(/<title>([^|<]+?)(?:\s*\|\s*Facebook)?<\/title>/i); if (titleMatch) fullName = titleMatch[1].trim();
  var ogDesc = html.match(/property="og:description"\s+content="([^"]*)"/i); if (ogDesc) bio = ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  var fMatch = html.match(/([\d,.]+)\s*([KMB]?)\s*(?:followers|likes|seguidores|curtidas)/i);
  if (fMatch) { var num = parseFloat(fMatch[1].replace(/,/g, '')); var mult = fMatch[2] === 'K' ? 1000 : fMatch[2] === 'M' ? 1000000 : 1; followers = Math.round(num * mult); }
  var catMatch = html.match(/"category":"([^"]+)"/) || html.match(/page_category["':]+\s*"?([^"',]+)/i); if (catMatch) category = catMatch[1].trim();
  var avMatch = html.match(/"profilepic(?:_full)?"\s*:\s*"(https?:\/\/[^"]+)"/i) || html.match(/property="og:image"\s+content="([^"]+)"/i); if (avMatch) avatar = avMatch[1];
  if (!fullName && followers === 0) return null;
  return { fullName, followers, bio, category, avatar, verified };
}

/* ===== QUERY GENERATORS ===== */
function shuffle(arr: string[]): string[] {
  var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a;
}
function getTTQueries(): string[] {
  return shuffle([
    'angola influencer tiktok', 'angolano creator tiktok',
    'luanda influencer tiktok', 'angola kizomba tiktok',
    'angola lifestyle tiktok', 'angola musica tiktok',
    'influenciador angolano tiktok', 'angola dance tiktok',
    'angola comedy tiktok', 'benguela angola tiktok',
    'angola moda tiktok', 'angola fitness tiktok',
    'angola vlog tiktok', 'angola food blogger tiktok',
    'angola photography tiktok'
  ]);
}
function getIGQueries(): string[] {
  return shuffle([
    'angola influencer instagram', 'angolano creator instagram',
    'luanda influencer instagram', 'angola kizomba instagram',
    'angola lifestyle instagram', 'angola musica instagram',
    'angola moda instagram', 'angola fitness instagram',
    'angola comedia instagram', 'benguela angola instagram',
    'angola dance instagram', 'cabinda angola instagram',
    'luanda moda instagram', 'angola entrepreneur instagram',
    'angola food instagram', 'angola digital creator instagram',
    'huambo angola instagram', 'angola photography instagram',
    'angola travel instagram', 'influenciador angolano instagram',
    'angola ig model instagram', 'angola artist instagram',
    'angola comedian instagram', 'angola fashion blogger instagram',
    'lobito angola instagram', 'angola podcaster instagram',
    'luanda photographer instagram', 'angola businessman instagram',
    'angola public figure instagram', 'angola media instagram'
  ]);
}
function getFBQueries(): string[] {
  return shuffle([
    'angola influencer facebook page', 'angola content creator facebook',
    'luanda influencer facebook', 'angola kizomba facebook',
    'angola moda facebook page', 'angola musica facebook',
    'luanda lifestyle facebook', 'angola fitness facebook',
    'benguela angola facebook', 'angola dance facebook',
    'angola comedia facebook', 'angola fashion facebook page',
    'angola entrepreneur facebook', 'luanda facebook page',
    'angola food facebook', 'cabinda angola facebook page',
    'angola photography facebook', 'huambo angola facebook',
    'angola entertainment facebook', 'angola business facebook page',
    'luanda model facebook', 'angola artist facebook',
    'angola influenciador facebook', 'angola creator digital facebook',
    'angola digital marketing facebook', 'angola vlog facebook',
    'angola podcast facebook', 'angola comedian facebook',
    'angola page creator facebook', 'angola public figure facebook',
    'angola blogger facebook', 'angola digital influencer facebook'
  ]);
}

function timeLeft(t0: number, limitMs: number): boolean { return Date.now() - t0 < limitMs; }

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

  var igUrlRe = /instagram\.com\/([a-zA-Z0-9_.]{3,30})(?:\/|$|[\s"'<>])/g;
  var fbUrlRe = /facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})(?:\/|$|[\s"'<>])/g;
  var ttUrlRe = /tiktok\.com\/@([a-zA-Z0-9_.]{2,24})(?:\/|$|[\s"'<>])/g;
  var igJsonRe = /"username":"([a-zA-Z0-9_.]{3,30})"/g;
  var ttJsonRe = /"uniqueId":"([a-zA-Z0-9_.]{2,24})"/g;

  function addUsers(users: string[], seen: Set<string>, raw: any[], plat: string, validator: Function, source: string) {
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (validator(u) && !seen.has(u.toLowerCase())) {
        seen.add(u.toLowerCase());
        raw.push({
          platform: plat, username: u, fullName: '',
          followers: 0, following: 0, postsCount: 0, bio: '',
          profileUrl: 'https://' + (plat === 'tiktok' ? 'tiktok.com/@' : plat + '.com/') + u,
          avatarUrl: '', isVerified: false, category: '', _angolaQuery: source === 'search'
        });
      }
    }
  }

  // =============================================
  // PHASE 1: DISCOVERY — Fontes multiplas em PARALELO
  // =============================================
  var allPromises: Promise<void>[] = [];

  var igQ = getIGQueries(), fbQ = getFBQueries(), ttQ = getTTQueries();

  // --- 1A: Google Serper API (mais fiavel) ---
  if (SERPER_KEY) {
    // IG: 8 queries via Serper
    for (var qi = 0; qi < Math.min(igQ.length, 8); qi++) {
      (function(query) {
        allPromises.push(
          serperSearch(query, 20).then(function(urls) {
            if (urls.length > 0) addUsers(extractUsernamesFromUrls(urls, 'instagram'), igSeen, igRaw, 'instagram', isValidIG, 'serper');
          }).catch(function() {})
        );
      })(igQ[qi]);
    }
    // FB: 8 queries via Serper
    for (var qi = 0; qi < Math.min(fbQ.length, 8); qi++) {
      (function(query) {
        allPromises.push(
          serperSearch(query, 20).then(function(urls) {
            if (urls.length > 0) addUsers(extractUsernamesFromUrls(urls, 'facebook'), fbSeen, fbRaw, 'facebook', isValidFB, 'serper');
          }).catch(function() {})
        );
      })(fbQ[qi]);
    }
    // TT: 6 queries via Serper
    for (var qi = 0; qi < Math.min(ttQ.length, 6); qi++) {
      (function(query) {
        allPromises.push(
          serperSearch(query, 20).then(function(urls) {
            if (urls.length > 0) addUsers(extractUsernamesFromUrls(urls, 'tiktok'), ttSeen, ttRaw, 'tiktok', isValidTT, 'serper');
          }).catch(function() {})
        );
      })(ttQ[qi]);
    }
  }

  // --- 1B: DuckDuckGo HTML (backup) ---
  function makeDDGUrl(query: string): string {
    return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  }

  // IG: 5 queries DDG
  for (var qi = 0; qi < Math.min(igQ.length, 5); qi++) {
    (function(query) {
      allPromises.push(
        fetchHtml(makeDDGUrl(query), 6000).then(function(html) {
          if (html) addUsers(extractUsernames(html, igUrlRe), igSeen, igRaw, 'instagram', isValidIG, 'ddg');
        }).catch(function() {})
      );
    })(igQ[qi + (SERPER_KEY ? 8 : 0)] || igQ[qi % igQ.length]);
  }
  // FB: 4 queries DDG
  for (var qi = 0; qi < Math.min(fbQ.length, 4); qi++) {
    (function(query) {
      allPromises.push(
        fetchHtml(makeDDGUrl(query), 6000).then(function(html) {
          if (html) addUsers(extractUsernames(html, fbUrlRe), fbSeen, fbRaw, 'facebook', isValidFB, 'ddg');
        }).catch(function() {})
      );
    })(fbQ[qi + (SERPER_KEY ? 8 : 0)] || fbQ[qi % fbQ.length]);
  }
  // TT: 3 queries DDG
  for (var qi = 0; qi < Math.min(ttQ.length, 3); qi++) {
    (function(query) {
      allPromises.push(
        fetchHtml(makeDDGUrl(query), 6000).then(function(html) {
          if (html) addUsers(extractUsernames(html, ttUrlRe), ttSeen, ttRaw, 'tiktok', isValidTT, 'ddg');
        }).catch(function() {})
      );
    })(ttQ[qi + (SERPER_KEY ? 6 : 0)] || ttQ[qi % ttQ.length]);
  }

  // --- 1C: Hashtag scraping directo (muito fiavel para usernames) ---
  var igHashtags = ['angola', 'luanda', 'kizomba', 'benguela', 'cabinda', 'huambo', 'angolano', 'lobito', 'luandaangola', 'angolainfluencer'];
  var ttHashtags = ['angola', 'luanda', 'kizomba', 'benguela', 'cabinda', 'huambo', 'foryou', 'angolafrica'];

  if (doIG) {
    for (var hi = 0; hi < igHashtags.length; hi++) {
      (function(tag) {
        allPromises.push(
          fetchHtml('https://www.instagram.com/explore/tags/' + tag + '/', 8000).then(function(html) {
            if (html) addUsers(extractUsernames(html, igJsonRe), igSeen, igRaw, 'instagram', isValidIG, 'hashtag');
          }).catch(function() {})
        );
      })(igHashtags[hi]);
    }
  }

  if (doTT) {
    for (var hi = 0; hi < ttHashtags.length; hi++) {
      (function(tag) {
        allPromises.push(
          fetchHtml('https://www.tiktok.com/tag/' + tag, 8000).then(function(html) {
            if (html) addUsers(extractUsernames(html, ttJsonRe), ttSeen, ttRaw, 'tiktok', isValidTT, 'hashtag');
          }).catch(function() {})
        );
      })(ttHashtags[hi]);
    }
  }

  // --- 1D: Buscar em paginas de hashtag/search do IG para mais usernames ---
  if (doIG) {
    var igSearchTerms = ['angola', 'luanda', 'angolano', 'benguela', 'kizomba angola'];
    for (var si = 0; si < igSearchTerms.length; si++) {
      (function(term) {
        allPromises.push(
          fetchHtml('https://www.instagram.com/web/search/topsearch/?context=blended&query=' + encodeURIComponent(term), 6000).then(function(html) {
            if (html) addUsers(extractUsernames(html, igJsonRe), igSeen, igRaw, 'instagram', isValidIG, 'igsearch');
          }).catch(function() {})
        );
      })(igSearchTerms[si]);
    }
  }

  await Promise.all(allPromises);
  logs.push('Discovery (' + Math.round(Date.now() - t0) + 'ms): TT=' + ttRaw.length + ' IG=' + igRaw.length + ' FB=' + fbRaw.length);

  // =============================================
  // PHASE 2: ENRICHMENT — batches paralelos de 6
  // =============================================
  var enrichQueue: { profile: any; type: string }[] = [];
  // Interleaved enrichment: IG > FB > TT
  var maxLen = Math.max(doIG ? igRaw.length : 0, doFB ? fbRaw.length : 0, doTT ? ttRaw.length : 0);
  for (var ri = 0; ri < maxLen; ri++) {
    if (doIG && ri < igRaw.length && igRaw[ri].followers === 0) enrichQueue.push({ profile: igRaw[ri], type: 'ig' });
    if (doFB && ri < fbRaw.length && fbRaw[ri].followers === 0) enrichQueue.push({ profile: fbRaw[ri], type: 'fb' });
    if (doTT && ri < ttRaw.length && ttRaw[ri].followers === 0) enrichQueue.push({ profile: ttRaw[ri], type: 'tt' });
  }

  var enriched = { ig: 0, fb: 0, tt: 0 };
  for (var bi = 0; bi < enrichQueue.length && timeLeft(t0, 56000); bi += 6) {
    var batch = enrichQueue.slice(bi, bi + 6);
    await Promise.all(batch.map(function(item) {
      return (async function() {
        var data;
        if (item.type === 'ig') data = await enrichIGProfile(item.profile.username);
        else if (item.type === 'fb') data = await enrichFBPage(item.profile.username);
        else data = await enrichTTProfile(item.profile.username);
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
    }));
  }
  logs.push('Enriched: TT=' + enriched.tt + '/' + ttRaw.length + ' IG=' + enriched.ig + '/' + igRaw.length + ' FB=' + enriched.fb + '/' + fbRaw.length);

  // =============================================
  // PHASE 3: Score + Filter
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
      if (f > 0 && f > maxF) continue;
      if (f > 0 && f < minF) continue;
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
  // PHASE 4: Interleave — IG > FB > TT, score priority
  // =============================================
  var buckets: any[][] = [[], [], []];
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
    buckets[b].sort(function(a: any, b2: any) { return (platOrder[a.platform] || 9) - (platOrder[b2.platform] || 9); });
    for (var bi = 0; bi < buckets[b].length && qualified.length < target; bi++) qualified.push(buckets[b][bi]);
  }

  // =============================================
  // PHASE 5: Backfill — nao enriquecidos tambem contam
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
  var message = finalProfiles.length === 0
    ? '0 perfis. Diminui o minimo de seguidores. ' + logs.join(' | ')
    : igQual.length + ' IG + ' + fbQual.length + ' FB + ' + ttQual.length + ' TT = ' + finalProfiles.length + ' perfis em ' + elapsed + 's';

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: finalProfiles.length, totalRaw: totalRawAll,
    profiles: finalProfiles, campaignName: campaignName,
    message: message, log: logs, cookiesExpired: false
  });
}