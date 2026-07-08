import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  Usa DM Service (Render) com Puppeteer COMPLETO
//  Fallback: Browserless (limitado)
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var DM_SERVICE_URL = process.env.DM_SERVICE_URL || '';
var DM_SERVICE_KEY = process.env.DM_SERVICE_KEY || 'mba-brain-dm-2024';

/* ===== DM SERVICE CLIENT ===== */
async function callDMService(endpoint: string, body: any, timeoutMs: number = 120000): Promise<any> {
  if (!DM_SERVICE_URL) return { success: false, error: 'DM_SERVICE_URL nao configurada' };

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var response = await fetch(DM_SERVICE_URL + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': DM_SERVICE_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    return await response.json();
  } catch (e: any) {
    clearTimeout(timer);
    return { success: false, error: 'DM service indisponivel: ' + (e.message || 'timeout').substring(0, 80) };
  }
}

async function checkDMService(): Promise<boolean> {
  if (!DM_SERVICE_URL) return false;
  try {
    var res = await fetch(DM_SERVICE_URL + '/api/status', {
      headers: { 'x-api-key': DM_SERVICE_KEY },
      signal: AbortSignal.timeout(15000)
    });
    return res.ok;
  } catch (e) { return false; }
}

/* ===== LOGIN VIA DM SERVICE ===== */
async function loginViaService(platform: string): Promise<any> {
  return await callDMService('/api/login/' + platform, {}, 60000);
}

/* ===== SEND DM VIA DM SERVICE ===== */
async function sendViaService(platform: string, username: string, message: string, sentToday: number): Promise<any> {
  // Tentar enviar DM
  var result = await callDMService('/api/dm/' + platform, { username: username, message: message }, 90000);

  // Se nao esta logado, fazer login e tentar de novo
  if (result.needLogin) {
    console.log('[DM] Nao logado em ' + platform + ', a fazer login...');
    var loginResult = await loginViaService(platform);
    console.log('[DM] Login ' + platform + ':', loginResult.success ? 'OK' : loginResult.error);

    if (loginResult.success) {
      // Tentar novamente apos login
      result = await callDMService('/api/dm/' + platform, { username: username, message: message }, 90000);
    } else {
      return {
        success: false,
        dmSent: false,
        deliveryMsg: platform.toUpperCase().substring(0, 2) + ': Login falhou - ' + (loginResult.error || 'erro desconhecido'),
        remainingToday: MAX_PER_DAY - sentToday,
        needLogin: true,
        loginError: loginResult.error
      };
    }
  }

  if (result.success) {
    return {
      success: true,
      dmSent: true,
      deliveryMsg: result.message || 'DM enviado via ' + platform,
      remainingToday: MAX_PER_DAY - sentToday - 1
    };
  }

  return {
    success: false,
    dmSent: false,
    deliveryMsg: (platform === 'instagram' ? 'IG' : platform === 'facebook' ? 'FB' : 'TT') + ': ' + (result.error || 'Falhou'),
    remainingToday: MAX_PER_DAY - sentToday
  };
}

/* ===== POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  // Diagnostico
  if (body.action === 'diagnostic') {
    var dmOnline = await checkDMService();
    var dmStatus: any = { online: dmOnline };
    if (dmOnline) {
      try {
        var statusRes = await fetch(DM_SERVICE_URL + '/api/status', {
          headers: { 'x-api-key': DM_SERVICE_KEY },
          signal: AbortSignal.timeout(10000)
        });
        if (statusRes.ok) dmStatus.details = await statusRes.json();
      } catch(e) {}
    }
    return NextResponse.json({
      dmService: dmStatus,
      dmServiceUrl: DM_SERVICE_URL ? DM_SERVICE_URL.replace(/\/$/, '') + '' : 'NAO CONFIGURADA',
      maxPerDay: MAX_PER_DAY,
      note: DM_SERVICE_URL ? 'Usando DM Service (Puppeteer completo)' : 'DM_SERVICE_URL nao configurada. Configura no Vercel.'
    });
  }

  // Login
  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    return NextResponse.json(await loginViaService(platform));
  }

  // Login em todas as plataformas
  if (body.action === 'login-all') {
    var results: any = {};
    for (var p of ['instagram', 'facebook', 'tiktok']) {
      results[p] = await loginViaService(p);
    }
    return NextResponse.json(results);
  }

  // Enviar DM
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;

  if (!dmUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  if (sentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido', remainingToday: 0 });
  if (!dmMessage) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Mensagem nao fornecida', remainingToday: MAX_PER_DAY - sentToday });

  // Verificar se DM Service esta disponivel
  if (!DM_SERVICE_URL) {
    return NextResponse.json({
      success: false,
      dmSent: false,
      deliveryMsg: 'DM_SERVICE_URL nao configurada. Adiciona no Vercel: Settings > Environment Variables > DM_SERVICE_URL=https://teu-servico.onrender.com',
      remainingToday: MAX_PER_DAY - sentToday,
      needSetup: true
    });
  }

  var result = await sendViaService(dmPlatform, dmUsername, dmMessage, sentToday);
  return NextResponse.json(result);
}

/* ===== GET ===== */
export async function GET() {
  var dmOnline = await checkDMService();
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    dmService: {
      online: dmOnline,
      url: DM_SERVICE_URL || 'NAO CONFIGURADA'
    }
  });
}