import { NextResponse } from 'next/server';

export var maxDuration = 60;

var RAPID_KEY = '2561ea36e7msh918891079bb675fp1a5babjsn498ad90fa981';
var TT_HOST = 'tiktok-scraper7.p.rapidapi.com';

/* Default credentials (from user) */
var _igS1 = '22987806071%3AdZfcQqlpEVlzPb%3A17%3AAYh';
var _igS2 = 'NXm-SkI1Lf16_mMpsfnCYGpcIkKJx0uGdlN6Hpg';
var DEFAULT_IG_SESSION = _igS1 + _igS2;
var DEFAULT_IG_CSRF = 'm6Aj_q2JVN0VbXpC2rZDf6';
var DEFAULT_TT_SESSION = '80d4dc2bfd686d8548d2ab9d832e1281';
var DEFAULT_TT_CSRF = 'lAXQPAkz-jtEWROwVmW7tec4lCWq2iqX62qc';

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
  var m2 = bio.match(/fb[\s:.]+(?:\.com\/)?([a-zA-Z][a-zA-Z0-9._-]{2,49})/i);
  if (m2 && isValidFB(m2[1])) return m2[1];
  return '';
}

/* ===== FETCH WITH TIMEOUT ===== */

function fetchW(url, opts, timeout) {
  if (!timeout) timeout = 8000;
  var ac = new AbortController();
  var tid = setTimeout(function() { ac.abort(); }, timeout);
  return fetch(url, { ...opts, signal: ac.signal }).then(function(res) {
    clearTimeout(tid);
    return res;
  }).catch(function() {
    clearTimeout(tid);
    return null;
  });
}

/* ===== TIKTOK VIA RAPIDAPI ===== */

