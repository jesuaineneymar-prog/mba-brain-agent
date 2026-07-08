import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  Browserless /function API (HTTP puro, sem WebSocket)
//
//  FORMATO OBRIGATÓRIO do código:
//    export default async function({ page }) { ... return result; }
//
//  RESTRIÇÕES do Browserless /function:
//  - Não recebe "browser", só { page } e { context } (dummy)
//  - Não tem setViewportSize, addInitScript, addCookies
//  - Tem evaluateOnNewDocument, page.browserContext() (real)
//  - UA deve ser override via evaluateOnNewDocument
//  - Cookies: page.browserContext().cookies() / .setCookie()
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* ===== CORE: POST código para Browserless ===== */
async function runOnBrowserless(code: string, timeoutMs: number = 50000): Promise<any> {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var response = await fetch(BL_HTTP + '/function?token=' + BL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code }),
      signal: controller.signal
    });
    clearTimeout(timer);
    var ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('text/html') >= 0) {
      var html = await response.text();
      throw new Error('Browserless retornou HTML (HTTP ' + response.status + '): ' + html.substring(0, 150));
    }
    if (!response.ok) {
      var errBody = await response.text().catch(function() { return ''; });
      throw new Error('Browserless HTTP ' + response.status + ': ' + errBody.substring(0, 300));
    }
    return await response.json();
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Timeout Browserless (' + timeoutMs + 'ms)');
    throw e;
  }
}

/* ===== HEALTH CHECK ===== */
async function checkBrowserless(): Promise<boolean> {
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 8000);
    var res = await fetch(BL_HTTP + '/json/version?token=' + BL_TOKEN, { signal: ctrl.signal });
    clearTimeout(tid);
    return res.ok;
  } catch (e) { return false; }
}

/* ===== UA OVERRIDE SNIPPET (injeta antes de cada page load) ===== */
var UA_OVERRIDE = 'await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "userAgent", { get: () => ' + JSON.stringify(BL_UA) + ' }); });';

/* ===== DIAGNÓSTICO ===== */
async function runDiagnostic() {
  var diag: any = { steps: [], browserless: false, functionApi: false, browserNav: false };

  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 10000);
    var res = await fetch(BL_HTTP + '/json/version?token=' + BL_TOKEN, { signal: ctrl.signal });
    clearTimeout(tid);
    diag.browserless = res.ok;
    diag.steps.push({ step: 'HTTP health check', ok: res.ok, status: res.status });
  } catch(e: any) {
    diag.steps.push({ step: 'HTTP health check', ok: false, error: (e.message || 'timeout').substring(0, 120) });
  }

  try {
    var testResult = await runOnBrowserless(
      'export default async function() { return { ok: true, ts: Date.now() }; }', 15000
    );
    diag.functionApi = testResult && testResult.ok === true;
    diag.steps.push({ step: 'Function API (eval)', ok: diag.functionApi, result: JSON.stringify(testResult).substring(0, 100) });
  } catch(e: any) {
    diag.steps.push({ step: 'Function API (eval)', ok: false, error: (e.message || 'unknown').substring(0, 200) });
  }

  try {
    var navCode = 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'await page.goto("https://example.com", { timeout: 10000 });\n' +
      'var title = await page.title();\n' +
      'var ua = await page.evaluate(() => navigator.userAgent);\n' +
      'return { ok: true, title: title, ua: ua.substring(0, 30) };\n' +
    '}';
    var navResult = await runOnBrowserless(navCode, 25000);
    diag.browserNav = navResult && navResult.ok === true;
    diag.steps.push({ step: 'Browser + UA override', ok: diag.browserNav, title: (navResult && navResult.title) || '', ua: (navResult && navResult.ua) || '' });
  } catch(e: any) {
    diag.steps.push({ step: 'Browser + UA override', ok: false, error: (e.message || 'unknown').substring(0, 200) });
  }

  return diag;
}

