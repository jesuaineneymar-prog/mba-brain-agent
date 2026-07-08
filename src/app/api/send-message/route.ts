import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  IG: API directa (sem browser) + input manual de cookies
//  FB: Browserless com abordagem perfil → Message
//  TT: Browserless com abordagem perfil → Message
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* ===== CORE ===== */
async function runOnBrowserless(code: string, timeoutMs: number = 50000): Promise<any> {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
  try {
    var response = await fetch(BL_HTTP + '/function?token=' + BL_TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code }), signal: controller.signal
    });
    clearTimeout(timer);
    var ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('text/html') >= 0) { var html = await response.text(); throw new Error('HTML response: ' + html.substring(0, 100)); }
    if (!response.ok) { var errBody = await response.text().catch(function() { return ''; }); throw new Error('HTTP ' + response.status + ': ' + errBody.substring(0, 200)); }
    return await response.json();
  } catch (e: any) { clearTimeout(timer); if (e.name === 'AbortError') throw new Error('Timeout'); throw e; }
}

async function checkBrowserless(): Promise<boolean> {
  try { var res = await fetch(BL_HTTP + '/json/version?token=' + BL_TOKEN, { signal: AbortSignal.timeout(8000) }); return res.ok; } catch (e) { return false; }
}

var UA_OVERRIDE = 'await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "userAgent", { get: () => ' + JSON.stringify(BL_UA) + ' }); });';

var BH = [
'var evalFill = async function(pg, sel, val) { return await pg.evaluate(function(a) { var el = document.querySelector(a.s); if (!el) return false; if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") { var pr = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; var d = Object.getOwnPropertyDescriptor(pr, "value"); if (d && d.set) d.set.call(el, a.v); else el.value = a.v; el.dispatchEvent(new Event("input", {bubbles:true})); el.dispatchEvent(new Event("change", {bubbles:true})); } else if (el.contentEditable === "true") { el.focus(); document.execCommand("selectAll",false,null); document.execCommand("insertText",false,a.v); } return true; }, {s:sel, v:val}); };',
'var evalClick = async function(pg, sel) { return await pg.evaluate(function(s) { var els = document.querySelectorAll(s); if (els.length > 0) { els[0].click(); return true; } return false; }, sel); };',
'var evalClickText = async function(pg, txt) { return await pg.evaluate(function(t) { var els = document.querySelectorAll("div[role=button], button, a, span, div[tabindex]"); for (var i = 0; i < els.length; i++) { if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) { els[i].click(); return true; } } return false; }, txt); };',
'var evalExists = async function(pg, sel) { return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel); };',
'var evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };',
'var getCookies = async function(pg) { var bc = pg.browserContext(); return await bc.cookies(); };',
'var setCookies = async function(pg, cks) { var bc = pg.browserContext(); for (var i = 0; i < cks.length; i++) { await bc.setCookie(cks[i]); } };',
'var getCookieVal = function(cks, name) { for (var i = 0; i < cks.length; i++) { if (cks[i].name === name) return cks[i].value; } return ""; };',
].join('\n');

/* ===== DIAGNOSTIC ===== */
async function runDiagnostic() {
  var diag: any = { steps: [], browserless: false, functionApi: false };
  try { var res = await fetch(BL_HTTP + '/json/version?token=' + BL_TOKEN, { signal: AbortSignal.timeout(8000) }); diag.browserless = res.ok; diag.steps.push({ step: 'Health', ok: res.ok }); } catch(e: any) { diag.steps.push({ step: 'Health', ok: false, error: (e.message || '').substring(0, 100) }); }
  try { var r = await runOnBrowserless('export default async function() { return { ok: true }; }', 15000); diag.functionApi = r && r.ok; diag.steps.push({ step: 'Function API', ok: diag.functionApi }); } catch(e: any) { diag.steps.push({ step: 'Function API', ok: false, error: (e.message || '').substring(0, 100) }); }
  return diag;
}

