import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API v4
//  TODAS as plataformas via cookies de sessao
//  Sem login directo (bloqueado por IPs de datacenter)
//  Sem dependencia do n8n
// ============================================================

export var maxDuration = 300;
var MAX_PER_DAY = 30;

const DEFAULT_MESSAGE = `Ola,
O meu nome e Jesuaine Cristiano e represento a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.
Tenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisicao da sua conta.
Estamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.
Aguardamos o seu contacto.
Cumprimentos,
Equipa Mwango Brain
mwangobrain.com`;

// Credenciais em memória
var storedCredentials: Record<string, any> = {
  instagram: { sessionid: '', csrftoken: '', ds_user_id: '' },
  facebook: { cookie: '', dtsg: '', c_user: '' },
  tiktok: { sessionid: '', csrf: '' },
};

// Contagem diária
var dailyCount: Record<string, number> = {};
function getToday() { return new Date().toISOString().split('T')[0]; }
function getSentToday(platform: string) { return dailyCount[platform + '_' + getToday()] || 0; }
function recordSend(platform: string) { var key = platform + '_' + getToday(); dailyCount[key] = (dailyCount[key] || 0) + 1; }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
//  INSTAGRAM DM VIA COOKIES
// ============================================================

async function sendInstagramDM(username: string, message: string, creds: any): Promise<any> {
  var sessionid = creds?.sessionid || storedCredentials.instagram.sessionid;
  var csrftoken = creds?.csrftoken || storedCredentials.instagram.csrftoken;
  var ds_user_id = creds?.ds_user_id || storedCredentials.instagram.ds_user_id;

  if (!sessionid || !csrftoken) {
    return { success: false, error: 'Instagram: sessionid e csrftoken obrigatorios. Configura em /setup-cookies ou envia com credentials.' };
  }

  var cookieStr = `sessionid=${sessionid}; csrftoken=${csrftoken}; ds_user_id=${ds_user_id || ''}; ig_did=1;`;
  var baseHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459',
    'X-CSRFToken': csrftoken,
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.instagram.com/',
    'Cookie': cookieStr,
  };

  // 1. Validar sessao e obter user ID do destinatario
  var profileResp = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    headers: baseHeaders,
    signal: AbortSignal.timeout(15000),
  });

  if (profileResp.status === 403) {
    return { success: false, error: 'Instagram: sessao expirada (403). Actualiza os cookies.' };
  }
  if (profileResp.status === 429) {
    return { success: false, error: 'Instagram: rate limit (429). Espera antes de tentar novamente.' };
  }
  if (!profileResp.ok) {
    return { success: false, error: `Instagram: erro ao buscar perfil ${username} (HTTP ${profileResp.status})` };
  }

  var profileData = await profileResp.json();
  var targetUserId = profileData?.data?.user?.id || profileData?.data?.user?.pk;

  if (!targetUserId) {
    return { success: false, error: `Instagram: utilizador @${username} nao encontrado.` };
  }

  // 2. Enviar DM - tentar broadcast primeiro
  var clientContext = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  var dmPayload = new URLSearchParams({
    'recipient_users': `[[${targetUserId}]]`,
    'text': message,
    'action': 'send',
    'client_context': clientContext,
  });

  var dmResp = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: dmPayload.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (dmResp.ok) {
    var dmData = await dmResp.json().catch(() => ({}));
    if (!dmData.spam && !dmData.error_type) {
      return { success: true, userId: targetUserId, threadId: dmData?.thread_id };
    }
  }

  // 3. Fallback: criar thread e enviar
  var createPayload = new URLSearchParams({
    'recipient_users': `[${targetUserId}]`,
    'text': message,
    'client_context': clientContext,
  });

  var createResp = await fetch('https://www.instagram.com/api/v1/direct_v2/web/create_thread/', {
    method: 'POST',
    headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createPayload.toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (createResp.ok) {
    var createData = await createResp.json().catch(() => ({}));
    if (!createData.spam) {
      return { success: true, userId: targetUserId, threadId: createData?.thread_id };
    }
  }

  return { success: false, error: 'Instagram: DM nao enviado. Verifica cookies e tenta novamente.' };
}

// ============================================================
//  FACEBOOK DM VIA COOKIES
// ============================================================

async function sendFacebookDM(username: string, message: string, creds: any): Promise<any> {
  var fbCookie = creds?.cookie || storedCredentials.facebook.cookie;
  var fbDtsg = creds?.dtsg || storedCredentials.facebook.dtsg;
  var cUser = creds?.c_user || storedCredentials.facebook.c_user;

  if (!fbCookie) {
    return { success: false, error: 'Facebook: cookie obrigatoria. Configura em /setup-cookies ou envia com credentials.' };
  }

  var baseHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cookie': fbCookie,
    'Referer': 'https://www.facebook.com/',
    'Origin': 'https://www.facebook.com',
  };

  // 1. Validar sessao - buscar a home page para obter fb_dtsg se necessario
  if (!fbDtsg || !cUser) {
    try {
      var homeResp = await fetch('https://www.facebook.com/', {
        headers: { ...baseHeaders, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(15000),
      });
      var homeHtml = await homeResp.text();

      // Extrair c_user do cookie
      var cUserMatch = fbCookie.match(/c_user=(\d+)/);
      if (cUserMatch) cUser = cUserMatch[1];
      if (!cUser) {
        var cUserBody = homeHtml.match(/"c_user":"(\d+)"/);
        if (cUserBody) cUser = cUserBody[1];
      }

      // Extrair fb_dtsg
      var dtsgMatch = homeHtml.match(/DTSGInitData".*?"token":"([^"]+)"/)
        || homeHtml.match(/"dtsg"\s*:\s*\{[^}]*"token"\s*:\s*"([^"]+)"/);
      if (dtsgMatch) fbDtsg = dtsgMatch[1];
    } catch(e) {
      // Continue with what we have
    }
  }

  if (!cUser) {
    return { success: false, error: 'Facebook: nao encontrou c_user. Verifica se o cookie inclui c_user.' };
  }
  if (!fbDtsg) {
    return { success: false, error: 'Facebook: nao conseguiu obter fb_dtsg. Tenta com cookie mais completa.' };
  }

  // 2. Encontrar ID do destinatario (procurar no Facebook)
  var recipientId: string | null = null;

  // Tentar buscar o perfil
  try {
    var profileResp = await fetch(`https://www.facebook.com/${encodeURIComponent(username)}`, {
      headers: { ...baseHeaders, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    var profileHtml = await profileResp.text();

    var idPatterns = [
      /"userID":"(\d+)"/,
      /entity_id=(\d+)/,
      /"actor_id":"(\d+)"/,
      /"profile_id":"(\d+)"/,
      /page_id=(\d+)/,
      /"uid":"(\d+)"/,
    ];
    for (var pat of idPatterns) {
      var m = profileHtml.match(pat);
      if (m) { recipientId = m[1]; break; }
    }
  } catch(e) {}

  if (!recipientId) {
    // Tentar via busca
    try {
      var searchResp = await fetch(`https://www.facebook.com/ajax/typeahead/search.php?q=${encodeURIComponent(username)}&viewer=${cUser}`, {
        headers: { ...baseHeaders, 'X-FB-LSD': fbDtsg },
        signal: AbortSignal.timeout(15000),
      });
      var searchData = await searchResp.json().catch(() => ({}));
      var entry = searchData?.payload?.entries?.[0];
      if (entry?.uid) recipientId = String(entry.uid);
    } catch(e) {}
  }

  if (!recipientId) {
    return { success: false, error: `Facebook: nao encontrou o perfil "${username}". Tenta com o link completo ou ID numerico.` };
  }

  // 3. Enviar DM
  var variables = JSON.stringify({
    message: { text: message, ranges: [] },
    client: { cache_key: String(Date.now()) },
    recipient_id: recipientId,
    actor_id: cUser,
  });

  var dmBody = new URLSearchParams({
    'fb_dtsg': fbDtsg,
    'doc_id': '5636333709730986',
    'variables': variables,
  }).toString();

  try {
    var dmResp = await fetch('https://www.facebook.com/messaging/send/', {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'X-FB-LSD': fbDtsg, 'X-Requested-With': 'XMLHttpRequest' },
      body: dmBody,
      signal: AbortSignal.timeout(15000),
    });

    var dmData = await dmResp.json().catch(() => ({}));

    if (dmResp.ok && !dmData.error) {
      return { success: true, recipientId: recipientId };
    }

    return { success: false, error: `Facebook DM falhou: ${dmData.error?.message || JSON.stringify(dmData).substring(0, 200)}` };
  } catch(e: any) {
    return { success: false, error: 'Facebook DM erro: ' + e.message };
  }
}

// ============================================================
//  TIKTOK DM VIA COOKIES
// ============================================================

async function sendTikTokDM(username: string, message: string, creds: any): Promise<any> {
  var ttSessionid = creds?.sessionid || storedCredentials.tiktok.sessionid;
  var ttCsrf = creds?.csrf || storedCredentials.tiktok.csrf;

  if (!ttSessionid) {
    return { success: false, error: 'TikTok: sessionid obrigatoria. Configura em /setup-cookies ou envia com credentials.' };
  }

  var baseHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Cookie': `sessionid=${ttSessionid}${ttCsrf ? '; csrf_session_token=' + ttCsrf : ''};`,
    'Referer': 'https://www.tiktok.com/',
    'Origin': 'https://www.tiktok.com',
  };

  if (ttCsrf) baseHeaders['X-CSRF-Token'] = ttCsrf;

  // 1. Encontrar UID do destinatario
  var recipientUid: string | null = null;

  try {
    var profileResp = await fetch(`https://www.tiktok.com/@${encodeURIComponent(username)}`, {
      headers: { ...baseHeaders, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
    var profileHtml = await profileResp.text();

    var uidPatterns = [
      /"userId":"(\d+)"/,
      /"id":"(\d+)"/,
      /userId['":\s]+(\d+)/,
      /"uid":"(\d+)"/,
    ];
    for (var pat of uidPatterns) {
      var m = profileHtml.match(pat);
      if (m) { recipientUid = m[1]; break; }
    }
  } catch(e) {}

  if (!recipientUid) {
    // Tentar via API
    try {
      var apiResp = await fetch(`https://www.tiktok.com/api/user/detail/?uniqueId=${encodeURIComponent(username)}`, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(15000),
      });
      var apiData = await apiResp.json().catch(() => ({}));
      if (apiData.userInfo?.user?.id) {
        recipientUid = String(apiData.userInfo.user.id);
      }
    } catch(e) {}
  }

  if (!recipientUid) {
    return { success: false, error: `TikTok: nao encontrou o perfil @${username}.` };
  }

  // 2. Enviar DM
  try {
    // Tentar endpoint create
    var dmBody = new URLSearchParams({
      'recipient_user_id': recipientUid,
      'text': message,
      'type': 'text',
    }).toString();

    var dmResp = await fetch('https://www.tiktok.com/api/chat/create/', {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: dmBody,
      signal: AbortSignal.timeout(15000),
    });

    var dmData = await dmResp.json().catch(() => ({}));

    if (dmResp.ok && dmData.status_code === 0) {
      return { success: true, recipientUid: recipientUid };
    }

    // Tentar endpoint alternativo com JSON
    var dmResp2 = await fetch('https://www.tiktok.com/api/chat/create/', {
      method: 'POST',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_user_id: recipientUid, text: message, type: 'text' }),
      signal: AbortSignal.timeout(15000),
    });

    var dmData2 = await dmResp2.json().catch(() => ({}));

    if (dmResp2.ok && dmData2.status_code === 0) {
      return { success: true, recipientUid: recipientUid };
    }

    return { success: false, error: `TikTok DM falhou: ${JSON.stringify(dmData2).substring(0, 200)}` };
  } catch(e: any) {
    return { success: false, error: 'TikTok DM erro: ' + e.message };
  }
}

// ============================================================
//  N8N FALLBACK (se disponivel)
// ============================================================

async function sendViaN8N(platform: string, username: string, message: string): Promise<any> {
  var N8N_BASE = process.env.N8N_WEBHOOK_URL || 'https://n8n-production-2236.up.railway.app';
  var paths: Record<string, string> = {
    instagram: '/webhook/ig-send-dm',
    facebook: '/webhook/fb-send-dm',
    tiktok: '/webhook/tt-send-dm',
  };
  var path = paths[platform];
  if (!path) return { success: false, error: 'Plataforma nao suportada' };

  try {
    var res = await fetch(N8N_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { username, message } }),
      signal: AbortSignal.timeout(60000),
    });
    return await res.json();
  } catch(e: any) {
    return { success: false, error: 'n8n timeout: ' + e.message };
  }
}

// ============================================================
//  POST HANDLER
// ============================================================

export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  var platform = (body.platform || '').toLowerCase().trim();
  var username = body.username || '';
  var message = body.message || DEFAULT_MESSAGE;
  var credentials = body.credentials || null;
  var useN8n = body.useN8n || false;

  if (!platform || !username) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Plataforma e username sao obrigatorios', remainingToday: MAX_PER_DAY });
  }

  // Guardar credenciais se enviadas
  if (credentials) {
    if (credentials.instagram) Object.assign(storedCredentials.instagram, credentials.instagram);
    if (credentials.facebook) Object.assign(storedCredentials.facebook, credentials.facebook);
    if (credentials.tiktok) Object.assign(storedCredentials.tiktok, credentials.tiktok);
  }

  // Diagnostic
  if (body.action === 'diagnostic') {
    return NextResponse.json({
      method: useN8n ? 'n8n webhooks' : 'cookies directo (v4)',
      platforms: ['instagram', 'facebook', 'tiktok'],
      igConfigured: !!storedCredentials.instagram.sessionid,
      fbConfigured: !!storedCredentials.facebook.cookie,
      ttConfigured: !!storedCredentials.tiktok.sessionid,
      n8nAvailable: !!process.env.N8N_WEBHOOK_URL,
      maxPerDay: MAX_PER_DAY,
    });
  }

  // Validate cookies
  if (body.action === 'validate-cookies') {
    if (platform === 'instagram') {
      var c = credentials?.instagram || storedCredentials.instagram;
      if (!c.sessionid || !c.csrftoken) {
        return NextResponse.json({ success: false, message: 'Instagram: sessionid e csrftoken obrigatorios' });
      }
      try {
        var testResp = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=jesuainecristiano78', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': `sessionid=${c.sessionid}; csrftoken=${c.csrftoken}; ds_user_id=${c.ds_user_id || ''};`,
            'X-IG-App-ID': '936619743392459',
            'X-CSRFToken': c.csrftoken,
          },
          signal: AbortSignal.timeout(10000),
        });
        if (testResp.ok) {
          var td = await testResp.json();
          return NextResponse.json({ success: true, message: `Instagram cookies validos! @${td?.data?.user?.username} (${td?.data?.user?.id})` });
        }
        return NextResponse.json({ success: false, message: `Instagram cookies invalidos (HTTP ${testResp.status}). Obtem cookies novos.` });
      } catch (e: any) {
        return NextResponse.json({ success: false, message: 'Erro: ' + e.message });
      }
    }
    return NextResponse.json({ success: true, message: `${platform}: configurado` });
  }

  // Rate limit
  var sentToday = getSentToday(platform);
  if (sentToday >= MAX_PER_DAY) {
    var plat = platform === 'instagram' ? 'IG' : platform === 'facebook' ? 'FB' : 'TT';
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: `${plat}: Limite diario atingido (${MAX_PER_DAY})`, remainingToday: 0 });
  }

  // Escolher metodo: n8n ou directo
  var result: any;
  var startTime = Date.now();
  var platLabel = platform === 'instagram' ? 'IG' : platform === 'facebook' ? 'FB' : 'TT';

  try {
    if (useN8n) {
      result = await sendViaN8N(platform, username, message);
    } else {
      switch (platform) {
        case 'instagram':
          result = await sendInstagramDM(username, message, credentials?.instagram);
          break;
        case 'facebook':
          result = await sendFacebookDM(username, message, credentials?.facebook);
          break;
        case 'tiktok':
          result = await sendTikTokDM(username, message, credentials?.tiktok);
          break;
        default:
          return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Plataforma nao suportada: ' + platform, remainingToday: MAX_PER_DAY - sentToday });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: `${platLabel}: ${e.message || 'erro'}`, remainingToday: MAX_PER_DAY - sentToday });
  }

  var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.success) {
    recordSend(platform);
    return NextResponse.json({
      success: true, dmSent: true,
      deliveryMsg: `${platLabel}: DM enviado para ${platform === 'instagram' ? '@' : ''}${username} (${elapsed}s)`,
      remainingToday: MAX_PER_DAY - getSentToday(platform),
      details: result,
    });
  } else {
    return NextResponse.json({
      success: false, dmSent: false,
      deliveryMsg: `${platLabel}: ${result.error || 'Falhou'} (${elapsed}s)`,
      remainingToday: MAX_PER_DAY - sentToday,
      error: result.error,
    });
  }
}

