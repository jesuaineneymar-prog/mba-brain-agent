import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  Metodo principal: n8n Webhook (Puppeteer REAL)
//  Fallback: DM Service (Render) se n8n nao configurado
//  IG Direct: via HTTP API com cookies (sem browser)
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
var N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'mba-brain-n8n-2024';
var DM_SERVICE_URL = process.env.DM_SERVICE_URL || '';
var DM_SERVICE_KEY = process.env.DM_SERVICE_KEY || 'mba-brain-dm-2024';

/* ===== n8n WEBHOOK CLIENT ===== */
async function sendViaN8N(platform: string, username: string, message: string, sentToday: number): Promise<any> {
  if (!N8N_WEBHOOK_URL) {
    return { success: false, dmSent: false, deliveryMsg: 'N8N_WEBHOOK_URL nao configurada. Ve n8n/SETUP.md', remainingToday: MAX_PER_DAY - sentToday, needN8nSetup: true };
  }

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 30000);
  try {
    var response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: platform,
        username: username,
        message: message,
        n8nSecret: N8N_WEBHOOK_SECRET,
        callbackUrl: '',  // n8n notifica via /api/webhook
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    var data = await response.json();
    return {
      success: true,
      dmSent: true,
      deliveryMsg: 'DM enviado via n8n (' + platform.substring(0, 2).toUpperCase() + ': @' + username + ')',
      remainingToday: MAX_PER_DAY - sentToday - 1,
      n8nResponse: data
    };
  } catch (e: any) {
    clearTimeout(timer);
    return {
      success: false,
      dmSent: false,
      deliveryMsg: 'n8n indisponivel: ' + (e.message || 'timeout').substring(0, 80),
      remainingToday: MAX_PER_DAY - sentToday
    };
  }
}