/* ===== LOGIN ===== */
function makeLoginCode(platform: string, username: string, password: string): string {
  var u = JSON.stringify(username);
  var p = JSON.stringify(password);
  var pre = 'export default async function({ page }) {\n' + BH + '\n' + UA_OVERRIDE + '\n';

  if (platform === 'instagram') {
    return pre +
      'await page.goto("https://www.instagram.com/accounts/login/", { timeout: 15000 });\n' +
      'await evalSleep(5000);\n' +
      'var hasForm = await evalExists(page, \'input[name="username"]\');\n' +
      'if (!hasForm) { var hasAny = await evalExists(page, "input"); if (!hasAny) return { success: false, error: "IG: captcha ou bloqueio. Tenta action=set-cookies com cookies do teu browser." }; }\n' +
      'await evalFill(page, \'input[name="username"]\', ' + u + ');\n' +
      'await evalFill(page, \'input[name="password"]\', ' + p + ');\n' +
      'await evalClickText(page, "Log in");\n' +
      'await evalSleep(8000);\n' +
      'var urlNow = page.url();\n' +
      'if (urlNow.indexOf("/accounts/login") >= 0) {\n' +
      '  var errMsg = await page.evaluate(function() { var el = document.getElementById("slfErrorAlert"); return el ? el.textContent : ""; }).catch(function() { return ""; });\n' +
      '  return { success: false, error: "IG captcha/bloqueio" + (errMsg ? ": " + errMsg.trim().substring(0, 60) : ". Usa action=set-cookies.") };\n' +
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
      'if (urlNow.indexOf("/login") >= 0) { return { success: false, error: "FB: credenciais erradas" }; }\n' +
      'var cookies = await getCookies(page);\n' +
      'return { success: true, fbToken: getCookieVal(cookies, "datr"), cookiesJson: JSON.stringify(cookies), sessionid: getCookieVal(cookies, "sb"), csrftoken: getCookieVal(cookies, "xs"), message: "Login FB feito" };\n' +
    '}';
  }

  if (platform === 'tiktok') {
    return pre +
      'await page.goto("https://www.tiktok.com/login", { timeout: 15000 });\n' +
      'await evalSleep(4000);\n' +
      // Tentar varias opcoes de tab
      'var tab1 = await evalClickText(page, "Use phone / email / username");\n' +
      'if (!tab1) tab1 = await evalClickText(page, "Telefone");\n' +
      'if (!tab1) tab1 = await evalClickText(page, "Email");\n' +
      'if (!tab1) tab1 = await evalClickText(page, "Usuario");\n' +
      'if (!tab1) { var tabs = await page.evaluate(function() { var els = document.querySelectorAll("div[data-e2e=login-tab-item], div[class*=tab], div[role=tab]"); var r = []; for (var i = 0; i < els.length; i++) r.push(els[i].textContent.trim()); return r; }).catch(function() { return []; }); return { success: false, error: "TT: tabs encontrados: " + tabs.join(", ") }; }\n' +
      'await evalSleep(2000);\n' +
      // Procurar qualquer input visivel
      'var inputInfo = await page.evaluate(function() { var inputs = document.querySelectorAll("input"); var r = []; for (var i = 0; i < inputs.length; i++) { var s = getComputedStyle(inputs[i]); if (s.display !== "none" && s.visibility !== "hidden" && inputs[i].offsetParent !== null) r.push({ type: inputs[i].type, name: inputs[i].name, placeholder: inputs[i].placeholder, id: inputs[i].id }); } return r; }).catch(function() { return []; });\n' +
      'if (inputInfo.length === 0) return { success: false, error: "TT: nenhum input visivel encontrado" };\n' +
      // Preencher primeiro input
      'await evalFill(page, "input[type=text]:not([type=password])", ' + u + ');\n' +
      'await evalSleep(500);\n' +
      // Preencher password se existir
      'var hasPass = await evalExists(page, \'input[type="password"]\');\n' +
      'if (hasPass && ' + p + ') { await evalFill(page, \'input[type="password"]\', ' + p + '); await evalSleep(500); }\n' +
      // Submeter
      'await page.evaluate(function() { var el = document.activeElement; if (el) { el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); el.dispatchEvent(new KeyboardEvent("keyup",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); } });\n' +
      'await evalSleep(8000);\n' +
      'var cookies = await getCookies(page);\n' +
      'var sid = getCookieVal(cookies, "sessionid");\n' +
      'if (sid) return { success: true, sessionid: sid, csrftoken: getCookieVal(cookies, "tt_csrf_token"), cookiesJson: JSON.stringify(cookies), message: "Login TT feito" };\n' +
      'var urlNow = page.url();\n' +
      'if (urlNow.indexOf("login") < 0) { return { success: true, sessionid: getCookieVal(cookies, "session_id") || "", cookiesJson: JSON.stringify(cookies), message: "Login TT possivel" }; }\n' +
      'return { success: false, error: "TT: login falhou" };\n' +
    '}';
  }
  return '';
}

