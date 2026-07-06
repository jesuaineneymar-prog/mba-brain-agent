import { NextResponse } from 'next/server';

export var maxDuration = 60;

var SCRAPINGANT_KEY = '897af2903f4848fba1f603a46273d842';
var SCRAPINGANT_BASE = 'https://api.scrapingant.com/v1/general';

/* Angola detection words */
var AO_WORDS = [
  'angola', 'angolana', 'angolano', 'luanda', 'benguela',
  'huambo', 'lobito', 'cabinda', 'lubango', 'namibe',
  'malanje', 'sumbe', 'soyo', 'dundo', 'huila',
  'cuanza', 'zaire', 'cunene', 'moxico', 'lunda',
  'bie', '_ao', '_angola', '+244', 'angol',
  'luandense', 'benguelense', 'cabindense', 'huambiense'
];

function isAngola(text) {
  if (!text) return false;
  var lower = text.toLowerCase();
  for (var i = 0; i < AO_WORDS.length; i++) {
    if (lower.indexOf(AO_WORDS[i]) >= 0) return true;
  }
  return false;
}

function gid() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function isBot(p) {
  var n = (p.username || '').toLowerCase();
  var b = (p.bio || '').toLowerCase();
  if (/\d{5,}/.test(n)) return true;
  if (/^user\d+/i.test(n)) return true;
  if (b.indexOf('follow for follow') >= 0) return true;
  if (b.indexOf('free followers') >= 0) return true;
  return false;
}

function isBiz(p) {
  var b = (
    (p.bio || '') + ' ' +
    (p.category || '') + ' ' +
    (p.fullName || '')
  ).toLowerCase();
  var u = (p.username || '').toLowerCase();
  var words = [
    'restauran', 'hotel', 'pousada',
    'clinica', 'farmac', 'supermerc',
    'imobiliaria', 'dentista',
    'advogad', 'oficina mecanic',
    'engenharia', 'contabil',
    'logistica', 'transporte',
    'telecomunica', 'seguranca privada',
    'seguros', 'imobili',
    'embai', 'governo', 'minist',
    'polici', 'petroleos',
    'loja ', ' loja', 'store ',
    ' shop ', 'shop\n', ' boutique'
  ];
  for (var i = 0; i < words.length; i++) {
    if (b.indexOf(words[i]) >= 0) return true;
  }
  if (/^(loja|shop|store|boutique|hotel|clinica)/i.test(u)) return true;
  if (/^(compra|venda|imoveis|aluguel)/i.test(u)) return true;
  return false;
}

function makeProfile(p, loc) {
  return {
    id: gid(),
    campaignId: gid(),
    platform: p.platform,
    username: p.username,
    displayName: p.fullName || '',
    followers: p.followers || 0,
    following: p.following || 0,
    postsCount: p.postsCount || 0,
    monthsActive: 12,
    isRegular: true,
    isVerified: p.isVerified || false,
    score: 50,
    category: p.category || 'Outro',
    location: loc,
    bio: p.bio || '',
    profileUrl: p.profileUrl || '',
    avatarUrl: p.avatarUrl || '',
    status: 'prospect',
    isBot: false,
    isBusiness: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    notes: ''
  };
}

function isValidIG(un) {
  if (!un || un.length < 3 || un.length > 30) return false;
  var bad = ['p', 'explore', 'reel', 'reels', 'stories', 'direct',
    'accounts', 'about', 'api', 'blog', 'help', 'press',
    'developer', 'legal', 'privacy', 'terms', 'web', 'email'];
  if (bad.indexOf(un.toLowerCase()) >= 0) return false;
  if (/^\d/.test(un)) return false;
  return true;
}