/* ===== LOGIN CODE GENERATORS ===== */
function makeLoginCode(platform: string, username: string, password: string): string {
  var u = JSON.stringify(username);
  var p = JSON.stringify(password);

  if (platform === 'instagram') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'await page.goto("https://www.instagram.com/accounts/login/", { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 3000); });\n' +
      'var hasForm = !!(await page.$(\'input[name="username"]\'));\n' +
      'if (!hasForm) { return { success: false, error: "Instagram nao mostrou formulario de login (possible 429/blocked IP)" }; }\n' +
      'await page.fill(\'input[name="username"]\', ' + u + ');\n' +
      'await page.fill(\'input[name="password"]\', ' + p + ');\n' +
      'await page.click(\'div[role="button"]:has-text("Log in")\');\n' +
      'await new Promise(function(r) { setTimeout(r, 6000); });\n' +
      'var urlNow = page.url();\n' +
      'if (urlNow.indexOf("/accounts/login") >= 0) {\n' +
      '  return { success: false, error: "Login falhou - credenciais invalidas ou captcha" };\n' +
      '}\n' +
      'try { await page.click(\'div[role="button"]:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}\n' +
      'try { await page.click(\'button:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}\n' +
      'await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      'var bc = page.browserContext();\n' +
      'var cookies = await bc.cookies();\n' +
      'var cookiesJson = JSON.stringify(cookies);\n' +
      'var sessionid = "", csrftoken = "";\n' +
      'for (var i = 0; i < cookies.length; i++) {\n' +
      '  if (cookies[i].name === "sessionid") sessionid = cookies[i].value;\n' +
      '  if (cookies[i].name === "csrftoken") csrftoken = cookies[i].value;\n' +
      '}\n' +
      'return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: "Login Instagram feito com sucesso" };\n' +
    '}';
  }

  if (platform === 'tiktok') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'await page.goto("https://www.tiktok.com/login", { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 3000); });\n' +
      'try { await page.click("text=Use phone / email / username"); } catch(e) {}\n' +
      'await new Promise(function(r) { setTimeout(r, 1000); });\n' +
      'await page.fill(\'input[type="text"]\', ' + u + ');\n' +
      'await page.fill(\'input[type="password"]\', ' + p + ');\n' +
      'try { await page.click(\'button[type="submit"]\'); } catch(e) { try { await page.click(\'div[role="button"]:has-text("Log in")\'); } catch(e2) { await page.keyboard.press("Enter"); } }\n' +
      'await new Promise(function(r) { setTimeout(r, 6000); });\n' +
      'var bc = page.browserContext();\n' +
      'var cookies = await bc.cookies();\n' +
      'var cookiesJson = JSON.stringify(cookies);\n' +
      'var sessionid = "", csrftoken = "";\n' +
      'for (var i = 0; i < cookies.length; i++) {\n' +
      '  if (cookies[i].name === "sessionid") sessionid = cookies[i].value;\n' +
      '  if (cookies[i].name === "tt_csrf_token") csrftoken = cookies[i].value;\n' +
      '}\n' +
      'if (sessionid) { return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: "Login TikTok feito com sucesso" }; }\n' +
      'return { success: false, error: "Login TikTok falhou - verifica credenciais" };\n' +
    '}';
  }

  if (platform === 'facebook') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'await page.goto("https://www.facebook.com/login", { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 3000); });\n' +
      'await page.fill(\'input[id="email"]\', ' + u + ');\n' +
      'await page.fill(\'input[id="pass"]\', ' + p + ');\n' +
      'await page.click(\'button[name="login"]\');\n' +
      'await new Promise(function(r) { setTimeout(r, 6000); });\n' +
      'try { await page.click(\'button:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}\n' +
      'var bc = page.browserContext();\n' +
      'var cookies = await bc.cookies();\n' +
      'var cookiesJson = JSON.stringify(cookies);\n' +
      'var fbToken = "";\n' +
      'for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === "datr") fbToken = cookies[i].value; }\n' +
      'return { success: true, fbToken: fbToken, cookiesJson: cookiesJson, message: "Login Facebook feito com sucesso" };\n' +
    '}';
  }

  return '';
}