async function automateLogin(platform: string, username: string, password: string) {
  try { var code = makeLoginCode(platform, username, password); if (!code) return { success: false, error: 'Plataforma nao suportada' }; return await runOnBrowserless(code, 50000); } catch (e: any) { return { success: false, error: 'Erro: ' + (e.message || 'timeout').substring(0, 100) }; }
}

/* ===== IG API DIRECT DM ===== */
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
            if (dmRes.ok) return { dmSent: true, deliveryMsg: 'DM IG enviado (API)' };
            return dmRes.text().then(function(txt) { return { dmSent: false, deliveryMsg: 'DM IG HTTP ' + dmRes.status + ': ' + txt.substring(0, 100) }; }).catch(function() { return { dmSent: false, deliveryMsg: 'DM IG HTTP ' + dmRes.status }; });
          }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao enviar DM IG' }; });
      }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro perfil IG' }; });
    }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro conexao IG' }; });
}

/* ===== BROWSERLESS DM: FB — Perfil → Message ===== */
function makeFBDmCode(username: string, message: string, cookiesJson: string): string {
  var target = JSON.stringify(username);
  var msg = JSON.stringify(message);
  var ck = cookiesJson ? JSON.stringify(cookiesJson) : 'null';
  return 'export default async function({ page }) {\n' + BH + '\n' + UA_OVERRIDE + '\n' +
    'if (' + ck + ') { try { await setCookies(page, JSON.parse(' + ck + ')); } catch(e) {} }\n' +
    // Method: Ir ao perfil e clicar Message
    'await page.goto("https://www.facebook.com/" + ' + target + ', { timeout: 15000 });\n' +
    'await evalSleep(5000);\n' +
    // Procurar botao Message (varios selectores)
    'var clicked = await evalClickText(page, "Message");\n' +
    'if (!clicked) clicked = await evalClickText(page, "Enviar mensagem");\n' +
    'if (!clicked) clicked = await evalClickText(page, "Mensagem");\n' +
    'if (!clicked) clicked = await evalClick(page, "a[aria-label*=essage]");\n' +
    'if (clicked) {\n' +
    '  await evalSleep(4000);\n' +
    // Procurar caixa de texto com varios selectores
    'var sel = await page.evaluate(function() {\n' +
    '  var sels = ["div[contenteditable=true][role=textbox]", "div[contenteditable=true][data-lexical-editor=true]", "div[contenteditable=true]", "textarea[name=message_body]", "div[role=textbox]"];\n' +
    '  for (var i = 0; i < sels.length; i++) { if (document.querySelector(sels[i])) return sels[i]; }\n' +
    '  return "";\n' +
    '});\n' +
    'if (sel) {\n' +
    '  await page.evaluate(function(m, s) { var el = document.querySelector(s); if (el) { el.focus(); document.execCommand("selectAll",false,null); document.execCommand("insertText",false,m); } }, ' + msg + ', sel);\n' +
    '  await evalSleep(800);\n' +
    '  await page.evaluate(function() { var el = document.activeElement; if (el) { el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); el.dispatchEvent(new KeyboardEvent("keyup",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); } });\n' +
    '  await evalSleep(3000);\n' +
    '  return { dmSent: true, deliveryMsg: "DM FB enviado (perfil)" };\n' +
    '}\n' +
    // Fallback: Tentar URL directa
    'await page.goto("https://www.facebook.com/messages/t/" + ' + target + ', { timeout: 10000 });\n' +
    'await evalSleep(4000);\n' +
    'var sel2 = await page.evaluate(function() {\n' +
    '  var sels = ["div[contenteditable=true][role=textbox]", "div[contenteditable=true][data-lexical-editor=true]", "div[contenteditable=true]", "textarea[name=message_body]"];\n' +
    '  for (var i = 0; i < sels.length; i++) { if (document.querySelector(sels[i])) return sels[i]; }\n' +
    '  return "";\n' +
    '});\n' +
    'if (sel2) {\n' +
    '  await page.evaluate(function(m, s) { var el = document.querySelector(s); if (el) { el.focus(); document.execCommand("selectAll",false,null); document.execCommand("insertText",false,m); } }, ' + msg + ', sel2);\n' +
    '  await evalSleep(800);\n' +
    '  await page.evaluate(function() { var el = document.activeElement; if (el) { el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); } });\n' +
    '  await evalSleep(3000);\n' +
    '  return { dmSent: true, deliveryMsg: "DM FB enviado (direct URL)" };\n' +
    '}\n' +
    'var pageUrl = page.url();\n' +
    'return { dmSent: false, deliveryMsg: "FB: nenhuma caixa de mensagem encontrada (url: " + pageUrl.substring(0, 60) + ")" };\n' +
    '}';
}