function isValidFB(name) {
  if (!name || name.length < 3) return false;
  var bad = ['events', 'groups', 'watch', 'marketplace', 'reels',
    'gaming', 'login', 'recover', 'help', 'pages', 'p',
    'l', 'n', 'r', 'media', 'photo', 'photos', 'video',
    'videos', 'post', 'posts', 'comment', 'plugins',
    'dialog', 'sharer', 'ajax', 'm', 'mobile', 'www',
    'apps', 'privacy', 'terms', 'careers', 'directory',
    'people', 'places', 'games', 'business', 'story'];
  if (bad.indexOf(name.toLowerCase()) >= 0) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

function isValidTT(un) {
  if (!un || un.length < 2 || un.length > 24) return false;
  if (/^user\d+/i.test(un)) return false;
  if (/\d{5,}/.test(un)) return false;
  return true;
}

function extractIGFromBio(bio) {
  if (!bio) return '';
  var m1 = bio.match(/instagram\.com\/([a-zA-Z0-9_.]{3,30})/i);
  if (m1 && isValidIG(m1[1])) return m1[1];
  var m2 = bio.match(/ig[\s:]+@?([a-zA-Z0-9_.]{3,30})\b/i);
  if (m2 && isValidIG(m2[1])) return m2[1];
  return '';
}

function extractFBFromBio(bio) {
  if (!bio) return '';
  var m1 = bio.match(/facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,49})/i);
  if (m1 && isValidFB(m1[1])) return m1[1];
  var m2 = bio.match(/fb\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,49})/i);
  if (m2 && isValidFB(m2[1])) return m2[1];
  return '';
}

/* ===== SCRAPINGANT FETCH (sequential, respects free plan limits) ===== */

async function scrapingAntFetch(url: string, timeoutMs: number): Promise<{ content: string; status_code: number } | null> {
  var ctrl = new AbortController();
  var tid = setTimeout(function() { ctrl.abort(); }, timeoutMs);
  try {
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    var fullUrl = SCRAPINGANT_BASE + '?url=' + encodeURIComponent(url) +
      '&x-api-key=' + SCRAPINGANT_KEY +
      '&browser=false';
    var res = await fetch(fullUrl, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) {
      var errText = '';
      try { errText = await res.text(); } catch (e) { /* ignore */ }
      return { content: '', status_code: res.status, _error: errText.substring(0, 200) } as any;
    }
    var data = await res.json();
    return data;
  } catch (e) {
    clearTimeout(tid);
    return null;
  }
}

/* ===== TIKTOK: DuckDuckGo search for TT profiles ===== */

async function searchTTViaDDG(query: string): Promise<string[]> {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' +
    encodeURIComponent(query) + '&num=20';
  var result = await scrapingAntFetch(ddgUrl, 15000);
  if (!result || !result.content) return [];

  var usernames: string[] = [];
  // Extract @username from result snippets and URLs
  var re1 = /tiktok\.com\/@([a-zA-Z0-9_.]+)/g;
  var m;
  while ((m = re1.exec(result.content)) !== null) {
    var un = m[1];
    if (isValidTT(un) && usernames.indexOf(un) < 0) {
      usernames.push(un);
    }
  }
  return usernames;
}

/* ===== INSTAGRAM: Scrape hashtag pages ===== */

async function searchIGViaHashtag(tag: string): Promise<string[]> {
  var igUrl = 'https://www.instagram.com/explore/tags/' + encodeURIComponent(tag) + '/';
  var result = await scrapingAntFetch(igUrl, 20000);
  if (!result || !result.content) return [];

  var usernames: string[] = [];
  // IG embeds data in script tags
  var scripts = result.content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.indexOf('"username"') < 0) continue;
    // Extract all usernames from this script block
    var re = /"username":"([^"]+)"/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      var un = m[1];
      if (isValidIG(un) && usernames.indexOf(un) < 0) {
        usernames.push(un);
      }
    }
    if (usernames.length >= 50) break;
  }
  return usernames;
}

/* ===== ENRICH: Scrape TT profile page for bio/followers ===== */

