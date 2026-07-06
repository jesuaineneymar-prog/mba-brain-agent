import { NextResponse } from 'next/server';

export var maxDuration = 60;

var SCRAPINGANT_KEY = '897af2903f4848fba1f603a46273d842';
var SCRAPINGANT_BASE = 'https://api.scrapingant.com/v1/general';

var AO_WORDS = [
  'angola', 'angolana', 'angolano', 'luanda', 'benguela',
  'huambo', 'lobito', 'cabinda', 'lubango', 'namibe',
  'malanje', 'sumbe', 'soyo', 'dundo', 'huila',
  'cuanza', 'zaire', 'cunene', 'moxico', 'lunda',
  'bie', '_ao', '_angola', '+244', 'angol',
  'luandense', 'benguelense', 'cabindense', 'huambiense'
];

function isAngola(text: string): boolean {
  if (!text) return false;
  var lower = text.toLowerCase();
  for (var i = 0; i < AO_WORDS.length; i++) {
    if (lower.indexOf(AO_WORDS[i]) >= 0) return true;
  }
  return false;
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
    'embai', 'governo', 'minist', 'polici', 'petroleos',
    'loja ', ' loja', 'store ', ' shop ', 'shop\n', ' boutique'
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
    'insta', 'instagram'];
  if (bad.indexOf(un.toLowerCase()) >= 0) return false;
  if (/^\d/.test(un)) return false;
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
    'plugins', 'policies', 'campaign', 'landing'];
  if (bad.indexOf(name.toLowerCase()) >= 0) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

function isValidTT(un: string): boolean {
  if (!un || un.length < 2 || un.length > 24) return false;
  if (/^user\d+/i.test(un)) return true; return true;
  if (/\d{5,}/.test(un)) return false;
  return true;
}

function extractIGFromBio(bio: string): string {
  if (!bio) return '';
  var m1 = bio.match(/instagram\.com\/([a-zA-Z0-9_.]{3,30})/i);
  if (m1 && isValidIG(m1[1])) return m1[1];
  var m2 = bio.match(/ig[\s:]+@?([a-zA-Z0-9_.]{3,30})\b/i);
  if (m2 && isValidIG(m2[1])) return m2[1];
  return '';
}

function extractFBFromBio(bio: string): string {
  if (!bio) return '';
  var m1 = bio.match(/facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})/i);
  if (m1 && isValidFB(m1[1])) return m1[1];
  var m2 = bio.match(/fb\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})/i);
  if (m2 && isValidFB(m2[1])) return m2[1];
  return '';
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

/* ===== TIKTOK: DuckDuckGo search ===== */

async function searchTTViaDDG(query: string): Promise<string[]> {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' +
    encodeURIComponent(query) + '&num=30';
  var result = await saFetch(ddgUrl, 12000);
  if (!result || !result.content) return [];
  var usernames: string[] = [];
  var re1 = /tiktok\.com\/@([a-zA-Z0-9_.]+)/g;
  var m;
  while ((m = re1.exec(result.content)) !== null) {
    if (isValidTT(m[1]) && usernames.indexOf(m[1]) < 0) usernames.push(m[1]);
  }
  return usernames;
}

/* ===== INSTAGRAM: Hashtag pages ===== */

async function searchIGViaHashtag(tag: string): Promise<string[]> {
  var result = await saFetch('https://www.instagram.com/explore/tags/' + encodeURIComponent(tag) + '/', 18000);
  if (!result || !result.content) return [];
  var usernames: string[] = [];
  var scripts = result.content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].indexOf('"username"') < 0) continue;
    var re = /"username":"([^"]+)"/g;
    var m;
    while ((m = re.exec(scripts[i])) !== null) {
      if (isValidIG(m[1]) && usernames.indexOf(m[1]) < 0) usernames.push(m[1]);
    }
    if (usernames.length >= 60) break;
  }
  return usernames;
}

/* ===== FACEBOOK: DuckDuckGo search for FB pages ===== */