/* ===== BROWSERLESS DM: TT — Perfil → Message ===== */
function makeTTDmCode(username: string, message: string, cookiesJson: string): string {
  var target = JSON.stringify(username);
  var msg = JSON.stringify(message);
  var ck = cookiesJson ? JSON.stringify(cookiesJson) : 'null';
  return 'export default async function({ page }) {\n' + BH + '\n' + UA_OVERRIDE + '\n' +
    'if (' + ck + ') { try { await setCookies(page, JSON.parse(' + ck + ')); } catch(e) {} }\n' +
    'await page.goto("https://www.tiktok.com/@" + ' + target + ', { timeout: 15000 });\n' +
    'await evalSleep(4000);\n' +
    // Procurar botao mensagem (varios selectores)
    'var clicked = await evalClick(page, "div[data-e2e=profile-message-button]");\n' +
    'if (!clicked) clicked = await evalClickText(page, "Message");\n' +
    'if (!clicked) clicked = await evalClickText(page, "Enviar mensagem");\n' +
    'if (clicked) {\n' +
    '  await evalSleep(3000);\n' +
    '  var hasBox = await evalExists(page, "div[contenteditable=true]");\n' +
    '  if (!hasBox) hasBox = await evalExists(page, "div[role=textbox]");\n' +
    '  if (hasBox) {\n' +
    '    await page.evaluate(function(m) { var el = document.querySelector("div[contenteditable=true]") || document.querySelector("div[role=textbox]"); if (el) { el.focus(); document.execCommand("selectAll",false,null); document.execCommand("insertText",false,m); } }, ' + msg + ');\n' +
    '    await evalSleep(500);\n' +
    '    await page.evaluate(function() { var el = document.activeElement; if (el) { el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",keyCode:13,bubbles:true})); } });\n' +
    '    await evalSleep(3000);\n' +
    '    return { dmSent: true, deliveryMsg: "DM TT enviado" };\n' +
    '  }\n' +
    '}\n' +
    'return { dmSent: false, deliveryMsg: "TT: botao mensagem ou caixa nao encontrados" };\n' +
    '}';
}

