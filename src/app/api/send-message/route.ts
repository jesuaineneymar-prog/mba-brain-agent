import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  METODO GRATIS: HTTP API com cookies (IG + FB)
//  Sem browser, sem servidor externo, sem custos
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

// ============================================================
//  INSTAGRAM DM VIA HTTP API (GRATIS, SEM BROWSER)
//  Usa sessionid + csrftoken cookies para enviar DMs directo
// ============================================================

async function igGetUserId(sessionid: string, csrftoken: string, username: string): Promise<string | null> {
  try {
    var res = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
      headers: {
        'cookie': 'sessionid=' + sessionid + '; csrftoken=' + csrftoken,
        'x-csrftoken': csrftoken,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    var data = await res.json();
    return data.data?.user?.pk || data.data?.user?.id || null;
  } catch (e) { return null; }
}

async function igSendDM(sessionid: string, csrftoken: string, recipientId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Criar thread de DM
    var threadRes = await fetch('https://www.instagram.com/api/v1/direct_v2/create_thread/', {
      method: 'POST',
      headers: {
        'cookie': 'sessionid=' + sessionid + '; csrftoken=' + csrftoken,
        'x-csrftoken': csrftoken,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459',
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'recipient_users=' + JSON.stringify([recipientId]) + '&client_context=' + Date.now() + '&device_id=' + crypto.randomUUID?.() || (Math.random().toString(36) + Date.now().toString(36)),
      signal: AbortSignal.timeout(15000)
    });

    var threadData = await threadRes.json();
    var threadId = threadData.thread_id || threadData.thread?.thread_id;

    // Se o thread já existe (409 ou sem thread_id), tentar buscar
    if (!threadId) {
      var inboxRes = await fetch('https://www.instagram.com/api/v1/direct_v2/inbox/?user_id=' + recipientId, {
        headers: {
          'cookie': 'sessionid=' + sessionid + '; csrftoken=' + csrftoken,
          'x-csrftoken': csrftoken,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'x-ig-app-id': '936619743392459'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (inboxRes.ok) {
        var inboxData = await inboxRes.json();
        if (inboxData.inbox && inboxData.inbox.threads) {
          for (var t of inboxData.inbox.threads) {
            if (t.users && t.users.length > 0 && String(t.users[0].pk) === String(recipientId)) {
              threadId = t.thread_id;
              break;
            }
          }
        }
      }
    }

    if (!threadId) {
      return { success: false, error: 'Nao conseguiu criar/encontrar thread de DM' };
    }

    // Enviar mensagem no thread
    var msgRes = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/' + threadId + '/items/', {
      method: 'POST',
      headers: {
        'cookie': 'sessionid=' + sessionid + '; csrftoken=' + csrftoken,
        'x-csrftoken': csrftoken,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459',
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'text=' + encodeURIComponent(message) + '&client_context=' + Date.now() + '&device_id=' + (crypto.randomUUID?.() || (Math.random().toString(36) + Date.now().toString(36))),
      signal: AbortSignal.timeout(15000)
    });

    if (msgRes.ok) {
      return { success: true };
    } else {
      var errText = '';
      try { errText = await msgRes.text(); } catch(e) {}
      return { success: false, error: 'Erro ao enviar mensagem (HTTP ' + msgRes.status + ')' };
    }
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

async function igValidateCookies(sessionid: string, csrftoken: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    var res = await fetch('https://www.instagram.com/api/v1/accounts/current_user/?fields=username', {
      headers: {
        'cookie': 'sessionid=' + sessionid + '; csrftoken=' + csrftoken,
        'x-csrftoken': csrftoken,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-ig-app-id': '936619743392459'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      var data = await res.json();
      return { valid: true, username: data.user?.username || data.username || 'OK' };
    }
    if (res.status === 401 || res.status === 403) return { valid: false, error: 'Cookies expirados. Copia novamente do browser.' };
    return { valid: false, error: 'Erro HTTP ' + res.status };
  } catch (e: any) {
    return { valid: false, error: e.message || 'Erro de conexao' };
  }
}

async function sendIGViaCookies(username: string, message: string, sentToday: number): Promise<any> {
  // Ler cookies do body (enviados pelo frontend)
  // Na pratica vêm do localStorage
  return { success: false, dmSent: false, deliveryMsg: 'IG: Usa o painel para colar cookies primeiro', remainingToday: MAX_PER_DAY - sentToday, needCookies: true };
}

// ============================================================
//  FACEBOOK DM VIA HTTP API (GRATIS, SEM BROWSER)
//  Usa fb_dtsg + cookie para enviar mensagem
// ============================================================

async function fbValidateCookies(fbCookie: string, fbDtsg: string): Promise<{ valid: boolean; username?: string; error?: string }> {
  try {
    var res = await fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: {
        'cookie': fbCookie,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: 'fb_dtsg=' + encodeURIComponent(fbDtsg) + '&doc_id=4364992440242396&variables=%7B%22scale%22%3A3%7D',
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      var data = await res.json();
      if (data.data && !data.error) return { valid: true, username: 'OK' };
      return { valid: false, error: 'Resposta invalida do Facebook' };
    }
    return { valid: false, error: 'Cookies expirados ou invalidos (HTTP ' + res.status + ')' };
  } catch (e: any) {
    return { valid: false, error: e.message || 'Erro de conexao' };
  }
}

async function fbGetUserId(fbCookie: string, fbDtsg: string, username: string): Promise<string | null> {
  try {
    // Buscar user ID do FB pelo username
    var res = await fetch('https://www.facebook.com/' + encodeURIComponent(username), {
      headers: {
        'cookie': fbCookie,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(10000),
      redirect: 'manual'
    });
    // O FB redireciona para /profile.php?id=XXXXX
    var location = res.headers.get('location') || '';
    var idMatch = location.match(/id=(\d+)/);
    if (idMatch) return idMatch[1];

    // Tentar buscar na pagina
    var text = await res.text();
    var entityMatch = text.match(/"entity_id"\s*:\s*"(\d+)"/);
    if (entityMatch) return entityMatch[1];

    return null;
  } catch (e) { return null; }
}

async function fbSendDM(fbCookie: string, fbDtsg: string, recipientId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    var res = await fetch('https://www.facebook.com/messaging/send/', {
      method: 'POST',
      headers: {
        'cookie': fbCookie,
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'origin': 'https://www.facebook.com',
        'referer': 'https://www.facebook.com/messages/t/' + recipientId
      },
      body: 'fb_dtsg=' + encodeURIComponent(fbDtsg) +
        '&body=' + encodeURIComponent(message) +
        '&ids%5B' + recipientId + '%5D=' + recipientId +
        '&action=send',
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      var data = await res.json();
      if (!data.error) return { success: true };
      return { success: false, error: data.error || 'Erro no envio' };
    }
    return { success: false, error: 'HTTP ' + res.status };
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

// ============================================================
//  COOKIE STORE (in-memory, por sessao de Vercel)
//  O frontend envia os cookies em cada pedido DM
// ============================================================

// ============================================================
//  POST HANDLER
// ============================================================

export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  // ---- Validar cookies IG ----
  if (body.action === 'validate-cookies' && body.platform === 'instagram') {
    if (!body.sessionid || !body.csrftoken) {
      return NextResponse.json({ success: false, error: 'Falta sessionid ou csrftoken' });
    }
    var v = await igValidateCookies(body.sessionid, body.csrftoken);
    if (v.valid) {
      return NextResponse.json({ success: true, message: 'IG cookies validas! (@' + (v.username || '') + ')', username: v.username });
    }
    return NextResponse.json({ success: false, error: v.error || 'Cookies invalidas' });
  }

  // ---- Validar cookies FB ----
  if (body.action === 'validate-cookies' && body.platform === 'facebook') {
    if (!body.fbCookie || !body.fbDtsg) {
      return NextResponse.json({ success: false, error: 'Falta cookie ou fb_dtsg' });
    }
    var fv = await fbValidateCookies(body.fbCookie, body.fbDtsg);
    if (fv.valid) {
      return NextResponse.json({ success: true, message: 'FB cookies validas!' });
    }
    return NextResponse.json({ success: false, error: fv.error || 'Cookies invalidas' });
  }

  // ---- Enviar DM Instagram via HTTP API (GRATIS) ----
  if (body.platform === 'instagram' && body.igSessionid && body.igCsrf) {
    var igUsername = body.username || '';
    var igMessage = body.message || '';
    var sentToday = body.sentToday || 0;

    if (!igUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'IG: Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
    if (sentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'IG: Limite diario atingido', remainingToday: 0 });

    // Passo 1: Buscar ID do utilizador
    var userId = await igGetUserId(body.igSessionid, body.igCsrf, igUsername);
    if (!userId) {
      return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'IG: Nao encontrou @' + igUsername + ' (cookies expiradas?)', remainingToday: MAX_PER_DAY - sentToday });
    }

    // Passo 2: Enviar DM
    var dmResult = await igSendDM(body.igSessionid, body.igCsrf, String(userId), igMessage);
    if (dmResult.success) {
      return NextResponse.json({ success: true, dmSent: true, deliveryMsg: 'IG: DM enviado para @' + igUsername, remainingToday: MAX_PER_DAY - sentToday - 1 });
    }
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'IG: ' + (dmResult.error || 'Falhou'), remainingToday: MAX_PER_DAY - sentToday });
  }

  // ---- Enviar DM Facebook via HTTP API (GRATIS) ----
  if (body.platform === 'facebook' && body.fbCookie && body.fbDtsg) {
    var fbUsername = body.username || '';
    var fbMessage = body.message || '';
    var fbSentToday = body.sentToday || 0;

    if (!fbUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'FB: Username nao fornecido', remainingToday: MAX_PER_DAY - fbSentToday });
    if (fbSentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'FB: Limite diario atingido', remainingToday: 0 });

    // Passo 1: Buscar ID do utilizador
    var fbUserId = await fbGetUserId(body.fbCookie, body.fbDtsg, fbUsername);
    if (!fbUserId) {
      return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'FB: Nao encontrou perfil de ' + fbUsername, remainingToday: MAX_PER_DAY - fbSentToday });
    }

    // Passo 2: Enviar DM
    var fbDmResult = await fbSendDM(body.fbCookie, body.fbDtsg, String(fbUserId), fbMessage);
    if (fbDmResult.success) {
      return NextResponse.json({ success: true, dmSent: true, deliveryMsg: 'FB: DM enviado para ' + fbUsername, remainingToday: MAX_PER_DAY - fbSentToday - 1 });
    }
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'FB: ' + (fbDmResult.error || 'Falhou'), remainingToday: MAX_PER_DAY - fbSentToday });
  }

  // ---- Diagnostico ----
  if (body.action === 'diagnostic') {
    return NextResponse.json({
      method: 'HTTP API com cookies (GRATIS, sem browser)',
      ig: { ready: !!(body.igSessionid && body.igCsrf), note: body.igSessionid ? 'Cookies configuradas' : 'Cola sessionid + csrftoken no painel' },
      fb: { ready: !!(body.fbCookie && body.fbDtsg), note: body.fbCookie ? 'Cookies configuradas' : 'Cola cookie + fb_dtsg no painel' },
      tt: { ready: false, note: 'TikTok precisa de browser (n8n ou VPS)' },
      maxPerDay: MAX_PER_DAY,
      note: 'DMs via HTTP directa — 100% gratis, sem servidor externo'
    });
  }

  // ---- Login (cookies method — nao precisa) ----
  if (body.action === 'login' || body.action === 'login-all') {
    return NextResponse.json({ success: true, message: 'Com cookies, nao precisa de login. Cola os cookies no painel de Mensagens.' });
  }

  // ---- Fallback: sem cookies ----
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday2 = body.sentToday || 0;

  if (!dmUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday2 });
  if (!dmMessage) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Mensagem nao fornecida', remainingToday: MAX_PER_DAY - sentToday2 });

  var platName = dmPlatform === 'instagram' ? 'IG' : dmPlatform === 'facebook' ? 'FB' : 'TT';
  var cookieHint = dmPlatform === 'instagram'
    ? 'Falta cookies IG. Cola sessionid + csrftoken no painel.'
    : dmPlatform === 'facebook'
    ? 'Falta cookies FB. Cola cookie + fb_dtsg no painel.'
    : 'TikTok precisa de browser (n8n). Ve n8n/SETUP.md';

  return NextResponse.json({
    success: false,
    dmSent: false,
    deliveryMsg: platName + ': ' + cookieHint,
    remainingToday: MAX_PER_DAY - sentToday2,
    needCookies: true
  });
}

/* ===== GET ===== */
export async function GET() {
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    method: 'http-cookies',
    note: 'DMs via HTTP API com cookies — 100% gratis'
  });
}