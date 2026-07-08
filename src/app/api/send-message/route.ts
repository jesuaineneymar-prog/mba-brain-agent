import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API (SIMPLIFICADO)
//  IG: API directa (sem browser) — RAPIDO
//  FB/TT: Via n8n (Puppeteer real) — webhook
//  Browserless: Apenas para login/diagnostic
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* ===== CORE: POST codigo para Browserless ===== */
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

/* ===== UA OVERRIDE ===== */
var UA_OVERRIDE = 'await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "userAgent", { get: () => ' + JSON.stringify(BL_UA) + ' }); });';

/* ===== BROWSERLESS HELPERS ===== */
var BH = [
'var evalFill = async function(pg, sel, val) {',
'  return await pg.evaluate(function(a) {',
'    var el = document.querySelector(a.s); if (!el) return false;',
'    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {',
'      var pr = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;',
'      var d = Object.getOwnPropertyDescriptor(pr, "value");',
'      if (d && d.set) d.set.call(el, a.v); else el.value = a.v;',
'      el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true}));',
'    } else if (el.contentEditable === "true") { el.focus(); document.execCommand("selectAll",false,null); document.execCommand("insertText",false,a.v); }',
'    return true;',
'  }, {s:sel, v:val});',
'};',
'var evalClick = async function(pg, sel) {',
'  return await pg.evaluate(function(s) { var els = document.querySelectorAll(s); if (els.length > 0) { els[0].click(); return true; } return false; }, sel);',
'};',
'var evalClickText = async function(pg, txt) {',
'  return await pg.evaluate(function(t) {',
'    var els = document.querySelectorAll("div[role=button], button, a, span");',
'    for (var i = 0; i < els.length; i++) { if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) { els[i].click(); return true; } }',
'    return false;',
'  }, txt);',
'};',
'var evalExists = async function(pg, sel) {',
'  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);',
'};',
'var evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };',
'var getCookies = async function(pg) { var bc = pg.browserContext(); return await bc.cookies(); };',
'var setCookies = async function(pg, cks) { var bc = pg.browserContext(); for (var i = 0; i < cks.length; i++) { await bc.setCookie(cks[i]); } };',
'var getCookieVal = function(cks, name) { for (var i = 0; i < cks.length; i++) { if (cks[i].name === name) return cks[i].value; } return ""; };',
].join('\n');

/* ===== DIAGNOSTIC ===== */
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
    var testResult = await runOnBrowserless('export default async function() { return { ok: true, ts: Date.now() }; }', 15000);
    diag.functionApi = testResult && testResult.ok === true;
    diag.steps.push({ step: 'Function API (eval)', ok: diag.functionApi, result: JSON.stringify(testResult).substring(0, 100) });
  } catch(e: any) {
    diag.steps.push({ step: 'Function API (eval)', ok: false, error: (e.message || 'unknown').substring(0, 200) });
  }
  return diag;
}