/* ===== ROBUST SEND ===== */
async function robustSend(platform: string, username: string, message: string, cookies: string, sessionid: string, csrftoken: string, loginUsername: string, loginPassword: string, sentToday: number) {
  var lastError = '';

  // ===== INSTAGRAM =====
  if (platform === 'instagram') {
    // Se tem sessionid, tentar API directa
    if (sessionid && csrftoken) {
      try {
        var igResult = await attemptInstagramDirectDM(username, message, sessionid, csrftoken);
        if (igResult.dmSent) return { success: true, dmSent: true, deliveryMsg: igResult.deliveryMsg, source: 'ig-api', remainingToday: MAX_PER_DAY - sentToday - 1 };
        lastError = igResult.deliveryMsg;
      } catch(e: any) { lastError = (e.message || '').substring(0, 80); }
    }

    // Se tem credenciais, fazer login e tentar
    if (loginUsername && loginPassword) {
      try {
        var loginResult = await automateLogin('instagram', loginUsername, loginPassword);
        if (loginResult.success && loginResult.sessionid && loginResult.csrftoken) {
          try {
            var igAfter = await attemptInstagramDirectDM(username, message, loginResult.sessionid, loginResult.csrftoken);
            if (igAfter.dmSent) return { success: true, dmSent: true, deliveryMsg: igAfter.deliveryMsg, source: 'ig-api-relogin', remainingToday: MAX_PER_DAY - sentToday - 1 };
            lastError = igAfter.deliveryMsg;
          } catch(e2: any) { lastError = (e2.message || '').substring(0, 80); }
        } else {
          lastError = 'Login falhou: ' + (loginResult.error || 'captcha');
        }
      } catch(e: any) { lastError = 'Login erro: ' + (e.message || '').substring(0, 80); }
    }

    return { success: false, dmSent: false, deliveryMsg: 'IG: ' + (lastError || 'sem credenciais'), remainingToday: MAX_PER_DAY - sentToday };
  }

  // ===== FACEBOOK =====
  if (platform === 'facebook') {
    // Tentar via Browserless
    try {
      var fbCode = makeFBDmCode(username, message, cookies);
      var fbResult = await runOnBrowserless(fbCode, 45000);
      if (fbResult && fbResult.dmSent) return { success: true, dmSent: true, deliveryMsg: fbResult.deliveryMsg, source: 'browserless', remainingToday: MAX_PER_DAY - sentToday - 1 };
      lastError = (fbResult && fbResult.deliveryMsg) || 'Browserless falhou';
    } catch(e: any) { lastError = (e.message || 'timeout').substring(0, 80); }

    // Re-login e tentar de novo
    if (loginUsername && loginPassword) {
      try {
        var fbLogin = await automateLogin('facebook', loginUsername, loginPassword);
        if (fbLogin.success && fbLogin.cookiesJson) {
          cookies = fbLogin.cookiesJson;
          try {
            var fbRetry = await runOnBrowserless(makeFBDmCode(username, message, cookies), 45000);
            if (fbRetry && fbRetry.dmSent) return { success: true, dmSent: true, deliveryMsg: fbRetry.deliveryMsg, source: 'browserless-relogin', remainingToday: MAX_PER_DAY - sentToday - 1 };
            lastError = (fbRetry && fbRetry.deliveryMsg) || 'Falhou apos re-login';
          } catch(e2: any) { lastError = (e2.message || 'timeout').substring(0, 80); }
        }
      } catch(e: any) { lastError = 'Re-login: ' + (e.message || '').substring(0, 60); }
    }

    return { success: false, dmSent: false, deliveryMsg: 'FB: ' + lastError, remainingToday: MAX_PER_DAY - sentToday };
  }

  // ===== TIKTOK =====
  if (platform === 'tiktok') {
    try {
      var ttCode = makeTTDmCode(username, message, cookies);
      var ttResult = await runOnBrowserless(ttCode, 45000);
      if (ttResult && ttResult.dmSent) return { success: true, dmSent: true, deliveryMsg: ttResult.deliveryMsg, source: 'browserless', remainingToday: MAX_PER_DAY - sentToday - 1 };
      lastError = (ttResult && ttResult.deliveryMsg) || 'Browserless falhou';
    } catch(e: any) { lastError = (e.message || 'timeout').substring(0, 80); }

    if (loginUsername && loginPassword) {
      try {
        var ttLogin = await automateLogin('tiktok', loginUsername, loginPassword);
        if (ttLogin.success && ttLogin.cookiesJson) {
          try {
            var ttRetry = await runOnBrowserless(makeTTDmCode(username, message, ttLogin.cookiesJson), 45000);
            if (ttRetry && ttRetry.dmSent) return { success: true, dmSent: true, deliveryMsg: ttRetry.deliveryMsg, source: 'browserless-relogin', remainingToday: MAX_PER_DAY - sentToday - 1 };
            lastError = (ttRetry && ttRetry.deliveryMsg) || 'Falhou apos re-login';
          } catch(e2: any) { lastError = (e2.message || 'timeout').substring(0, 80); }
        }
      } catch(e: any) { lastError = 'Re-login: ' + (e.message || '').substring(0, 60); }
    }

    return { success: false, dmSent: false, deliveryMsg: 'TT: ' + lastError, remainingToday: MAX_PER_DAY - sentToday };
  }

  return { success: false, dmSent: false, deliveryMsg: 'Plataforma desconhecida', remainingToday: MAX_PER_DAY - sentToday };
}