/* ===== DM CODE GENERATORS ===== */
function makeDMCode(platform: string, targetUsername: string, message: string, cookiesJson: string, attempt: number): string {
  var target = JSON.stringify(targetUsername);
  var msg = JSON.stringify(message);
  var ck = cookiesJson ? JSON.stringify(cookiesJson) : 'null';

  if (platform === 'instagram') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'if (' + ck + ') {\n' +
      '  var bc = page.browserContext();\n' +
      '  try {\n' +
      '    var parsed = JSON.parse(' + ck + ');\n' +
      '    for (var i = 0; i < parsed.length; i++) { await bc.setCookie(parsed[i]); }\n' +
      '  } catch(e) {}\n' +
      '}\n' +
      'await page.goto("https://www.instagram.com/direct/new/", { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      'var hasSearch = !!(await page.$(\'input[placeholder="Search..."]\'));\n' +
      'if (hasSearch) {\n' +
      '  await page.fill(\'input[placeholder="Search..."]\', ' + target + ');\n' +
      '  await new Promise(function(r) { setTimeout(r, 2500); });\n' +
      '  try {\n' +
      '    await page.click(\'div[role="option"]\', { timeout: 3000 });\n' +
      '    await new Promise(function(r) { setTimeout(r, 1000); });\n' +
      '    await page.click(\'div[role="dialog"] button:not([disabled])\');\n' +
      '    await new Promise(function(r) { setTimeout(r, 1000); });\n' +
      '    await page.keyboard.type(' + msg + ');\n' +
      '    await new Promise(function(r) { setTimeout(r, 500); });\n' +
      '    await page.keyboard.press("Enter");\n' +
      '    await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '    return { dmSent: true, deliveryMsg: "DM IG enviado via Browserless (new msg)" };\n' +
      '  } catch(e) {}\n' +
      '}\n' +
      // METHOD B: Profile message button
      'try {\n' +
      '  await page.goto("https://www.instagram.com/" + ' + target + ' + "/", { timeout: 10000 });\n' +
      '  await new Promise(function(r) { setTimeout(r, 1500); });\n' +
      '  var msgBtn = await page.$(\'button:has-text("Message")\');\n' +
      '  if (!msgBtn) msgBtn = await page.$(\'div[role="button"]:has-text("Message")\');\n' +
      '  if (msgBtn) {\n' +
      '    await msgBtn.click();\n' +
      '    await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '    await page.keyboard.type(' + msg + ');\n' +
      '    await new Promise(function(r) { setTimeout(r, 500); });\n' +
      '    await page.keyboard.press("Enter");\n' +
      '    await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '    return { dmSent: true, deliveryMsg: "DM IG enviado (profile msg btn)" };\n' +
      '  }\n' +
      '} catch(e2) {}\n' +
      'return { dmSent: false, deliveryMsg: "Nao conseguiu abrir conversa IG (tentativa ' + attempt + ')" };\n' +
    '}';
  }

  if (platform === 'tiktok') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'if (' + ck + ') {\n' +
      '  var bc = page.browserContext();\n' +
      '  try { var p = JSON.parse(' + ck + '); for (var i = 0; i < p.length; i++) { await bc.setCookie(p[i]); } } catch(e) {}\n' +
      '}\n' +
      'await page.goto("https://www.tiktok.com/@" + ' + target + ', { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 2500); });\n' +
      'var msgBtn = await page.$(\'div[data-e2e="profile-message-button"]\');\n' +
      'if (msgBtn) {\n' +
      '  await msgBtn.click();\n' +
      '  await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '  var ta = await page.$(\'div[contenteditable="true"]\');\n' +
      '  if (ta) {\n' +
      '    await ta.click(); await page.keyboard.type(' + msg + ');\n' +
      '    await new Promise(function(r) { setTimeout(r, 500); });\n' +
      '    await page.keyboard.press("Enter");\n' +
      '    await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '    return { dmSent: true, deliveryMsg: "DM TikTok enviado (profile btn)" };\n' +
      '  }\n' +
      '}\n' +
      'return { dmSent: false, deliveryMsg: "Erro DM TikTok (tentativa ' + attempt + ')" };\n' +
    '}';
  }

  if (platform === 'facebook') {
    return 'export default async function({ page }) {\n' +
      UA_OVERRIDE + '\n' +
      'if (' + ck + ') {\n' +
      '  var bc = page.browserContext();\n' +
      '  try { var p = JSON.parse(' + ck + '); for (var i = 0; i < p.length; i++) { await bc.setCookie(p[i]); } } catch(e) {}\n' +
      '}\n' +
      'await page.goto("https://www.facebook.com/messages/t/" + ' + target + ', { timeout: 15000 });\n' +
      'await new Promise(function(r) { setTimeout(r, 3000); });\n' +
      'var msgArea = await page.$(\'div[aria-label="Message"], div[contenteditable="true"][role="textbox"]\');\n' +
      'if (msgArea) {\n' +
      '  await msgArea.click(); await page.keyboard.type(' + msg + ');\n' +
      '  await new Promise(function(r) { setTimeout(r, 500); });\n' +
      '  await page.keyboard.press("Enter");\n' +
      '  await new Promise(function(r) { setTimeout(r, 2000); });\n' +
      '  return { dmSent: true, deliveryMsg: "DM Facebook enviado (direct URL)" };\n' +
      '}\n' +
      'return { dmSent: false, deliveryMsg: "Erro DM Facebook (tentativa ' + attempt + ')" };\n' +
    '}';
  }

  return '';
}

/* ===== LOGIN VIA BROWSERLESS ===== */
async function automateLogin(platform: string, username: string, password: string) {
  try {
    var code = makeLoginCode(platform, username, password);
    if (!code) return { success: false, error: 'Plataforma nao suportada: ' + platform };
    return await runOnBrowserless(code, 45000);
  } catch (e: any) {
    return { success: false, error: 'Erro Browserless HTTP: ' + (e.message || 'timeout') };
  }
}

/* ===== SEND DM VIA BROWSERLESS ===== */
async function sendDMViaBrowserless(platform: string, targetUsername: string, message: string, cookiesJson: string, attempt: number) {
  try {
    var code = makeDMCode(platform, targetUsername, message, cookiesJson, attempt);
    if (!code) return { dmSent: false, deliveryMsg: 'Plataforma nao suportada' };
    return await runOnBrowserless(code, 45000);
  } catch (e: any) {
    return { dmSent: false, deliveryMsg: 'Erro Browserless HTTP (tentativa ' + attempt + '): ' + (e.message || 'timeout').substring(0, 80) };
  }
}

/* ===== IG API DIRECT DM (sem browser, HTTP puro) ===== */
function attemptInstagramDirectDM(username: string, message: string, sessionid: string, csrftoken: string) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var cookies = 'sessionid=' + sessionid + '; csrftoken=' + csrftoken + '; ds_user_id=' + dsUserId;
  var igHeaders = { 'Cookie': cookies, 'X-IG-App-ID': '936619743392459', 'X-CSRFToken': csrftoken, 'User-Agent': BL_UA, 'X-Requested-With': 'XMLHttpRequest' };

  return fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + username, { headers: igHeaders })
    .then(function(profileRes) {
      if (!profileRes.ok) return { dmSent: false, deliveryMsg: 'Perfil IG nao encontrado (HTTP ' + profileRes.status + ')' };
      return profileRes.json().then(function(profileData) {
        var userData = profileData.data && profileData.data.user;
        var userId = userData && (userData.pk || userData.id);
        if (!userId) return { dmSent: false, deliveryMsg: 'User ID nao encontrado' };
        var clientContext = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        var dmBody = new URLSearchParams({
          recipient_users: '[[%7B' + userId + '%7D]]', text: message, client_context: clientContext,
          action: 'send_item', thread_ids: '["0"]', platform: 'android'
        }).toString();
        var dmHeaders = { 'Cookie': cookies, 'X-CSRFToken': csrftoken, 'X-IG-App-ID': '936619743392459', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': BL_UA, 'X-Requested-With': 'XMLHttpRequest', 'X-IG-WWW-Claim': '0' };
        return fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', { method: 'POST', headers: dmHeaders, body: dmBody })
          .then(function(dmRes) {
            if (dmRes.ok) return { dmSent: true, deliveryMsg: 'DM IG enviado (API directa)' };
            return dmRes.text().then(function(txt) {
              return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status + ': ' + txt.substring(0, 120) };
            }).catch(function() { return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status }; });
          })
          .catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao enviar DM IG' }; });
      }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao processar perfil IG' }; });
    })
    .catch(function() { return { dmSent: false, deliveryMsg: 'Erro de conexao com Instagram' }; });
}