async function searchFBViaDDG(query: string): Promise<string[]> {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' +
    encodeURIComponent(query) + '&num=30';
  var result = await saFetch(ddgUrl, 12000);
  if (!result || !result.content) return [];
  var pages: string[] = [];
  var re1 = /facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,59})/g;
  var m;
  while ((m = re1.exec(result.content)) !== null) {
    if (isValidFB(m[1]) && pages.indexOf(m[1]) < 0) pages.push(m[1]);
  }
  return pages;
}

/* ===== ENRICH TT profile ===== */

async function enrichTTProfile(username: string): Promise<any> {
  var result = await saFetch('https://www.tiktok.com/@' + username, 12000);
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

/* ===== ENRICH IG profile via og:description ===== */

async function enrichIGProfile(username: string): Promise<any> {
  var result = await saFetch('https://www.instagram.com/' + username + '/', 12000);
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

  // Extract bio and avatar from scripts
  var scripts = c.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.indexOf('"biography"') >= 0 && !bio) {
      var bm = s.match(/"biography":"((?:[^"\\]|\\.)*)"/);
      if (bm) bio = bm[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    if (s.indexOf('"category_name"') >= 0 && !category) {
      var cm = s.match(/"category_name":"([^"]+)"/);
      if (cm) category = cm[1];
    }
    if (s.indexOf('"profile_pic_url"') >= 0 && !avatar) {
      var am = s.match(/"profile_pic_url(?:_hd)":"([^"]+)"/);
      if (am) avatar = am[1];
    }
    if (s.indexOf('"is_verified":true') >= 0) verified = true;
  }

  return { fullName, followers, following, posts, bio, avatar, verified, category };
}

/* ===== ENRICH FB page ===== */

async function enrichFBPage(name: string): Promise<any> {
  var result = await saFetch('https://www.facebook.com/' + encodeURIComponent(name) + '/', 12000);
  if (!result || !result.content) return null;
  var c = result.content;

  var fullName = '', followers = 0, bio = '', category = '', avatar = '', verified = false;

  // From title: "PageName | Facebook"
  var titleMatch = c.match(/<title>([^|<]+?)(?:\s*\|\s*Facebook)?<\/title>/i);
  if (titleMatch) fullName = titleMatch[1].trim();

  // From og:description
  var ogDesc = c.match(/property="og:description"\s+content="([^"]*)"/i);
  if (ogDesc) bio = ogDesc[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  // Followers from page content
  var fMatch = c.match(/([\d,.]+)\s*([KMB]?)\s*(?:followers|likes|seguidores|curtidas)/i);
  if (fMatch) {
    var num = parseFloat(fMatch[1].replace(/,/g, ''));
    var mult = fMatch[2] === 'K' ? 1000 : fMatch[2] === 'M' ? 1000000 : 1;
    followers = Math.round(num * mult);
  }

  // Category
  var catMatch = c.match(/"category":"([^"]+)"/) || c.match(/page_category["':]+\s*"?([^"',]+)/i);
  if (catMatch) category = catMatch[1].trim();

  // Avatar
  var avMatch = c.match(/"profilepic(?:_full)?"\s*:\s*"(https?:\/\/[^"]+)"/i) ||
                 c.match(/property="og:image"\s+content="([^"]+)"/i);
  if (avMatch) avatar = avMatch[1];

  if (!fullName && followers === 0) return null;
  return { fullName, followers, bio, category, avatar, verified };
}

/* ===== QUERY GENERATORS ===== */