/* ===== POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  if (body.action === 'diagnostic') return NextResponse.json(await runDiagnostic());

  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    if (!body.username) return NextResponse.json({ success: false, error: 'Username obrigatorio' });
    if (!body.password && platform !== 'tiktok') return NextResponse.json({ success: false, error: 'Password obrigatoria' });
    return NextResponse.json(await automateLogin(platform, body.username, body.password || ''));
  }

  // NOVA: Set cookies manualmente (bypass captcha)
  if (body.action === 'set-cookies') {
    var platform = body.platform || 'instagram';
    var sessionid = body.sessionid || '';
    var csrftoken = body.csrftoken || '';
    if (!sessionid || !csrftoken) return NextResponse.json({ success: false, error: 'sessionid e csrftoken obrigatorios' });
    // Testar se as cookies sao validas
    if (platform === 'instagram') {
      try {
        var dsUserId = sessionid.split('%3A')[0] || '';
        var cookies = 'sessionid=' + sessionid + '; csrftoken=' + csrftoken + '; ds_user_id=' + dsUserId;
        var testRes = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram', {
          headers: { 'Cookie': cookies, 'X-IG-App-ID': '936619743392459', 'X-CSRFToken': csrftoken, 'User-Agent': BL_UA }
        });
        if (testRes.ok) {
          var testData = await testRes.json();
          var loggedInUser = testData.data && testData.data.user && testData.data.user.username;
          if (loggedInUser) {
            return NextResponse.json({
              success: true,
              sessionid: sessionid,
              csrftoken: csrftoken,
              cookiesJson: JSON.stringify([
                { name: 'sessionid', value: sessionid, domain: '.instagram.com', path: '/' },
                { name: 'csrftoken', value: csrftoken, domain: '.instagram.com', path: '/' },
                { name: 'ds_user_id', value: dsUserId, domain: '.instagram.com', path: '/' }
              ]),
              message: 'Cookies validas! Logado como @' + loggedInUser
            });
          }
        }
        return NextResponse.json({ success: false, error: 'Cookies invalidas ou expiradas (HTTP ' + testRes.status + ')' });
      } catch(e: any) { return NextResponse.json({ success: false, error: 'Erro ao testar: ' + (e.message || '').substring(0, 100) }); }
    }
    // Para FB/TT: simplesmente guardar
    return NextResponse.json({ success: true, sessionid: sessionid, csrftoken: csrftoken, message: 'Cookies guardadas para ' + platform });
  }

  // Enviar DM
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;
  if (!dmUsername) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  if (sentToday >= MAX_PER_DAY) return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido', remainingToday: 0 });

  var result = await robustSend(dmPlatform, dmUsername, dmMessage, body.cookies || '', body.sessionid || '', body.csrftoken || '', body.loginUsername || '', body.loginPassword || '', sentToday);
  return NextResponse.json(result);
}

/* ===== GET ===== */
export async function GET() {
  var blOnline = await checkBrowserless();
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY, browserless: { online: blOnline } });
}