/* ===== LOGIN CODE GENERATORS ===== */
function makeLoginCode(platform: string, username: string, password: string): string {
  var u = JSON.stringify(username);
  var p = JSON.stringify(password);
  var pre = 'export default async function({ page }) {\n' + BH + '\n' + UA_OVERRIDE + '\n';

  if (platform === 'instagram') {
    return pre +
      'await page.goto("https://www.instagram.com/accounts/login/", { timeout: 15000 });\n' +
      'await evalSleep(4000);\n' +
      'var hasForm = await evalExists(page, \'input[name="username"]\');\n' +
      'if (!hasForm) {\n' +
      '  var hasAny = await evalExists(page, "input");\n' +
      '  if (!hasAny) return { success: false, error: "IG nao mostrou formulario (block/captcha)" };\n' +
      '}\n' +
      'await evalFill(page, \'input[name="username"]\', ' + u + ');\n' +
      'await evalFill(page, \'input[name="password"]\', ' + p + ');\n' +
      'await evalClickText(page, "Log in");\n' +
      'await evalSleep(7000);\n' +
      'var urlNow = page.url();\n' +
      'if (urlNow.indexOf("/accounts/login") >= 0) {\n' +
      '  var errMsg = await page.evaluate(function() { var el = document.getElementById("slfErrorAlert"); return el ? el.textContent : ""; }).catch(function() { return ""; });\n' +
      '  return { success: false, error: "Login IG falhou" + (errMsg ? ": " + errMsg.trim().substring(0, 80) : " - credenciais ou captcha") };\n' +
      '}\n' +
      'try { await evalClickText(page, "Not Now"); await evalSleep(500); } catch(e) {}\n' +
      'try { await evalClickText(page, "Not Now"); await evalSleep(500); } catch(e) {}\n' +
      'await evalSleep(2000);\n' +
      'var cookies = await getCookies(page);\n' +
      'return { success: true, sessionid: getCookieVal(cookies, "sessionid"), csrftoken: getCookieVal(cookies, "csrftoken"), cookiesJson: JSON.stringify(cookies), message: "Login IG feito" };\n' +
    '}';
  }

  if (platform === 'facebook') {
    return pre +
      'await page.goto("https://www.facebook.com/login", { timeout: 15000 });\n' +
      'await evalSleep(3000);\n' +
      'await evalFill(page, \'input[id="email"]\', ' + u + ');\n' +
      'await evalFill(page, \'input[id="pass"]\', ' + p + ');\n' +
      'await evalClick(page, \'button[name="login"]\');\n' +
      'await evalSleep(7000);\n' +
      'var urlNow = page.url();\n' +
      'if (urlNow.indexOf("/login") >= 0) {\n' +
      '  return { success: false, error: "Login FB falhou - credenciais erradas" };\n' +
      '}\n' +
      'var cookies = await getCookies(page);\n' +
      'return { success: true, fbToken: getCookieVal(cookies, "datr"), cookiesJson: JSON.stringify(cookies), sessionid: getCookieVal(cookies, "sb"), csrftoken: getCookieVal(cookies, "xs"), message: "Login FB feito" };\n' +
    '}';
  }

  if (platform === 'tiktok') {
    return pre +
      'await page.goto("https://www.tiktok.com/login", { timeout: 15000 });\n' +
      'await evalSleep(3000);\n' +
      'var clickedTab = await evalClickText(page, "Use phone / email / username");\n' +
      'if (!clickedTab) { await evalClick(page, "div[data-e2e=login-tab-item]"); await evalSleep(1000); }\n' +
      'await evalSleep(1500);\n' +
      'var hasInput = await evalExists(page, \'input[type="text"]\');\n' +
      'if (!hasInput) return { success: false, error: "TT nao mostrou campo de login" };\n' +
      'await evalFill(page, \'input[type="text"]\', ' + u + ');\n' +
      'if (' + p + ') {\n' +
      '  var hasPass = await evalExists(page, \'input[type="password"]\');\n' +
      '  if (hasPass) { await evalFill(page, \'input[type="password"]\', ' + p + '); }\n' +
      '}\n' +
      'await evalSleep(500);\n' +
      'await page.evaluate(function() { var el = document.activeElement; if (el) el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); });\n' +
      'await evalSleep(7000);\n' +
      'var cookies = await getCookies(page);\n' +
      'var sid = getCookieVal(cookies, "sessionid");\n' +
      'if (sid) return { success: true, sessionid: sid, csrftoken: getCookieVal(cookies, "tt_csrf_token"), cookiesJson: JSON.stringify(cookies), message: "Login TT feito" };\n' +
      'return { success: false, error: "Login TT falhou" };\n' +
    '}';
  }

  return '';
}

/* ===== LOGIN VIA BROWSERLESS ===== */
async function automateLogin(platform: string, username: string, password: string) {
  try {
    var code = makeLoginCode(platform, username, password);
    if (!code) return { success: false, error: 'Plataforma nao suportada: ' + platform };
    return await runOnBrowserless(code, 50000);
  } catch (e: any) {
    return { success: false, error: 'Erro Browserless: ' + (e.message || 'timeout') };
  }
}