async function enrichTTProfile(username: string): Promise<any> {
  var url = 'https://www.tiktok.com/@' + username;
  var result = await scrapingAntFetch(url, 15000);
  if (!result || !result.content) return null;

  var content = result.content;
  // TT profile pages with browser=false may have SIGI_STATE or __NEXT_DATA__
  // Try to extract from SIGI_STATE
  var sigMatch = content.match(/window\.SIGI_STATE\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (sigMatch) {
    try {
      var stateStr = sigMatch[1].replace(/undefined/g, 'null');
      // Find user section
      var userSection = stateStr.match(/"UserModule"/);
      if (userSection) {
        // Extract fields with regex from the raw string
        var nickname = (stateStr.match(/"nickname":"([^"]*)"/) || [])[1] || '';
        var signature = (stateStr.match(/"signature":"([^"]*)"/) || [])[1] || '';
        var followers = parseInt((stateStr.match(/"followerCount":(\d+)/) || [])[1]) || 0;
        var following = parseInt((stateStr.match(/"followingCount":(\d+)/) || [])[1]) || 0;
        var videoCount = parseInt((stateStr.match(/"videoCount":(\d+)/) || [])[1]) || 0;
        var avatar = (stateStr.match(/"avatarMedium":"([^"]*)"/) || [])[1] || '';
        var verified = stateStr.indexOf('"verified":true') >= 0;
        return { nickname, signature, followers, following, videoCount, avatar, verified };
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Fallback: try regex directly on content
  var nickname = (content.match(/"nickname":"([^"]*)"/) || [])[1] || '';
  var signature = (content.match(/"signature":"([^"]*)"/) || [])[1] || '';
  var followers = parseInt((content.match(/"followerCount":(\d+)/) || [])[1]) || 0;
  var following = parseInt((content.match(/"followingCount":(\d+)/) || [])[1]) || 0;
  var videoCount = parseInt((content.match(/"videoCount":(\d+)/) || [])[1]) || 0;
  var avatar = (content.match(/"avatarMedium":"([^"]*)"/) || [])[1] || '';
  var verified = content.indexOf('"verified":true') >= 0;
  if (nickname || signature || followers > 0) {
    return { nickname, signature, followers, following, videoCount, avatar, verified };
  }
  return null;
}

/* ===== ENRICH: Scrape IG profile page ===== */

async function enrichIGProfile(username: string): Promise<any> {
  var url = 'https://www.instagram.com/' + username + '/';
  var result = await scrapingAntFetch(url, 15000);
  if (!result || !result.content) return null;

  var content = result.content;
  var followers = 0, following = 0, posts = 0, bio = '', fullName = '', avatar = '', verified = false, category = '';

  // Decode HTML entities
  function decodeEntities(t: string): string {
    return t.replace(/&#x([0-9A-Fa-f]+);/g, function(_, hex) { return String.fromCharCode(parseInt(hex, 16)); })
            .replace(/&#(\d+);/g, function(_, dec) { return String.fromCharCode(parseInt(dec, 10)); })
            .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  // Extract from og:description (most reliable source)
  var ogDescMatch = content.match(/property="og:description"\s+content="([^"]*)"/i);
  var descSource = ogDescMatch ? ogDescMatch[1] : '';

  // Fallback: meta name="description"
  if (!descSource) {
    var metaDescMatch = content.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
    if (metaDescMatch) descSource = metaDescMatch[1];
  }

  if (descSource) {
    var desc = decodeEntities(descSource);
    // Format: "2M Followers, 360 Following, 6,814 Posts - See Instagram photos..."
    var fMatch = desc.match(/([\d,.]+)\s*[KMB]?\s*Followers/i);
    if (fMatch) {
      var fStr = fMatch[1].replace(/,/g, '');
      var fMult = 1;
      if (/\d[\d,.]*\s*K/i.test(desc.substring(desc.indexOf(fMatch[0])))) fMult = 1000;
      if (/\d[\d,.]*\s*M/i.test(desc.substring(desc.indexOf(fMatch[0])))) fMult = 1000000;
      if (/\d[\d,.]*\s*B/i.test(desc.substring(desc.indexOf(fMatch[0])))) fMult = 1000000000;
      followers = Math.round(parseFloat(fStr) * fMult) || 0;
    }
    var pMatch = desc.match(/([\d,.]+)\s*[KMB]?\s*Posts/i);
    if (pMatch) {
      var pStr = pMatch[1].replace(/,/g, '');
      var pMult = 1;
      if (/\d[\d,.]*\s*K/i.test(desc.substring(desc.indexOf(pMatch[0])))) pMult = 1000;
      if (/\d[\d,.]*\s*M/i.test(desc.substring(desc.indexOf(pMatch[0])))) pMult = 1000000;
      posts = Math.round(parseFloat(pStr) * pMult) || 0;
    }
    var fwMatch = desc.match(/([\d,.]+)\s*[KMB]?\s*Following/i);
    if (fwMatch) {
      var fwStr = fwMatch[1].replace(/,/g, '');
      var fwMult = 1;
      if (/\d[\d,.]*\s*K/i.test(desc.substring(desc.indexOf(fwMatch[0])))) fwMult = 1000;
      if (/\d[\d,.]*\s*M/i.test(desc.substring(desc.indexOf(fwMatch[0])))) fwMult = 1000000;
      following = Math.round(parseFloat(fwStr) * fwMult) || 0;
    }
    // Name is before the first comma or parenthesis
    var nameMatch = desc.match(/^([^,(]+)/);
    if (nameMatch) fullName = nameMatch[1].trim().replace(/\s*\d[\d,.]*\s*Followers.*/i, '');
    // Remove "See Instagram" suffix
    fullName = fullName.replace(/\s*[-–].*$/, '').trim();
  }

  // Extract from script data
  var scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (var i = 0; i < scripts.length; i++) {
    var s = scripts[i];
    if (s.indexOf('edge_followed_by') < 0) continue;
    if (followers === 0) {
      var fcm = s.match(/"edge_followed_by":\{"count":(\d+)\}/);
      if (fcm) followers = parseInt(fcm[1]) || 0;
    }
    if (following === 0) {
      var fm = s.match(/"edge_follow":\{"count":(\d+)\}/);
      if (fm) following = parseInt(fm[1]) || 0;
    }
    if (posts === 0) {
      var pm = s.match(/"edge_owner_to_timeline_media":\{"count":(\d+)\}/);
      if (pm) posts = parseInt(pm[1]) || 0;
    }
    if (!bio) {
      var bm = s.match(/"biography":"((?:[^"\\]|\\.)*)"/);
      if (bm) bio = bm[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    if (!fullName) {
      var fnm = s.match(/"full_name":"((?:[^"\\]|\\.)*)"/);
      if (fnm) fullName = fnm[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
    if (!avatar) {
      var am = s.match(/"profile_pic_url(?:_hd)?":"([^"]+)"/);
      if (am) avatar = am[1];
    }
    if (!category) {
      var cm = s.match(/"category_name":"([^"]+)"/);
      if (cm) category = cm[1];
    }
    if (s.indexOf('"is_verified":true') >= 0) verified = true;
  }

  return { fullName, followers, following, posts, bio, avatar, verified, category };
}

/* ===== QUERY GENERATORS ===== */

function getTTSearchQueries(): string[] {
  var q = [
    'angola influencer tiktok', 'angolano tiktok creator',
    'luanda tiktok influencer', 'angola tiktok kizomba',
    'angola tiktok lifestyle', 'angola tiktok musica',
    'angola tiktok moda', 'angola tiktok fitness',
    'angola tiktok comedia', 'angola digital tiktok',
    'benguela tiktok', 'angola content creator tiktok',
    'angola tiktok dance', 'angola tiktok entrepreneur'
  ];
  // Shuffle
  for (var i = q.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q.slice(0, 6);
}

function getIGHashtags(): string[] {
  var tags = [
    'angola', 'angolainfluencer', 'luanda',
    'angolamoda', 'angolafitness', 'kizombaangola'
  ];
  // Shuffle
  for (var i = tags.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = tags[i]; tags[i] = tags[j]; tags[j] = t;
  }
  return tags.slice(0, 3); // Max 3 IG hashtag scrapes
}

function getFBDuckDuckQueries(): string[] {
  var q = [
    'site:facebook.com "angola" influencer',
    'site:facebook.com "angola" creator',
    'site:facebook.com "luanda" influencer'
  ];
  return q;
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

  logs.push('Platform:' + platform +
    ' TT:' + doTT + ' IG:' + doIG + ' FB:' + doFB);
  logs.push('ScrapingAnt API: active (free plan, sequential)');

  var ttRaw: any[] = [];
  var ttSeen = new Set<string>();
  var igRaw: any[] = [];
  var igSeen = new Set<string>();
  var fbRaw: any[] = [];
  var fbSeen = new Set<string>();

  /* ============================================
     PHASE 1: TikTok via DuckDuckGo + ScrapingAnt
     ============================================ */
  if (doTT) {
    var ttQueries = getTTSearchQueries();
    logs.push('TT DDG queries: ' + ttQueries.length);

    for (var qi = 0; qi < ttQueries.length; qi++) {
      if (Date.now() - t0 > 45000) {
        logs.push('TT: timeout approaching, stopping');
        break;
      }
      var ttUsers = await searchTTViaDDG(ttQueries[qi]);
      for (var ti = 0; ti < ttUsers.length; ti++) {
        var un = ttUsers[ti];
        if (ttSeen.has(un.toLowerCase())) continue;
        ttSeen.add(un.toLowerCase());
        ttRaw.push({
          platform: 'tiktok', username: un,
          fullName: '', followers: 0, following: 0, postsCount: 0,
          bio: '', profileUrl: 'https://tiktok.com/@' + un,
          avatarUrl: '', isVerified: false, category: '',
          _isAngola: isAngola(ttQueries[qi])
        });
      }
    }
    logs.push('TT found (DDG): ' + ttRaw.length);

    // Enrich up to 3 TT profiles (sequentially)
    var ttToEnrich = ttRaw.slice(0, 3);
    var ttEnriched = 0;
    for (var ei = 0; ei < ttToEnrich.length; ei++) {
      if (Date.now() - t0 > 25000) break;
      var enriched = await enrichTTProfile(ttToEnrich[ei].username);
      if (enriched) {
        ttEnriched++;
        ttToEnrich[ei].fullName = enriched.nickname || ttToEnrich[ei].fullName;
        ttToEnrich[ei].followers = enriched.followers || 0;
        ttToEnrich[ei].following = enriched.following || 0;
        ttToEnrich[ei].postsCount = enriched.videoCount || 0;
        ttToEnrich[ei].bio = enriched.signature || '';
        ttToEnrich[ei].avatarUrl = enriched.avatar || '';
        ttToEnrich[ei].isVerified = enriched.verified || false;
        if (isAngola(enriched.signature || '')) ttToEnrich[ei]._isAngola = true;
        if (isAngola(enriched.nickname || '')) ttToEnrich[ei]._isAngola = true;
      }
    }
    logs.push('TT enriched: ' + ttEnriched + '/' + ttToEnrich.length);
  }

  /* ============================================
     PHASE 2: Instagram via hashtag pages
     ============================================ */
  if (doIG) {
    var igTags = getIGHashtags();
    logs.push('IG hashtag queries: ' + igTags.length);

    for (var hi = 0; hi < igTags.length; hi++) {
      if (Date.now() - t0 > 45000) {
        logs.push('IG: timeout approaching, stopping');
        break;
      }
      var igUsers = await searchIGViaHashtag(igTags[hi]);
      for (var ii = 0; ii < igUsers.length; ii++) {
        var igUn = igUsers[ii];
        if (igSeen.has(igUn.toLowerCase())) continue;
        igSeen.add(igUn.toLowerCase());
        igRaw.push({
          platform: 'instagram', username: igUn,
          fullName: '', followers: 0, following: 0, postsCount: 0,
          bio: '', profileUrl: 'https://instagram.com/' + igUn,
          avatarUrl: '', isVerified: false, category: '',
          _isAngola: isAngola(igTags[hi])
        });
      }
    }
    logs.push('IG found (hashtags): ' + igRaw.length);

    // Enrich up to 3 IG profiles (sequentially)
    var igToEnrich = igRaw.slice(0, 3);
    var igEnriched = 0;
    for (var iei = 0; iei < igToEnrich.length; iei++) {
      if (Date.now() - t0 > 50000) break;
      var igData = await enrichIGProfile(igToEnrich[iei].username);
      if (igData) {
        igEnriched++;
        igToEnrich[iei].fullName = igData.fullName || igToEnrich[iei].fullName;
        igToEnrich[iei].followers = igData.followers || 0;
        igToEnrich[iei].following = igData.following || 0;
        igToEnrich[iei].postsCount = igData.posts || 0;
        igToEnrich[iei].bio = igData.bio || '';
        igToEnrich[iei].avatarUrl = igData.avatar || '';
        igToEnrich[iei].isVerified = igData.verified || false;
        igToEnrich[iei].category = igData.category || '';
        if (isAngola(igData.bio || '')) igToEnrich[iei]._isAngola = true;
        if (isAngola(igData.fullName || '')) igToEnrich[iei]._isAngola = true;
      }
    }
    logs.push('IG enriched: ' + igEnriched + '/' + igToEnrich.length);
  }

  /* ============================================
     PHASE 3: Facebook via bio extraction + DDG
     ============================================ */
  if (doFB) {
    // Extract FB from TT bios
    for (var bpi = 0; bpi < ttRaw.length; bpi++) {
      var bp = ttRaw[bpi];
      var fbH = extractFBFromBio(bp.bio || '');
      if (fbH && !fbSeen.has(fbH.toLowerCase())) {
        fbSeen.add(fbH.toLowerCase());
        fbRaw.push({
          platform: 'facebook', username: fbH,
          fullName: bp.fullName || '', followers: bp.followers || 0,
          following: 0, postsCount: 0, bio: bp.bio || '',
          profileUrl: 'https://facebook.com/' + fbH,
          avatarUrl: bp.avatarUrl || '', isVerified: bp.isVerified,
          category: '', _isAngola: bp._isAngola, _source: 'tt_bio'
        });
      }
    }

    // Extract FB from IG bios
    for (var ibi = 0; ibi < igRaw.length; ibi++) {
      var igItem = igRaw[ibi];
      var fbFromIg = extractFBFromBio(igItem.bio || '');
      if (fbFromIg && !fbSeen.has(fbFromIg.toLowerCase())) {
        fbSeen.add(fbFromIg.toLowerCase());
        fbRaw.push({
          platform: 'facebook', username: fbFromIg,
          fullName: igItem.fullName || '', followers: igItem.followers || 0,
          following: 0, postsCount: 0, bio: igItem.bio || '',
          profileUrl: 'https://facebook.com/' + fbFromIg,
          avatarUrl: igItem.avatarUrl || '', isVerified: igItem.isVerified,
          category: '', _isAngola: igItem._isAngola, _source: 'ig_bio'
        });
      }
    }

    // Also try DDG for FB profiles (if we still have time)
    if (Date.now() - t0 < 40000) {
      var fbQueries = getFBDuckDuckQueries();
      for (var fqi = 0; fqi < fbQueries.length; fqi++) {
        if (Date.now() - t0 > 50000) break;
        var ddgUrl = 'https://html.duckduckgo.com/html/?q=' +
          encodeURIComponent(fbQueries[fqi]) + '&num=20';
        var fbResult = await scrapingAntFetch(ddgUrl, 15000);
        if (!fbResult || !fbResult.content) continue;

        // Extract FB page/profile names
        var fbMatches = fbResult.content.match(/facebook\.com\/([a-zA-Z][a-zA-Z0-9._-]{2,49})/g) || [];
        for (var fmi = 0; fmi < fbMatches.length; fmi++) {
          var fbName = fbMatches[fmi].replace('facebook.com/', '');
          if (fbSeen.has(fbName.toLowerCase())) continue;
          if (!isValidFB(fbName)) continue;
          fbSeen.add(fbName.toLowerCase());
          fbRaw.push({
            platform: 'facebook', username: fbName,
            fullName: '', followers: 0, following: 0, postsCount: 0,
            bio: '', profileUrl: 'https://facebook.com/' + fbName,
            avatarUrl: '', isVerified: false, category: '',
            _isAngola: isAngola(fbQueries[fqi]), _source: 'ddg'
          });
        }
      }
    }

    logs.push('FB total: ' + fbRaw.length);
  }

  /* ============================================
     PHASE 4: Cross-extract IG from TT bios
     ============================================ */
  for (var cei = 0; cei < ttRaw.length; cei++) {
    var ttP = ttRaw[cei];
    var igFromTT = extractIGFromBio(ttP.bio || '');
    if (igFromTT && !igSeen.has(igFromTT.toLowerCase()) && doIG) {
      igSeen.add(igFromTT.toLowerCase());
      igRaw.push({
        platform: 'instagram', username: igFromTT,
        fullName: ttP.fullName || '', followers: ttP.followers || 0,
        following: 0, postsCount: 0, bio: ttP.bio || '',
        profileUrl: 'https://instagram.com/' + igFromTT,
        avatarUrl: ttP.avatarUrl || '', isVerified: ttP.isVerified,
        category: '', _isAngola: ttP._isAngola, _source: 'tt_bio'
      });
    }
  }

  logs.push('IG total: ' + igRaw.length + ' FB total: ' + fbRaw.length);

  /* ============================================
     PHASE 5: Filter all profiles
     ============================================ */
  var ttQual: any[] = [];
  var igQual: any[] = [];
  var fbQual: any[] = [];

  if (doTT) {
    for (var tqi = 0; tqi < ttRaw.length; tqi++) {
      var tp = ttRaw[tqi];
      if (!tp.username || isBot(tp) || isBiz(tp)) continue;
      if (!tp._isAngola && !isAngola(tp.username) && !isAngola(tp.fullName)) continue;
      var tf = tp.followers || 0;
      // For unenriched profiles, allow through with 0 followers (they came from AO search)
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
      if (!ip._isAngola && !isAngola(ip.bio) &&
          !isAngola(ip.fullName) && !isAngola(ip.username)) continue;
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
      if (!ffp._isAngola && !isAngola(ffp.bio) &&
          !isAngola(ffp.fullName)) continue;
      fbQual.push(makeProfile(ffp, loc));
    }
  }

  logs.push('Filtered TT:' + ttQual.length +
    ' IG:' + igQual.length + ' FB:' + fbQual.length);

  /* ============================================
     PHASE 6: Sort & Interleave
     ============================================ */
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
  var campaignName = body.campaignName ||
    'Campanha ' + new Date().toLocaleDateString('pt-PT');

  var message = '';
  if (finalProfiles.length === 0) {
    message = '0 perfis. ' + logs.join(' | ');
  } else {
    message = ttQual.length + ' TT + ' + igQual.length +
      ' IG + ' + fbQual.length + ' = ' + finalProfiles.length +
      ' perfis em ' + elapsed + 's';
  }

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: finalProfiles.length, totalRaw: totalRaw,
    profiles: finalProfiles, campaignName: campaignName,
    message: message, log: logs, cookiesExpired: false
  });
}