// PUT - actualizar credenciais armazenadas
export async function PUT(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  if (body.instagram) Object.assign(storedCredentials.instagram, body.instagram);
  if (body.facebook) Object.assign(storedCredentials.facebook, body.facebook);
  if (body.tiktok) Object.assign(storedCredentials.tiktok, body.tiktok);

  return NextResponse.json({
    success: true,
    message: 'Credenciais actualizadas',
    status: {
      instagram: { sessionid: storedCredentials.instagram.sessionid ? 'OK' : 'vazio', csrftoken: storedCredentials.instagram.csrftoken ? 'OK' : 'vazio' },
      facebook: { cookie: storedCredentials.facebook.cookie ? 'OK' : 'vazio' },
      tiktok: { sessionid: storedCredentials.tiktok.sessionid ? 'OK' : 'vazio' },
    },
  });
}

// GET - info
export async function GET() {
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: {
      instagram: MAX_PER_DAY - getSentToday('instagram'),
      facebook: MAX_PER_DAY - getSentToday('facebook'),
      tiktok: MAX_PER_DAY - getSentToday('tiktok'),
    },
    method: 'cookies directo (v4)',
    platforms: ['instagram', 'facebook', 'tiktok'],
    igConfigured: !!storedCredentials.instagram.sessionid,
    fbConfigured: !!storedCredentials.facebook.cookie,
    ttConfigured: !!storedCredentials.tiktok.sessionid,
    note: 'Todas as plataformas usam cookies de sessao. Configura em /setup-cookies.',
    defaultMessage: DEFAULT_MESSAGE,
  });
}