/* ===== DM SERVICE CLIENT (Render fallback) ===== */
async function callDMService(endpoint: string, body: any, timeoutMs: number = 120000): Promise<any> {
  if (!DM_SERVICE_URL) return { success: false, error: 'DM_SERVICE_URL nao configurada' };

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var response = await fetch(DM_SERVICE_URL + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': DM_SERVICE_KEY },
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
    var res = await fetch(DM_SERVICE_URL + '/api/status', { headers: { 'x-api-key': DM_SERVICE_KEY }, signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch (e) { return false; }
}

async function loginViaService(platform: string): Promise<any> {
  return await callDMService('/api/login/' + platform, {}, 60000);
}

async function sendViaService(platform: string, username: string, message: string, sentToday: number): Promise<any> {
  var result = await callDMService('/api/dm/' + platform, { username: username, message: message }, 90000);

  if (result.needLogin) {
    var loginResult = await loginViaService(platform);
    if (loginResult.success) {
      result = await callDMService('/api/dm/' + platform, { username: username, message: message }, 90000);
    } else {
      return { success: false, dmSent: false, deliveryMsg: platform.toUpperCase().substring(0, 2) + ': Login falhou - ' + (loginResult.error || 'erro desconhecido'), remainingToday: MAX_PER_DAY - sentToday, needLogin: true };
    }
  }

  if (result.success) {
    return { success: true, dmSent: true, deliveryMsg: result.message || 'DM enviado via ' + platform, remainingToday: MAX_PER_DAY - sentToday - 1 };
  }
  return { success: false, dmSent: false, deliveryMsg: (platform === 'instagram' ? 'IG' : platform === 'facebook' ? 'FB' : 'TT') + ': ' + (result.error || 'Falhou'), remainingToday: MAX_PER_DAY - sentToday };
}

/* ===== BATCH SEND (para enviar varios DMs de uma vez via n8n) ===== */
async function sendBatchViaN8N(profiles: any[], message: string, sentToday: number): Promise<any> {
  if (!N8N_WEBHOOK_URL) {
    return { success: false, error: 'N8N_WEBHOOK_URL nao configurada. Ve n8n/SETUP.md', needN8nSetup: true };
  }

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 30000);
  try {
    var response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: profiles.slice(0, MAX_PER_DAY - sentToday),
        message: message,
        n8nSecret: N8N_WEBHOOK_SECRET,
        callbackUrl: '',
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    var data = await response.json();
    return {
      success: true,
      deliveryMsg: profiles.length + ' perfis enviados ao n8n para processamento',
      remainingToday: Math.max(0, MAX_PER_DAY - sentToday - profiles.length),
      n8nResponse: data
    };
  } catch (e: any) {
    clearTimeout(timer);
    return { success: false, error: 'n8n indisponivel: ' + (e.message || 'timeout').substring(0, 80) };
  }
}

/* ===== POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  // Diagnostico
  if (body.action === 'diagnostic') {
    var n8nOk = !!N8N_WEBHOOK_URL;
    var dmOnline = await checkDMService();
    var dmStatus: any = { online: dmOnline };
    if (dmOnline) {
      try {
        var statusRes = await fetch(DM_SERVICE_URL + '/api/status', { headers: { 'x-api-key': DM_SERVICE_KEY }, signal: AbortSignal.timeout(10000) });
        if (statusRes.ok) dmStatus.details = await statusRes.json();
      } catch(e) {}
    }
    return NextResponse.json({
      n8n: { configured: n8nOk, url: n8nOk ? N8N_WEBHOOK_URL.replace(/\/$/, '') : 'NAO CONFIGURADA' },
      dmService: dmStatus,
      dmServiceUrl: DM_SERVICE_URL ? DM_SERVICE_URL.replace(/\/$/, '') : 'NAO CONFIGURADA',
      maxPerDay: MAX_PER_DAY,
      method: n8nOk ? 'n8n Webhook (Puppeteer REAL)' : DM_SERVICE_URL ? 'DM Service (Render)' : 'Nenhum configurado',
      note: n8nOk ? 'Usando n8n para DMs (recomendado)' : DM_SERVICE_URL ? 'Usando DM Service. Para melhor fiabilidade, configura o n8n (ve n8n/SETUP.md)' : 'Configura o n8n em n8n/SETUP.md para enviar DMs'
    });
  }

  // Login (so faz sentido no DM Service, n8n faz login internamente)
  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    if (N8N_WEBHOOK_URL) {
      return NextResponse.json({ success: true, message: 'n8n faz login automaticamente. Nao precisa de login manual.' });
    }
    return NextResponse.json(await loginViaService(platform));
  }

  // Login em todas as plataformas
  if (body.action === 'login-all') {
    if (N8N_WEBHOOK_URL) {
      return NextResponse.json({ success: true, message: 'n8n faz login automaticamente em todas as plataformas.' });
    }
    var results: any = {};
    for (var p of ['instagram', 'facebook', 'tiktok']) {
      results[p] = await loginViaService(p);
    }
    return NextResponse.json(results);
  }

  // Batch send via n8n
  if (body.action === 'batch') {
    var profiles = body.profiles || [];
    var batchMsg = body.message || '';
    var batchSent = body.sentToday || 0;
    if (!N8N_WEBHOOK_URL) {
      return NextResponse.json({ success: false, error: 'Batch so disponivel via n8n. Configura N8N_WEBHOOK_URL.', needN8nSetup: true });
    }
    return NextResponse.json(await sendBatchViaN8N(profiles, batchMsg, batchSent));
  }

  // Enviar DM single
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;

  if (!dmUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  if (sentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido', remainingToday: 0 });
  if (!dmMessage) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Mensagem nao fornecida', remainingToday: MAX_PER_DAY - sentToday });

  // Prioridade 1: n8n Webhook (Puppeteer REAL)
  if (N8N_WEBHOOK_URL) {
    return NextResponse.json(await sendViaN8N(dmPlatform, dmUsername, dmMessage, sentToday));
  }

  // Prioridade 2: DM Service (Render)
  if (DM_SERVICE_URL) {
    return NextResponse.json(await sendViaService(dmPlatform, dmUsername, dmMessage, sentToday));
  }

  // Nenhum configurado
  return NextResponse.json({
    success: false,
    dmSent: false,
    deliveryMsg: 'Nenhum servico de DM configurado. Configura o n8n (recomendado) ou DM Service. Ve n8n/SETUP.md',
    remainingToday: MAX_PER_DAY - sentToday,
    needSetup: true
  });
}

/* ===== GET ===== */
export async function GET() {
  var n8nOk = !!N8N_WEBHOOK_URL;
  var dmOnline = await checkDMService();
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    method: n8nOk ? 'n8n' : DM_SERVICE_URL ? 'dm-service' : 'none',
    n8n: { configured: n8nOk, url: n8nOk ? N8N_WEBHOOK_URL : 'NAO CONFIGURADA' },
    dmService: { online: dmOnline, url: DM_SERVICE_URL || 'NAO CONFIGURADA' }
  });
}