/* ===== ROBUST SEND ===== */
async function robustSend(platform: string, username: string, message: string, cookies: string, sessionid: string, csrftoken: string, loginUsername: string, loginPassword: string, sentToday: number) {
  var lastError = '';
  var METHODS: Array<{ name: string; fn: Function }> = [];
  if (platform === 'instagram' && sessionid && csrftoken) {
    METHODS.push({ name: 'IG API Direct', fn: function() { return attemptInstagramDirectDM(username, message, sessionid, csrftoken); } });
  }
  METHODS.push({ name: 'Browserless', fn: function(attempt: number) { return sendDMViaBrowserless(platform, username, message, cookies, attempt); } });

  for (var cycle = 0; cycle < 2; cycle++) {
    for (var mi = 0; mi < METHODS.length; mi++) {
      var method = METHODS[mi];
      var maxAttempts = method.name === 'Browserless' ? 2 : 1;
      for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          var result = method.name === 'Browserless'
            ? await sendDMViaBrowserless(platform, username, message, cookies, cycle * 2 + attempt)
            : await method.fn();
          if (result.dmSent) return { success: true, dmSent: true, deliveryMsg: result.deliveryMsg, source: method.name.toLowerCase().replace(/ /g, '-'), remainingToday: MAX_PER_DAY - sentToday - 1 };
          lastError = result.deliveryMsg || 'Metodo falhou';
        } catch(e: any) { lastError = method.name + ' excecao: ' + (e.message || '').substring(0, 60); }
      }
    }
    if (cycle === 0 && loginUsername && loginPassword) {
      try {
        var loginResult = await automateLogin(platform, loginUsername, loginPassword);
        if (loginResult.success) {
          cookies = loginResult.cookiesJson || cookies;
          sessionid = loginResult.sessionid || sessionid;
          csrftoken = loginResult.csrftoken || csrftoken;
          if (platform === 'instagram' && sessionid && csrftoken) {
            METHODS.unshift({ name: 'IG API Direct (re-login)', fn: function() { return attemptInstagramDirectDM(username, message, sessionid, csrftoken); } });
          }
        } else { lastError = 'Re-login falhou: ' + (loginResult.error || ''); }
      } catch(e: any) { lastError = 'Re-login erro: ' + (e.message || ''); }
    }
    if (sentToday >= MAX_PER_DAY) return { success: false, dmSent: false, deliveryMsg: 'Limite diario atingido', remainingToday: 0 };
  }
  return { success: false, dmSent: false, deliveryMsg: 'Todos os metodos falharam: ' + lastError, remainingToday: MAX_PER_DAY - sentToday };
}

/* ===== POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 }); }

  if (body.action === 'diagnostic') return NextResponse.json(await runDiagnostic());

  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    if (!body.username || !body.password) return NextResponse.json({ success: false, error: 'Username e password obrigatorios' });
    return NextResponse.json(await automateLogin(platform, body.username, body.password));
  }

  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;
  if (!dmUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  if (sentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido (' + MAX_PER_DAY + ')', remainingToday: 0 });

  var result = await robustSend(dmPlatform, dmUsername, dmMessage, body.cookies || '', body.sessionid || '', body.csrftoken || '', body.loginUsername || '', body.loginPassword || '', sentToday);
  return NextResponse.json(result);
}

/* ===== GET ===== */
export async function GET() {
  var blOnline = await checkBrowserless();
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY, browserless: { online: blOnline, mode: 'http-function-esm-export-default' } });
}