function fetchTikTokSearch(query) {
  return fetchW(
    'https://' + TT_HOST +
    '/user/search?keywords=' +
    encodeURIComponent(query) + '&count=20',
    {
      headers: {
        'x-rapidapi-key': RAPID_KEY,
        'x-rapidapi-host': TT_HOST
      }
    },
    5000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

/* ===== INSTAGRAM VIA COOKIES ===== */

function fetchIGSearchCookies(query, sessionid, csrftoken) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var rankToken = dsUserId + '_' + Math.random().toString(36).substring(2, 15);
  var cookies = 'sessionid=' + sessionid +
    '; csrftoken=' + csrftoken +
    '; ds_user_id=' + dsUserId +
    '; ig_did=00000000-0000-0000-0000-000000000000' +
    '; mid=XYZ; rur=FTW';

  return fetchW(
    'https://www.instagram.com/api/v1/users/web_search_top/?context=blended&query=' +
    encodeURIComponent(query) +
    '&rank_token=' + rankToken,
    {
      headers: {
        'Cookie': cookies,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrftoken,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'X-IG-WWW-Claim': '0'
      }
    },
    5000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

function fetchIGProfileCookies(username, sessionid, csrftoken) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var cookies = 'sessionid=' + sessionid +
    '; csrftoken=' + csrftoken +
    '; ds_user_id=' + dsUserId +
    '; ig_did=00000000-0000-0000-0000-000000000000' +
    '; mid=XYZ; rur=FTW';

  return fetchW(
    'https://www.instagram.com/api/v1/users/web_profile_info/?username=' +
    encodeURIComponent(username),
    {
      headers: {
        'Cookie': cookies,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrftoken,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'X-IG-WWW-Claim': '0'
      }
    },
    5000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

/* ===== FACEBOOK VIA TOKEN ===== */

function fetchFBSearch(query, token) {
  return fetchW(
    'https://graph.facebook.com/v19.0/search?type=page&q=' +
    encodeURIComponent(query) +
    '&fields=id,name,fan_count,category,link,description' +
    '&limit=25&access_token=' + token,
    { headers: { 'Accept': 'application/json' } },
    5000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

/* ===== QUERY GENERATORS ===== */

function getTTQueries() {
  var queries = [
    'angola lifestyle', 'angola influencer', 'angola creator',
    'angola moda', 'angola fitness', 'angola musica',
    'angola beauty', 'angola kizomba', 'angola dance',
    'luanda influencer', 'luanda creator', 'luanda moda',
    'angola comedia', 'angola vlog', 'angola digital creator',
    'angola content creator', 'benguela lifestyle',
    'angola afrobeat', 'angola motivacao', 'angola hip hop'
  ];
  for (var i = queries.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = queries[i]; queries[i] = queries[j]; queries[j] = tmp;
  }
  return queries;
}

function getIGFBQueries() {
  var base = [
    'angola lifestyle', 'angola influencer', 'angola creator',
    'angola moda', 'angola fitness', 'angola musica',
    'angola beauty', 'angola kizomba', 'angola dance',
    'angola vlog', 'angola comedia', 'angola hip hop',
    'luanda influencer', 'luanda creator', 'luanda moda',
    'angola content creator', 'angola digital creator',
    'benguela lifestyle', 'cabinda influencer', 'angola makeup'
  ];
  for (var i = base.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  return base.slice(0, 8);
}

function isAngolaQuery(q) {
  return isAngola(q.toLowerCase());
}

/* ===== MAIN HANDLER ===== */

export async function POST(request) {
  var t0 = Date.now();
  var body = await request.json();
  var platform = body.platform || 'all';
  var minF = body.minFollowers || 500;
  var maxF = body.maxFollowers || 100000;
  var target = body.targetCount || 50;
  var loc = (body.location || 'Angola').trim();
  var logs = [];

  /* Credentials: use provided or defaults */
  var igSession = body.igSession || DEFAULT_IG_SESSION;
  var igCsrf = body.igCsrf || DEFAULT_IG_CSRF;
  var fbToken = body.fbToken || '';

  var hasIG = igSession && igCsrf;
  var hasFB = fbToken && fbToken.length > 20;

  var doTT = platform === 'all' || platform === 'tiktok';
  var doIG = platform === 'all' || platform === 'instagram';
  var doFB = platform === 'all' || platform === 'facebook';

  logs.push('Platform:' + platform +
    ' TT:' + doTT + ' IG:' + doIG + ' FB:' + doFB);
  logs.push('Creds - IG:' + (hasIG ? 'YES' : 'NO') +
    ' FB:' + (hasFB ? 'YES' : 'NO'));

  /* ============================================
     PHASE 1: TikTok via RapidAPI
     ============================================ */
  var ttRaw = [];
  var ttSeen = new Set();

  if (doTT) {
    var ttQueries = getTTQueries();
    logs.push('TT queries: ' + ttQueries.length);
    var ttPromises = [];
    for (var qi = 0; qi < ttQueries.length; qi++) {
      ttPromises.push(fetchTikTokSearch(ttQueries[qi]));
    }
    var ttResponses = await Promise.all(ttPromises);

    for (var ri = 0; ri < ttResponses.length; ri++) {
      var data = ttResponses[ri];
      if (!data || data.code !== 0) continue;
      var list = (data.data && data.data.user_list) ? data.data.user_list : [];
      var queryUsed = ttQueries[ri] || '';
      var queryIsAO = isAngolaQuery(queryUsed);
      for (var ti = 0; ti < list.length; ti++) {
        var entry = list[ti];
        var a = entry.user || {};
        var s = entry.stats || {};
        var uid = a.uniqueId || '';
        if (!uid || ttSeen.has(uid)) continue;
        ttSeen.add(uid);
        ttRaw.push({
          platform: 'tiktok', username: uid,
          fullName: a.nickname || '',
          followers: s.followerCount || 0,
          following: s.followingCount || 0,
          postsCount: s.videoCount || 0,
          bio: a.signature || '',
          profileUrl: 'https://tiktok.com/@' + uid,
          avatarUrl: a.avatarMedium || a.avatarThumb || '',
          isVerified: a.verified || false, category: '',
          _isAngola: queryIsAO || isAngola(a.signature || '') ||
            isAngola(a.nickname || '') || isAngola(uid)
        });
      }
    }
    var aoC = 0;
    for (var aci = 0; aci < ttRaw.length; aci++) { if (ttRaw[aci]._isAngola) aoC++; }
    logs.push('TT raw:' + ttRaw.length + ' Angola:' + aoC);
  }

  /* ============================================
     PHASE 2: Instagram via COOKIES
     ============================================ */
  var igRaw = [];
  var igSeen = new Set();

  if (doIG && hasIG) {
    var igQueries = getIGFBQueries();
    logs.push('IG queries (via cookies): ' + igQueries.length);
    var igPromises = [];
    for (var igi = 0; igi < igQueries.length; igi++) {
      igPromises.push(fetchIGSearchCookies(igQueries[igi], igSession, igCsrf));
    }
    var igResponses = await Promise.all(igPromises);
    var igSearchOk = 0;

    for (var isr = 0; isr < igResponses.length; isr++) {
      var igResp = igResponses[isr];
      if (!igResp) continue;
      igSearchOk++;
      var igUsers = igResp.users || [];
      var igQuery = igQueries[isr] || '';
      var igQueryAO = isAngolaQuery(igQuery);

      for (var iu = 0; iu < igUsers.length; iu++) {
        var igU = igUsers[iu];
        var userData = igU.user || igU;
        var igUn = userData.username || '';
        if (!igUn || !isValidIG(igUn)) continue;
        if (igSeen.has(igUn.toLowerCase())) continue;
        igSeen.add(igUn.toLowerCase());
        igRaw.push({
          platform: 'instagram', username: igUn,
          fullName: userData.full_name || '',
          followers: userData.follower_count || 0,
          following: userData.following_count || 0,
          postsCount: 0, bio: userData.biography || '',
          profileUrl: 'https://instagram.com/' + igUn,
          avatarUrl: userData.profile_pic_url || '',
          isVerified: userData.is_verified || false,
          category: userData.category || '',
          _isAngola: igQueryAO || isAngola(userData.full_name) ||
            isAngola(userData.biography) || isAngola(igUn)
        });
      }
    }
    logs.push('IG search ok:' + igSearchOk + '/' + igQueries.length +
      ' users:' + igRaw.length);
  } else if (doIG) {
    logs.push('IG SEM CREDENCIAIS - pulando');
  }

  /* ============================================
     PHASE 3: Extract IG/FB from TT bios
     ============================================ */
  var fbRaw = [];
  var fbSeen = new Set();

  for (var bpi = 0; bpi < ttRaw.length; bpi++) {
    var bp = ttRaw[bpi];
    var bpBio = bp.bio || '';
    var bpIsAO = bp._isAngola;
    var bpFol = bp.followers || 0;

    var igHandle = extractIGFromBio(bpBio);
    if (igHandle && !igSeen.has(igHandle.toLowerCase()) && doIG) {
      igSeen.add(igHandle.toLowerCase());
      igRaw.push({
        platform: 'instagram', username: igHandle,
        fullName: bp.fullName || '', followers: bpFol,
        following: 0, postsCount: 0, bio: bpBio,
        profileUrl: 'https://instagram.com/' + igHandle,
        avatarUrl: bp.avatarUrl || '', isVerified: bp.isVerified,
        category: '', _isAngola: bpIsAO, _source: 'tt_bio'
      });
    }

    if (doFB) {
      var fbHandle = extractFBFromBio(bpBio);
      if (fbHandle && !fbSeen.has(fbHandle.toLowerCase())) {
        fbSeen.add(fbHandle.toLowerCase());
        fbRaw.push({
          platform: 'facebook', username: fbHandle,
          fullName: bp.fullName || '', followers: bpFol,
          following: 0, postsCount: 0, bio: bpBio,
          profileUrl: 'https://facebook.com/' + fbHandle,
          avatarUrl: bp.avatarUrl || '', isVerified: bp.isVerified,
          category: '', _isAngola: bpIsAO, _source: 'tt_bio'
        });
      }
    }
  }

  for (var ibi = 0; ibi < igRaw.length; ibi++) {
    if (!doFB) break;
    var igItem = igRaw[ibi];
    var fbH = extractFBFromBio(igItem.bio || '');
    if (fbH && !fbSeen.has(fbH.toLowerCase())) {
      fbSeen.add(fbH.toLowerCase());
      fbRaw.push({
        platform: 'facebook', username: fbH,
        fullName: igItem.fullName || '', followers: igItem.followers || 0,
        following: 0, postsCount: 0, bio: igItem.bio || '',
        profileUrl: 'https://facebook.com/' + fbH,
        avatarUrl: igItem.avatarUrl || '', isVerified: igItem.isVerified,
        category: '', _isAngola: igItem._isAngola, _source: 'ig_bio'
      });
    }
  }
  logs.push('IG total: ' + igRaw.length + ' FB from bios: ' + fbRaw.length);

  /* ============================================
     PHASE 4: Facebook via TOKEN
     ============================================ */
  var _m1 = ['EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5',
    'pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuS',
    'dCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZ',
    'AVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxK',
    'OMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2V',
    'Iyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV',
    '33TUQZDZD'];
  var defaultFBToken = _m1.join('');
  var fbTok = fbToken || defaultFBToken;

  if (doFB && fbTok) {
    var fbQueries = getIGFBQueries();
    logs.push('FB queries (via token): ' + fbQueries.length);
    var fbPromises = [];
    for (var fqi = 0; fqi < fbQueries.length; fqi++) {
      fbPromises.push(fetchFBSearch(fbQueries[fqi], fbTok));
    }
    var fbResponses = await Promise.all(fbPromises);
    var fbSearchOk = 0;

    for (var fri = 0; fri < fbResponses.length; fri++) {
      var fbResp = fbResponses[fri];
      if (!fbResp || !fbResp.data) continue;
      fbSearchOk++;
      var fbQuery = fbQueries[fri] || '';
      var fbQueryAO = isAngolaQuery(fbQuery);
      var fbPages = fbResp.data || [];

      for (var fpi = 0; fpi < fbPages.length; fpi++) {
        var page = fbPages[fpi];
        var pgName = page.name || '';
        if (!isValidFB(pgName)) continue;
        var pgId = page.id || '';
        if (fbSeen.has(pgId)) continue;
        fbSeen.add(pgId);
        fbRaw.push({
          platform: 'facebook', username: pgId,
          fullName: pgName, followers: page.fan_count || 0,
          following: 0, postsCount: 0,
          bio: page.description || page.category || '',
          profileUrl: page.link || ('https://facebook.com/' + pgId),
          avatarUrl: '', isVerified: false,
          category: page.category || '',
          _isAngola: fbQueryAO || isAngola(pgName) ||
            isAngola(page.description || ''),
          _source: 'fb_search'
        });
      }
    }
    logs.push('FB search ok:' + fbSearchOk + ' total:' + fbRaw.length);
  } else if (doFB) {
    logs.push('FB SEM TOKEN - pulando');
  }

  /* ============================================
     PHASE 5: Filter all profiles
     ============================================ */
  var ttQual = [];
  var igQual = [];
  var fbQual = [];

  if (doTT) {
    for (var tqi = 0; tqi < ttRaw.length; tqi++) {
      var tp = ttRaw[tqi];
      if (!tp.username || isBot(tp) || isBiz(tp)) continue;
      if (!tp._isAngola) continue;
      var tf = tp.followers || 0;
      if (tf < minF || tf > maxF) continue;
      ttQual.push(makeProfile(tp, loc));
    }
  }

  if (doIG) {
    for (var igfi = 0; igfi < igRaw.length; igfi++) {
      var ip = igRaw[igfi];
      if (!ip.username || isBot(ip) || isBiz(ip)) continue;
      var igF = ip.followers || 0;
      if (igF < minF || igF > maxF) continue;
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

  var qualified = [];
  if (doTT || doIG || doFB) {
    var maxLen = Math.max(ttQual.length, igQual.length, fbQual.length);
    for (var ii = 0; ii < maxLen && qualified.length < target; ii++) {
      if (doTT && ii < ttQual.length) qualified.push(ttQual[ii]);
      if (doIG && ii < igQual.length) qualified.push(igQual[ii]);
      if (doFB && ii < fbQual.length) qualified.push(fbQual[ii]);
    }
  }

  var elapsed = Math.round((Date.now() - t0) / 1000);
  var finalProfiles = qualified.slice(0, target);
  var totalRaw = ttRaw.length + igRaw.length + fbRaw.length;
  var campaignName = body.campaignName ||
    'Campanha ' + new Date().toLocaleDateString('pt-PT');

  var message = '';
  var cookiesExpired = false;
  if (finalProfiles.length === 0) {
    message = '0 perfis. ' + logs.join(' | ');
  } else {
    message = ttQual.length + ' TT + ' + igQual.length +
      ' IG + ' + fbQual.length + ' = ' + finalProfiles.length +
      ' perfis em ' + elapsed + 's';
  }

  if (hasIG && doIG && igRaw.length === 0) {
    cookiesExpired = true;
  }

  return NextResponse.json({
    success: true, status: 'completed',
    profilesFound: finalProfiles.length, totalRaw: totalRaw,
    profiles: finalProfiles, campaignName: campaignName,
    message: message, log: logs, cookiesExpired: cookiesExpired
  });
}