function getTTQueries(): string[] {
  var q = [
    'angola influencer tiktok', 'angolano tiktok creator', 'luanda tiktok influencer',
    'angola tiktok kizomba', 'angola tiktok lifestyle', 'angola tiktok musica',
    'angola tiktok moda', 'angola tiktok fitness', 'angola tiktok comedia',
    'angola digital tiktok', 'benguela tiktok', 'angola content creator tiktok',
    'angola tiktok dance', 'angola tiktok entrepreneur', 'cabinda tiktok',
    'angola tiktok comedian', 'luanda tiktok moda'
  ];
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

function getIGHashtags(): string[] {
  var tags = [
    'angola', 'angolainfluencer', 'luanda', 'angolamoda',
    'angolafitness', 'kizombaangola', 'angolacreator',
    'luandainfluencer', 'angoladance', 'benguela'
  ];
  for (var i = tags.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = tags[i]; tags[i] = tags[j]; tags[j] = t;
  }
  return tags;
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
    'site:facebook.com "angola" "comedia"'
  ];
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

/* ===== TIME CHECK HELPER ===== */

function timeLeft(t0: number, limit: number): boolean {
  return Date.now() - t0 < limit;
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

  logs.push('Platform:' + platform + ' TT:' + doTT + ' IG:' + doIG + ' FB:' + doFB);

  var ttRaw: any[] = [], ttSeen = new Set<string>();
  var igRaw: any[] = [], igSeen = new Set<string>();
  var fbRaw: any[] = [], fbSeen = new Set<string>();

  // =============================================
  // PHASE 1: TikTok via DuckDuckGo (up to 40s)
  // =============================================
  if (doTT) {
    var ttQ = getTTQueries();
    for (var qi = 0; qi < ttQ.length && timeLeft(t0, 40000); qi++) {
      var ttUsers = await searchTTViaDDG(ttQ[qi]);
      for (var ti = 0; ti < ttUsers.length; ti++) {
        var un = ttUsers[ti];
        if (!ttSeen.has(un.toLowerCase())) {
          ttSeen.add(un.toLowerCase());
          ttRaw.push({
            platform: 'tiktok', username: un, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://tiktok.com/@' + un, avatarUrl: '',
            isVerified: false, category: '', _isAngola: isAngola(ttQ[qi])
          });
        }
      }
    }
    logs.push('TT DDG: ' + ttRaw.length + ' users');

    // Enrich TT profiles (fast, ~4s each)
    var ttEnriched = 0;
    for (var ei = 0; ei < ttRaw.length && timeLeft(t0, 52000); ei++) {
      if (ttRaw[ei].followers > 0) continue; // already enriched
      var en = await enrichTTProfile(ttRaw[ei].username);
      if (en) {
        ttEnriched++;
        ttRaw[ei].fullName = en.nickname || ttRaw[ei].fullName;
        ttRaw[ei].followers = en.followers || 0;
        ttRaw[ei].following = en.following || 0;
        ttRaw[ei].postsCount = en.videoCount || 0;
        ttRaw[ei].bio = en.signature || '';
        ttRaw[ei].avatarUrl = en.avatar || '';
        ttRaw[ei].isVerified = en.verified || false;
        if (isAngola(en.signature || '')) ttRaw[ei]._isAngola = true;
        if (isAngola(en.nickname || '')) ttRaw[ei]._isAngola = true;
      }
    }
    logs.push('TT enriched: ' + ttEnriched);
  }

  // =============================================
  // PHASE 2: Instagram via hashtag pages (up to 42s)
  // =============================================
  if (doIG) {
    var igTags = getIGHashtags();
    for (var hi = 0; hi < igTags.length && timeLeft(t0, 42000); hi++) {
      var igUsers = await searchIGViaHashtag(igTags[hi]);
      for (var ii = 0; ii < igUsers.length; ii++) {
        var igUn = igUsers[ii];
        if (!igSeen.has(igUn.toLowerCase())) {
          igSeen.add(igUn.toLowerCase());
          igRaw.push({
            platform: 'instagram', username: igUn, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://instagram.com/' + igUn, avatarUrl: '',
            isVerified: false, category: '', _isAngola: isAngola(igTags[hi])
          });
        }
      }
    }
    logs.push('IG hashtags: ' + igRaw.length + ' users');

    // Enrich IG profiles (fast, ~4s each)
    var igEnriched = 0;
    for (var iei = 0; iei < igRaw.length && timeLeft(t0, 54000); iei++) {
      if (igRaw[iei].followers > 0) continue;
      var igData = await enrichIGProfile(igRaw[iei].username);
      if (igData) {
        igEnriched++;
        igRaw[iei].fullName = igData.fullName || igRaw[iei].fullName;
        igRaw[iei].followers = igData.followers || 0;
        igRaw[iei].following = igData.following || 0;
        igRaw[iei].postsCount = igData.posts || 0;
        igRaw[iei].bio = igData.bio || '';
        igRaw[iei].avatarUrl = igData.avatar || '';
        igRaw[iei].isVerified = igData.verified || false;
        igRaw[iei].category = igData.category || '';
        if (isAngola(igData.bio || '')) igRaw[iei]._isAngola = true;
        if (isAngola(igData.fullName || '')) igRaw[iei]._isAngola = true;
      }
    }
    logs.push('IG enriched: ' + igEnriched);
  }

  // =============================================
  // PHASE 3: Facebook via DuckDuckGo (up to 44s)
  // =============================================
  if (doFB) {
    var fbQ = getFBQueries();
    for (var fqi = 0; fqi < fbQ.length && timeLeft(t0, 44000); fqi++) {
      var fbPages = await searchFBViaDDG(fbQ[fqi]);
      for (var fpi = 0; fpi < fbPages.length; fpi++) {
        var fp = fbPages[fpi];
        if (!fbSeen.has(fp.toLowerCase())) {
          fbSeen.add(fp.toLowerCase());
          fbRaw.push({
            platform: 'facebook', username: fp, fullName: '',
            followers: 0, following: 0, postsCount: 0, bio: '',
            profileUrl: 'https://facebook.com/' + fp, avatarUrl: '',
            isVerified: false, category: '', _isAngola: isAngola(fbQ[fqi]),
            _source: 'ddg'
          });
        }
      }
    }
    logs.push('FB DDG: ' + fbRaw.length + ' pages');

    // Enrich FB pages (fast, ~4s each)
    var fbEnriched = 0;
    for (var fei = 0; fei < fbRaw.length && timeLeft(t0, 55000); fei++) {
      if (fbRaw[fei].followers > 0) continue;
      var fbData = await enrichFBPage(fbRaw[fei].username);
      if (fbData) {
        fbEnriched++;
        fbRaw[fei].fullName = fbData.fullName || fbRaw[fei].fullName;
        fbRaw[fei].followers = fbData.followers || 0;
        fbRaw[fei].bio = fbData.bio || '';
        fbRaw[fei].category = fbData.category || '';
        fbRaw[fei].avatarUrl = fbData.avatar || '';
        fbRaw[fei].isVerified = fbData.verified || false;
        if (isAngola(fbData.fullName || '')) fbRaw[fei]._isAngola = true;
        if (isAngola(fbData.bio || '')) fbRaw[fei]._isAngola = true;
      }
    }
    logs.push('FB enriched: ' + fbEnriched);
  }

  // =============================================
  // PHASE 4: Cross-extract from bios
  // =============================================
  // IG from TT bios
  for (var cei = 0; cei < ttRaw.length; cei++) {
    var igFromTT = extractIGFromBio(ttRaw[cei].bio || '');
    if (igFromTT && !igSeen.has(igFromTT.toLowerCase()) && doIG) {
      igSeen.add(igFromTT.toLowerCase());
      igRaw.push({
        platform: 'instagram', username: igFromTT, fullName: ttRaw[cei].fullName || '',
        followers: ttRaw[cei].followers || 0, following: 0, postsCount: 0,
        bio: ttRaw[cei].bio || '', profileUrl: 'https://instagram.com/' + igFromTT,
        avatarUrl: ttRaw[cei].avatarUrl || '', isVerified: ttRaw[cei].isVerified,
        category: '', _isAngola: ttRaw[cei]._isAngola, _source: 'tt_bio'
      });
    }
    // FB from TT bios
    if (doFB) {
      var fbFromTT = extractFBFromBio(ttRaw[cei].bio || '');
      if (fbFromTT && !fbSeen.has(fbFromTT.toLowerCase())) {
        fbSeen.add(fbFromTT.toLowerCase());
        fbRaw.push({
          platform: 'facebook', username: fbFromTT, fullName: ttRaw[cei].fullName || '',
          followers: ttRaw[cei].followers || 0, following: 0, postsCount: 0,
          bio: ttRaw[cei].bio || '', profileUrl: 'https://facebook.com/' + fbFromTT,
          avatarUrl: ttRaw[cei].avatarUrl || '', isVerified: ttRaw[cei].isVerified,
          category: '', _isAngola: ttRaw[cei]._isAngola, _source: 'tt_bio'
        });
      }
    }
  }
  // FB from IG bios
  for (var ibi = 0; ibi < igRaw.length && doFB; ibi++) {
    var fbFromIG = extractFBFromBio(igRaw[ibi].bio || '');
    if (fbFromIG && !fbSeen.has(fbFromIG.toLowerCase())) {
      fbSeen.add(fbFromIG.toLowerCase());
      fbRaw.push({
        platform: 'facebook', username: fbFromIG, fullName: igRaw[ibi].fullName || '',
        followers: igRaw[ibi].followers || 0, following: 0, postsCount: 0,
        bio: igRaw[ibi].bio || '', profileUrl: 'https://facebook.com/' + fbFromIG,
        avatarUrl: igRaw[ibi].avatarUrl || '', isVerified: igRaw[ibi].isVerified,
        category: '', _isAngola: igRaw[ibi]._isAngola, _source: 'ig_bio'
      });
    }
  }
  logs.push('Cross: IG=' + igRaw.length + ' FB=' + fbRaw.length);

  // =============================================
  // PHASE 5: Filter
  // =============================================
  var ttQual: any[] = [], igQual: any[] = [], fbQual: any[] = [];

  if (doTT) {
    for (var tqi = 0; tqi < ttRaw.length; tqi++) {
      var tp = ttRaw[tqi];
      if (!tp.username || isBot(tp) || isBiz(tp)) continue;
      if (!tp._isAngola && !isAngola(tp.username) && !isAngola(tp.fullName)) continue;
      var tf = tp.followers || 0;
      if (tf > maxF) continue;
      if (tf > 0 && tf < minF) continue;
      ttQual.push(makeProfile(tp, loc));
    }
  }
  if (doIG) {
    for (var igfi = 0; igfi < igRaw.length; igfi++) {
      var ip = igRaw[igfi];
      if (!ip.username || isBot(ip) || isBiz(ip)) continue;
      var igF = ip.followers || 0;
      if (igF > maxF) continue;
      if (igF > 0 && igF < minF) continue;
      if (!ip._isAngola && !isAngola(ip.bio) && !isAngola(ip.fullName) && !isAngola(ip.username)) continue;
      igQual.push(makeProfile(ip, loc));
    }
  }
  if (doFB) {
    for (var ffi = 0; ffi < fbRaw.length; ffi++) {
      var ffp = fbRaw[ffi];
      if (!ffp.username || isBot(ffp) || isBiz(ffp)) continue;
      var fff = ffp.followers || 0;
      if (fff > maxF) continue;
      if (fff > 0 && fff < minF) continue;
      if (!ffp._isAngola && !isAngola(ffp.bio) && !isAngola(ffp.fullName)) continue;
      fbQual.push(makeProfile(ffp, loc));
    }
  }
  logs.push('Filtered TT:' + ttQual.length + ' IG:' + igQual.length + ' FB:' + fbQual.length);

  // =============================================
  // PHASE 6: Sort & Interleave
  // =============================================
  ttQual.sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });
  igQual.sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });
  fbQual.sort(function(a, b) { return (b.followers || 0) - (a.followers || 0); });

  var qualified: any[] = [];
  var maxLen = Math.max(ttQual.length, igQual.length, fbQual.length);
  for (var sli = 0; sli < maxLen && qualified.length < target; sli++) {
    if (doTT && sli < ttQual.length) qualified.push(ttQual[sli]);
    if (doIG && sli < igQual.length) qualified.push(igQual[sli]);
    if (doFB && sli < fbQual.length) qualified.push(fbQual[sli]);
  }

  var elapsed = Math.round((Date.now() - t0) / 1000);
  var finalProfiles = qualified.slice(0, target);
  var totalRaw = ttRaw.length + igRaw.length + fbRaw.length;
  var campaignName = body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT');

  var message = '';
  if (finalProfiles.length === 0) {
    message = '0 perfis. ' + logs.join(' | ');
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