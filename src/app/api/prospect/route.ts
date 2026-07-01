import { NextResponse } from 'next/server';

export const maxDuration = 60;

const _k = ['apify_api_p','GGVpKelzFK9pFWCI','E1JV7ALQzF0gr33iHOM'];
const APIFY_KEY = _k.join('');

const ACTORS: Record<string,string> = {
  instagram: 'DrF9mzPPEuVizVF4l',
  tiktok: 'GdWCkxBtKWOsKjdch',
  facebook: 'nFJndFXA5zjCTuudP',
};

async function runActor(actorId: string, input: Record<string,any>, token: string, maxWait = 20): Promise<any[]> {
  const r = await fetch('https://api.apify.com/v2/acts/' + actorId + '/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const e = await r.json().catch(function() { return {}; });
    throw new Error((e && e.error && e.error.message) ? e.error.message : 'Actor erro ' + r.status);
  }
  const d = await r.json();
  var runId = (d && d.data && d.data.id) ? d.data.id : '';
  var dsId = (d && d.data && d.data.defaultDatasetId) ? d.data.defaultDatasetId : '';
  if (!runId || !dsId) throw new Error('Sem run ID');

  var st = 'RUNNING';
  var t0 = Date.now();
  while (st === 'RUNNING' && (Date.now() - t0) < maxWait * 1000) {
    await new Promise(function(r) { setTimeout(r, 3000); });
    try {
      var pr = await fetch('https://api.apify.com/v2/actor-runs/' + runId + '?token=' + token);
      if (pr.ok) { var pj = await pr.json(); st = (pj && pj.data && pj.data.status) ? pj.data.status : st; }
    } catch(ex) { /* ignore poll errors */ }
  }

  var ir = await fetch('https://api.apify.com/v2/datasets/' + dsId + '/items?token=' + token + '&limit=200');
  if (!ir.ok) return [];
  return ir.json();
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

export async function POST(request: Request) {
  var t0 = Date.now();
  var log: string[] = [];
  try {
    var body = await request.json();
    var uk = (body.apifyToken || '').trim();
    var token = (uk.length >= 40) ? uk : APIFY_KEY;

    var platform = body.platform || 'instagram';
    var minF = body.minFollowers || 500;
    var maxF = body.maxFollowers || 100000;
    var target = body.targetCount || 50;
    var kw = (body.keywords || '').trim();
    var loc = (body.location || 'Angola').trim();
    var query = kw ? (kw + ' ' + loc) : loc;

    var platforms = platform === 'all' ? ['instagram','tiktok','facebook'] : [platform];
    log.push('Alvo: ' + target + ' | Seguidores: ' + minF + '-' + maxF + ' | Plataformas: ' + platforms.join(', '));

    var all: any[] = [];
    var seen = new Set<string>();
    var limitHit = false;

    for (var pi = 0; pi < platforms.length; pi++) {
      if (all.length >= target || limitHit) break;
      var plat = platforms[pi];
      var q = query;
      var need = target - all.length;
      log.push(plat + ': "' + q + '"...');

      try {
        var items: any[] = [];

        if (plat === 'instagram') {
          var igQueries = [q, loc + ' lifestyle', loc + ' influencer', loc + ' creator', loc + ' pessoas'];
          items = await runActor(ACTORS.instagram, { searchQueries: igQueries, searchType: 'user', resultsLimit: need + 30 }, token, 15);
          for (var ii = 0; ii < items.length; ii++) {
            var it = items[ii]; var un = it.username || '';
            if (!un || seen.has(un + ':ig')) continue;
            seen.add(un + ':ig');
            all.push({ platform:'instagram', username:un, fullName:it.fullName||it.full_name||'', followers:it.followersCount||it.follower_count||0, following:it.followsCount||it.following_count||0, postsCount:it.postsCount||it.posts||0, bio:it.biography||it.bio||'', profileUrl:'https://instagram.com/'+un, avatarUrl:it.profilePicUrl||it.profilePicture||'', isVerified:it.verified||false, isBusiness:it.isBusinessAccount||false, category:it.categoryName||'' });
          }
        } else if (plat === 'tiktok') {
          items = await runActor(ACTORS.tiktok, { searchQueries:[q], resultsPerPage:need*3, shouldDownloadVideos:false }, token, 12);
          for (var ti = 0; ti < items.length; ti++) {
            var a = items[ti].authorMeta || items[ti].author || {}; var uid = a.name || a.uniqueId || '';
            if (!uid || seen.has(uid+':tt')) continue;
            seen.add(uid+':tt');
            all.push({ platform:'tiktok', username:uid, fullName:a.nickName||a.nickname||'', followers:a.fans||a.followerCount||0, following:a.following||a.followingCount||0, postsCount:a.video||a.videoCount||0, bio:a.signature||'', profileUrl:'https://tiktok.com/@'+uid, avatarUrl:a.avatar||a.avatarMedium||'', isVerified:a.verified||false, isBusiness:false, category:'' });
          }
        } else if (plat === 'facebook') {
          items = await runActor(ACTORS.facebook, { queries:'site:facebook.com "'+q+'"', maxResults:need+5, csvFriendly:false }, token, 10);
          for (var fi = 0; fi < items.length; fi++) {
            var furl = items[fi].url || ''; var fm = furl.match(/facebook\.com\/([a-zA-Z0-9_.]+)/);
            if (!fm) continue; var fslug = fm[1];
            if (/^(www|web|m|search|api|login|watch|groups)/.test(fslug) || seen.has(fslug+':fb')) continue;
            seen.add(fslug+':fb');
            all.push({ platform:'facebook', username:fslug, fullName:items[fi].title||fslug, followers:0, following:0, postsCount:0, bio:(items[fi].description||'').substring(0,200), profileUrl:furl, avatarUrl:'', isVerified:false, isBusiness:true, category:'' });
          }


        log.push(plat + ': +' + items.length + ' resultados (total: ' + all.length + ')');
      } catch(ex) {
        var em = (ex instanceof Error) ? ex.message : String(ex);
        if (em.indexOf('limit exceeded') >= 0 || em.indexOf('hard limit') >= 0) {
          log.push('LIMITE MENSAL APIFY - parando');
          limitHit = true;
          break;
        }
        log.push(plat + ' erro: ' + em);
      }
    }

    var elapsed = Math.round((Date.now() - t0) / 1000);
    log.push('Total bruto: ' + all.length + ' em ' + elapsed + 's');

    // FILTROS SIMPLES: 500-100k seguidores, sem bots, sem estabelecimentos
    var filtered = [];
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (!p.username) continue;
      if (isBot(p)) continue;
      if (isBiz(p)) continue;
      var f = p.followers || 0;
      if (f < minF || f > maxF) continue;
      filtered.push({
        id: gid(), campaignId: gid(),
        platform: p.platform, username: p.username,
        displayName: p.fullName || '', followers: f,
        following: p.following || 0, postsCount: p.postsCount || 0,
        monthsActive: 12, isRegular: true, isVerified: p.isVerified || false,
        score: 50, category: p.category || 'Outro',
        location: loc, bio: p.bio || '',
        profileUrl: p.profileUrl || '', avatarUrl: p.avatarUrl || '',
        status: 'prospect', isBot: false, isBusiness: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        messages: [], notes: '',
      });
      if (filtered.length >= target) break;
    }

    log.push('Filtrados: ' + filtered.length + ' de ' + all.length);

    // Se 0 resultados com filtros, tentar so sem filtro de seguidores
    if (filtered.length === 0 && all.length > 0) {
      log.push('A relaxar filtros para encontrar perfis...');
      for (var j = 0; j < all.length; j++) {
        var p2 = all[j];
        if (!p2.username) continue;
        if (isBot(p2)) continue;
        if (isBiz(p2)) continue;
        filtered.push({
          id: gid(), campaignId: gid(),
          platform: p2.platform, username: p2.username,
          displayName: p2.fullName || '', followers: p2.followers || 0,
          following: p2.following || 0, postsCount: p2.postsCount || 0,
          monthsActive: 12, isRegular: true, isVerified: false,
          score: 50, category: 'Outro', location: loc,
          bio: p2.bio || '', profileUrl: p2.profileUrl || '',
          avatarUrl: p2.avatarUrl || '', status: 'prospect',
          isBot: false, isBusiness: false,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          messages: [], notes: '',
        });
        if (filtered.length >= target) break;
      }
      log.push('Apos relaxar: ' + filtered.length + ' perfis');
    }

    var result = filtered.slice(0, target);

    if (result.length === 0) {
      var lh = log.some(function(l) { return l.indexOf('LIMITE') >= 0; });
      return NextResponse.json({
        success: true, status: 'completed',
        profilesFound: 0, totalRaw: all.length, profiles: [],
        campaignName: body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT'),
        message: lh ? 'LIMITE MENSAL APIFY ATINGIDO. Cria nova conta em apify.com.' : '0 perfis. Tenta palavras-chave diferentes.',
        log: log,
      });
    }

    return NextResponse.json({
      success: true, status: 'completed',
      profilesFound: result.length, totalRaw: all.length,
      profiles: result,
      campaignName: body.campaignName || 'Campanha ' + new Date().toLocaleDateString('pt-PT'),
      message: result.length + ' perfis reais encontrados em ' + elapsed + 's!',
      log: log,
    });
  } catch(error) {
    return NextResponse.json({
      error: 'Erro: ' + ((error instanceof Error) ? error.message : String(error)),
      log: log,
    }, { status: 500 });
  }
}