/* ===== IG API DIRECT DM (sem browser, HTTP puro) — MAIS RAPIDO E FIÁVEL ===== */
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
        var dmBody = new URLSearchParams({ recipient_users: '[[%7B' + userId + '%7D]]', text: message, client_context: clientContext, action: 'send_item', thread_ids: '["0"]', platform: 'android' }).toString();
        var dmHeaders = { 'Cookie': cookies, 'X-CSRFToken': csrftoken, 'X-IG-App-ID': '936619743392459', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': BL_UA, 'X-Requested-With': 'XMLHttpRequest', 'X-IG-WWW-Claim': '0' };
        return fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', { method: 'POST', headers: dmHeaders, body: dmBody })
          .then(function(dmRes) {
            if (dmRes.ok) return { dmSent: true, deliveryMsg: 'DM IG enviado (API directa)' };
            return dmRes.text().then(function(txt) { return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status + ': ' + txt.substring(0, 120) }; }).catch(function() { return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status }; });
          })
          .catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao enviar DM IG' }; });
      }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao processar perfil IG' }; });
    })
    .catch(function() { return { dmSent: false, deliveryMsg: 'Erro de conexao com Instagram' }; });
}

/* ===== ROBUST SEND ===== */
async function robustSend(platform: string, username: string, message: string, cookies: string, sessionid: string, csrftoken: string, loginUsername: string, loginPassword: string, sentToday: number) {
  var lastError = '';

  // === INSTAGRAM: API directa primeiro (sem browser) ===
  if (platform === 'instagram' && sessionid && csrftoken) {
    try {
      var igResult = await attemptInstagramDirectDM(username, message, sessionid, csrftoken);
      if (igResult.dmSent) return { success: true, dmSent: true, deliveryMsg: igResult.deliveryMsg, source: 'ig-api-direct', remainingToday: MAX_PER_DAY - sentToday - 1 };
      lastError = igResult.deliveryMsg;
    } catch(e: any) { lastError = 'IG API: ' + (e.message || '').substring(0, 80); }

    // Re-login se falhou
    if (loginUsername && loginPassword) {
      try {
        var loginResult = await automateLogin('instagram', loginUsername, loginPassword);
        if (loginResult.success && loginResult.sessionid && loginResult.csrftoken) {
          sessionid = loginResult.sessionid;
          csrftoken = loginResult.csrftoken;
          try {
            var igRetry = await attemptInstagramDirectDM(username, message, sessionid, csrftoken);
            if (igRetry.dmSent) return { success: true, dmSent: true, deliveryMsg: igRetry.deliveryMsg, source: 'ig-api-relogin', remainingToday: MAX_PER_DAY - sentToday - 1 };
            lastError = igRetry.deliveryMsg;
          } catch(e2: any) { lastError = 'IG API retry: ' + (e2.message || '').substring(0, 80); }
        } else { lastError = 'Re-login falhou: ' + (loginResult.error || ''); }
      } catch(e: any) { lastError = 'Re-login erro: ' + (e.message || ''); }
    }
  }

  // === FACEBOOK e TIKTOK: Recomendar n8n ===
  if (platform === 'facebook' || platform === 'tiktok') {
    if (!sessionid && !cookies) {
      return {
        success: false, dmSent: false,
        deliveryMsg: 'DM ' + platform + ': Faz login primeiro. Para automacao completa, usa o n8n.',
        n8nRecommended: true,
        platform: platform,
        remainingToday: MAX_PER_DAY - sentToday
      };
    }
    // Tentar via Browserless como fallback (1 metodo simples)
    try {
      var target = JSON.stringify(username);
      var msg = JSON.stringify(message);
      var ck = cookies ? JSON.stringify(cookies) : 'null';
      var dmCode = 'export default async function({ page }) {\n' + BH + '\n' + UA_OVERRIDE + '\n';
      if (platform === 'facebook') {
        dmCode += 'if (' + ck + ') { try { await setCookies(page, JSON.parse(' + ck + ')); } catch(e) {} }\n';
        dmCode += 'await page.goto("https://www.facebook.com/messages/t/" + ' + target + ', { timeout: 12000 });\n';
        dmCode += 'await evalSleep(3000);\n';
        dmCode += 'var hasBox = await evalExists(page, "div[contenteditable=true]");\n';
        dmCode += 'if (hasBox) {\n';
        dmCode += '  await page.evaluate(function(m) { var el = document.querySelector("div[contenteditable=true]"); if (el) { el.focus(); document.execCommand("insertText",false,m); } }, ' + msg + ');\n';
        dmCode += '  await evalSleep(500);\n';
        dmCode += '  await page.evaluate(function() { var el = document.activeElement; if (el) el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); });\n';
        dmCode += '  await evalSleep(2000);\n';
        dmCode += '  return { dmSent: true, deliveryMsg: "DM FB enviado" };\n';
        dmCode += '}\n';
        dmCode += 'return { dmSent: false, deliveryMsg: "FB: Caixa de mensagem nao encontrada. Recomendado: n8n" };\n';
      } else {
        dmCode += 'if (' + ck + ') { try { await setCookies(page, JSON.parse(' + ck + ')); } catch(e) {} }\n';
        dmCode += 'await page.goto("https://www.tiktok.com/@" + ' + target + ', { timeout: 15000 });\n';
        dmCode += 'await evalSleep(3000);\n';
        dmCode += 'var msgOk = await evalClick(page, "div[data-e2e=profile-message-button]");\n';
        dmCode += 'if (msgOk) {\n';
        dmCode += '  await evalSleep(2500);\n';
        dmCode += '  var hasBox = await evalExists(page, "div[contenteditable=true]");\n';
        dmCode += '  if (hasBox) {\n';
        dmCode += '    await page.evaluate(function(m) { var el = document.querySelector("div[contenteditable=true]"); if (el) { el.focus(); document.execCommand("insertText",false,m); } }, ' + msg + ');\n';
        dmCode += '    await evalSleep(500);\n';
        dmCode += '    await page.evaluate(function() { var el = document.activeElement; if (el) el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); });\n';
        dmCode += '    await evalSleep(2500);\n';
        dmCode += '    return { dmSent: true, deliveryMsg: "DM TT enviado" };\n';
        dmCode += '  }\n';
        dmCode += '}\n';
        dmCode += 'return { dmSent: false, deliveryMsg: "TT: Botao mensagem nao encontrado. Recomendado: n8n" };\n';
      }
      dmCode += '}';

      var blResult = await runOnBrowserless(dmCode, 45000);
      if (blResult && blResult.dmSent) {
        return { success: true, dmSent: true, deliveryMsg: blResult.deliveryMsg, source: 'browserless-fallback', remainingToday: MAX_PER_DAY - sentToday - 1 };
      }
      lastError = (blResult && blResult.deliveryMsg) || 'Browserless falhou';
    } catch(e: any) { lastError = 'Browserless: ' + (e.message || 'timeout').substring(0, 80); }
  }

  // === INSTAGRAM sem sessionid ===
  if (platform === 'instagram' && (!sessionid || !csrftoken)) {
    if (loginUsername && loginPassword) {
      try {
        var loginResult = await automateLogin('instagram', loginUsername, loginPassword);
        if (loginResult.success && loginResult.sessionid && loginResult.csrftoken) {
          var igAfterLogin = await attemptInstagramDirectDM(username, message, loginResult.sessionid, loginResult.csrftoken);
          if (igAfterLogin.dmSent) return { success: true, dmSent: true, deliveryMsg: igAfterLogin.deliveryMsg, source: 'ig-api-after-login', remainingToday: MAX_PER_DAY - sentToday - 1 };
          lastError = igAfterLogin.deliveryMsg;
        } else { lastError = 'Login falhou: ' + (loginResult.error || ''); }
      } catch(e: any) { lastError = 'Login erro: ' + (e.message || ''); }
    } else {
      lastError = 'IG: Faz login primeiro ou configura credenciais';
    }
  }

  return { success: false, dmSent: false, deliveryMsg: 'Falha: ' + lastError, remainingToday: MAX_PER_DAY - sentToday };
}

/* ===== POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 }); }

  if (body.action === 'diagnostic') return NextResponse.json(await runDiagnostic());

  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    if (!body.username) return NextResponse.json({ success: false, error: 'Username obrigatorio' });
    if (!body.password && platform !== 'tiktok') return NextResponse.json({ success: false, error: 'Password obrigatoria para ' + platform });
    return NextResponse.json(await automateLogin(platform, body.username, body.password || ''));
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
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY, browserless: { online: blOnline, mode: 'ig-api-direct + browserless-fallback' }, n8n: { recommended: true, webhookUrl: '/api/webhook' } });
}