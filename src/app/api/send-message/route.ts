import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  Usa Browserless HTTP REST API (/function) em vez de WSS
//  Vercel Free Plan NÃO suporta WebSocket de saída
//  Browserless /function usa ES Modules — formato:
//    async ({ browser }) => { ... return result; }
// ============================================================

export var maxDuration = 60;

var MAX_PER_DAY = 30;

/* ===== BROWSERLESS CONFIG ===== */
var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function sleep(ms: number) { return new Promise(function(r) { setTimeout(r, ms); }); }

/* ================================================================
   CORE: Executar código Playwright no Browserless via HTTP POST
   Nenhum WebSocket é usado — tudo é HTTP puro.
   O browser corre no servidor do Browserless, não no Vercel.

   FORMATO DO CÓDIGO (ES Modules):
     async ({ browser }) => {
       const context = await browser.newContext({...});
       const page = await context.newPage();
       // ... operações
       await context.close();
       return { result: '...' };
     }

   Browserless injecta { browser, context, page } automaticamente.
   ================================================================ */
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

    // Se Browserless retornar HTML (página de erro), lançar erro claro
    var ct = (response.headers.get('content-type') || '').toLowerCase();
    if (ct.indexOf('text/html') >= 0 || ct.indexOf('text/plain') >= 0) {
      var html = await response.text();
      throw new Error('Browserless retornou HTML (HTTP ' + response.status + '): ' + html.substring(0, 150));
    }

    if (!response.ok) {
      var errBody = await response.text().catch(function() { return ''; });
      throw new Error('Browserless HTTP ' + response.status + ': ' + errBody.substring(0, 300));
    }

    var data = await response.json();
    return data;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error('Timeout ao conectar com Browserless (' + timeoutMs + 'ms)');
    }
    throw e;
  }
}

/* ===== BROWSERLESS HEALTH CHECK (HTTP puro) ===== */
async function checkBrowserless(): Promise<boolean> {
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 8000);
    var res = await fetch(BL_HTTP + '/json/version?token=' + BL_TOKEN, { signal: ctrl.signal });
    clearTimeout(tid);
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ===== DIAGNÓSTICO ===== */
async function runDiagnostic() {
  var diag: any = { steps: [], browserless: false, functionApi: false, browserNav: false };

  // Step 1: HTTP health check
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

  // Step 2: Test /function endpoint (sem browser, só eval)
  try {
    var simpleCode = 'async () => ({ ok: true, ts: Date.now() })';
    var testResult = await runOnBrowserless(simpleCode, 15000);
    diag.functionApi = testResult && testResult.ok === true;
    diag.steps.push({ step: 'Function API (sem browser)', ok: diag.functionApi, result: JSON.stringify(testResult).substring(0, 100) });
  } catch(e: any) {
    diag.steps.push({ step: 'Function API (sem browser)', ok: false, error: (e.message || 'unknown').substring(0, 200) });
  }

  // Step 3: Test browser real no Browserless
  try {
    var navCode = 'async ({ browser }) => {' +
      'const context = await browser.newContext({ userAgent: ' + JSON.stringify(BL_UA) + ' });' +
      'const page = await context.newPage();' +
      'await page.goto("https://example.com", { timeout: 10000 });' +
      'const title = await page.title();' +
      'await context.close();' +
      'return { ok: true, title: title };' +
    '}';
    var navResult = await runOnBrowserless(navCode, 25000);
    diag.browserNav = navResult && navResult.ok === true;
    diag.steps.push({ step: 'Browser navigation', ok: diag.browserNav, title: (navResult && navResult.title) || '' });
  } catch(e: any) {
    diag.steps.push({ step: 'Browser navigation', ok: false, error: (e.message || 'unknown').substring(0, 200) });
  }

  return diag;
}

/* ================================================================
   LOGIN AUTOMATION VIA BROWSERLESS HTTP
   Formato: async ({ browser }) => { ... return result; }
   ================================================================ */
async function automateLogin(platform: string, username: string, password: string) {
  try {
    var u = JSON.stringify(username);
    var p = JSON.stringify(password);
    var ua = JSON.stringify(BL_UA);

    var code = '';

    if (platform === 'instagram') {
      code = 'async ({ browser }) => {' +
        'var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        'var page = await context.newPage();' +
        'await page.goto("https://www.instagram.com/accounts/login/", { timeout: 15000 }).catch(function() {});' +
        'await new Promise(function(r) { setTimeout(r, 3000); });' +
        'await page.fill(\'input[name="username"]\', ' + u + ');' +
        'await page.fill(\'input[name="password"]\', ' + p + ');' +
        'await page.click(\'div[role="button"]:has-text("Log in")\');' +
        'await new Promise(function(r) { setTimeout(r, 6000); });' +
        'var urlNow = page.url();' +
        'if (urlNow.indexOf("/accounts/login") >= 0) {' +
        '  await context.close();' +
        '  return { success: false, error: "Login falhou - credenciais invalidas ou captcha" };' +
        '}' +
        'try { await page.click(\'div[role="button"]:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}' +
        'try { await page.click(\'button:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}' +
        'await new Promise(function(r) { setTimeout(r, 2000); });' +
        'var cookies = await context.cookies();' +
        'var cookiesJson = JSON.stringify(cookies);' +
        'var sessionid = "", csrftoken = "";' +
        'for (var i = 0; i < cookies.length; i++) {' +
        '  if (cookies[i].name === "sessionid") sessionid = cookies[i].value;' +
        '  if (cookies[i].name === "csrftoken") csrftoken = cookies[i].value;' +
        '}' +
        'await context.close();' +
        'return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: "Login Instagram feito com sucesso" };' +
      '}';
    } else if (platform === 'tiktok') {
      code = 'async ({ browser }) => {' +
        'var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        'var page = await context.newPage();' +
        'await page.goto("https://www.tiktok.com/login", { timeout: 15000 }).catch(function() {});' +
        'await new Promise(function(r) { setTimeout(r, 3000); });' +
        'try { await page.click("text=Use phone / email / username"); } catch(e) {}' +
        'await new Promise(function(r) { setTimeout(r, 1000); });' +
        'await page.fill(\'input[type="text"]\', ' + u + ');' +
        'await page.fill(\'input[type="password"]\', ' + p + ');' +
        'try { await page.click(\'button[type="submit"]\'); } catch(e) { try { await page.click(\'div[role="button"]:has-text("Log in")\'); } catch(e2) { await page.keyboard.press("Enter"); } }' +
        'await new Promise(function(r) { setTimeout(r, 6000); });' +
        'var cookies = await context.cookies();' +
        'var cookiesJson = JSON.stringify(cookies);' +
        'var sessionid = "", csrftoken = "";' +
        'for (var i = 0; i < cookies.length; i++) {' +
        '  if (cookies[i].name === "sessionid") sessionid = cookies[i].value;' +
        '  if (cookies[i].name === "tt_csrf_token") csrftoken = cookies[i].value;' +
        '}' +
        'await context.close();' +
        'if (sessionid) {' +
        '  return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: "Login TikTok feito com sucesso" };' +
        '}' +
        'return { success: false, error: "Login TikTok falhou - verifica credenciais" };' +
      '}';
    } else if (platform === 'facebook') {
      code = 'async ({ browser }) => {' +
        'var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        'var page = await context.newPage();' +
        'await page.goto("https://www.facebook.com/login", { timeout: 15000 }).catch(function() {});' +
        'await new Promise(function(r) { setTimeout(r, 3000); });' +
        'await page.fill(\'input[id="email"]\', ' + u + ');' +
        'await page.fill(\'input[id="pass"]\', ' + p + ');' +
        'await page.click(\'button[name="login"]\');' +
        'await new Promise(function(r) { setTimeout(r, 6000); });' +
        'try { await page.click(\'button:has-text("Not Now")\', { timeout: 2000 }); await new Promise(function(r) { setTimeout(r, 500); }); } catch(e) {}' +
        'var cookies = await context.cookies();' +
        'var cookiesJson = JSON.stringify(cookies);' +
        'var fbToken = "";' +
        'for (var i = 0; i < cookies.length; i++) {' +
        '  if (cookies[i].name === "datr") fbToken = cookies[i].value;' +
        '}' +
        'await context.close();' +
        'return { success: true, fbToken: fbToken, cookiesJson: cookiesJson, message: "Login Facebook feito com sucesso" };' +
      '}';
    } else {
      return { success: false, error: 'Plataforma nao suportada: ' + platform };
    }

    var result = await runOnBrowserless(code, 45000);
    return result;
  } catch (e: any) {
    return { success: false, error: 'Erro Browserless HTTP: ' + (e.message || 'timeout') };
  }
}

/* ================================================================
   SEND DM VIA BROWSERLESS HTTP
   Formato: async ({ browser }) => { ... return result; }
   ================================================================ */
async function sendDMViaBrowserless(platform: string, targetUsername: string, message: string, cookiesJson: string, attempt: number) {
  try {
    var target = JSON.stringify(targetUsername);
    var msg = JSON.stringify(message);
    var ua = JSON.stringify(BL_UA);
    var cookies = cookiesJson ? JSON.stringify(cookiesJson) : 'null';

    var code = '';

    if (platform === 'instagram') {
      code = 'async ({ browser }) => {' +
        'try {' +
        '  var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        '  if (' + cookies + ') { try { await context.addCookies(JSON.parse(' + cookies + ')); } catch(e) {} }' +
        '  var page = await context.newPage();' +

        // METHOD A: Direct new message flow
        '  await page.goto("https://www.instagram.com/direct/new/", { timeout: 15000 });' +
        '  await new Promise(function(r) { setTimeout(r, 2000); });' +
        '  await page.fill(\'input[placeholder="Search..."]\', ' + target + ');' +
        '  await new Promise(function(r) { setTimeout(r, 2500); });' +
        '  var clicked = false;' +
        '  try {' +
        '    await page.click(\'div[role="option"]\', { timeout: 3000 });' +
        '    clicked = true;' +
        '    await new Promise(function(r) { setTimeout(r, 1000); });' +
        '    await page.click(\'div[role="dialog"] button:not([disabled])\');' +
        '    await new Promise(function(r) { setTimeout(r, 1000); });' +
        '    await page.keyboard.type(' + msg + ');' +
        '    await new Promise(function(r) { setTimeout(r, 500); });' +
        '    await page.keyboard.press("Enter");' +
        '    await new Promise(function(r) { setTimeout(r, 2000); });' +
        '    await context.close();' +
        '    return { dmSent: true, deliveryMsg: "DM enviado via Browserless (new msg)" };' +
        '  } catch(e) {' +
        '    if (!clicked) {' +
        // METHOD B: Profile message button
        '      try {' +
        '        await page.goto("https://www.instagram.com/" + ' + target + ' + "/", { timeout: 10000 });' +
        '        await new Promise(function(r) { setTimeout(r, 1500); });' +
        '        var msgBtn = await page.$(\'button:has-text("Message")\');' +
        '        if (!msgBtn) msgBtn = await page.$(\'div[role="button"]:has-text("Message")\');' +
        '        if (msgBtn) {' +
        '          await msgBtn.click();' +
        '          await new Promise(function(r) { setTimeout(r, 2000); });' +
        '          await page.keyboard.type(' + msg + ');' +
        '          await new Promise(function(r) { setTimeout(r, 500); });' +
        '          await page.keyboard.press("Enter");' +
        '          await new Promise(function(r) { setTimeout(r, 2000); });' +
        '          await context.close();' +
        '          return { dmSent: true, deliveryMsg: "DM enviado via Browserless (profile msg btn)" };' +
        '        }' +
        '      } catch(e2) {}' +
        '    }' +
        '    await context.close();' +
        '    return { dmSent: false, deliveryMsg: "Nao conseguiu abrir conversa IG (tentativa ' + attempt + '): " + (e.message || "").substring(0, 80) };' +
        '  }' +
        '} catch(err) {' +
        '  return { dmSent: false, deliveryMsg: "Erro Browserless (tentativa ' + attempt + '): " + (err.message || "timeout").substring(0, 80) };' +
        '}' +
      '}';
    } else if (platform === 'tiktok') {
      code = 'async ({ browser }) => {' +
        'try {' +
        '  var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        '  if (' + cookies + ') { try { await context.addCookies(JSON.parse(' + cookies + ')); } catch(e) {} }' +
        '  var page = await context.newPage();' +

        // METHOD A: Profile message button
        '  await page.goto("https://www.tiktok.com/@" + ' + target + ', { timeout: 15000 });' +
        '  await new Promise(function(r) { setTimeout(r, 2500); });' +
        '  var msgBtn = await page.$(\'div[data-e2e="profile-message-button"]\');' +
        '  if (msgBtn) {' +
        '    await msgBtn.click();' +
        '    await new Promise(function(r) { setTimeout(r, 2000); });' +
        '    var ta = await page.$(\'div[contenteditable="true"]\');' +
        '    if (ta) {' +
        '      await ta.click();' +
        '      await page.keyboard.type(' + msg + ');' +
        '      await new Promise(function(r) { setTimeout(r, 500); });' +
        '      await page.keyboard.press("Enter");' +
        '      await new Promise(function(r) { setTimeout(r, 2000); });' +
        '      await context.close();' +
        '      return { dmSent: true, deliveryMsg: "DM TikTok enviado via Browserless (profile btn)" };' +
        '    }' +
        '  }' +

        // METHOD B: Header buttons
        '  await page.goto("https://www.tiktok.com/@" + ' + target + ', { timeout: 10000 });' +
        '  await new Promise(function(r) { setTimeout(r, 2000); });' +
        '  var btns = await page.$$("header button, header div[role=\\"button\\"]");' +
        '  for (var bi = 0; bi < btns.length; bi++) {' +
        '    var txt = await btns[bi].textContent();' +
        '    if (txt && (txt.indexOf("Message") >= 0 || txt.indexOf("Mensagem") >= 0)) {' +
        '      await btns[bi].click();' +
        '      await new Promise(function(r) { setTimeout(r, 2000); });' +
        '      var ta2 = await page.$(\'div[contenteditable="true"]\');' +
        '      if (ta2) {' +
        '        await ta2.click();' +
        '        await page.keyboard.type(' + msg + ');' +
        '        await new Promise(function(r) { setTimeout(r, 500); });' +
        '        await page.keyboard.press("Enter");' +
        '        await new Promise(function(r) { setTimeout(r, 2000); });' +
        '        await context.close();' +
        '        return { dmSent: true, deliveryMsg: "DM TikTok enviado via Browserless (header btn)" };' +
        '      }' +
        '    }' +
        '  }' +

        '  await context.close();' +
        '  return { dmSent: false, deliveryMsg: "Erro ao enviar DM TikTok (tentativa ' + attempt + ')" };' +
        '} catch(err) {' +
        '  return { dmSent: false, deliveryMsg: "Erro Browserless TikTok (tentativa ' + attempt + '): " + (err.message || "timeout").substring(0, 80) };' +
        '}' +
      '}';
    } else if (platform === 'facebook') {
      code = 'async ({ browser }) => {' +
        'try {' +
        '  var context = await browser.newContext({ userAgent: ' + ua + ', viewport: { width: 375, height: 812 } });' +
        '  if (' + cookies + ') { try { await context.addCookies(JSON.parse(' + cookies + ')); } catch(e) {} }' +
        '  var page = await context.newPage();' +

        // METHOD A: Direct message URL
        '  await page.goto("https://www.facebook.com/messages/t/" + ' + target + ', { timeout: 15000 });' +
        '  await new Promise(function(r) { setTimeout(r, 3000); });' +
        '  var msgArea = await page.$(\'div[aria-label="Message"], div[contenteditable="true"][role="textbox"]\');' +
        '  if (msgArea) {' +
        '    await msgArea.click();' +
        '    await page.keyboard.type(' + msg + ');' +
        '    await new Promise(function(r) { setTimeout(r, 500); });' +
        '    await page.keyboard.press("Enter");' +
        '    await new Promise(function(r) { setTimeout(r, 2000); });' +
        '    await context.close();' +
        '    return { dmSent: true, deliveryMsg: "DM Facebook enviado via Browserless (direct URL)" };' +
        '  }' +

        // METHOD B: New message flow
        '  await page.goto("https://www.facebook.com/messages/", { timeout: 10000 });' +
        '  await new Promise(function(r) { setTimeout(r, 2000); });' +
        '  var newMsgBtn = await page.$(\'a[href*="/messages/new/"], div[role="button"]:has-text("New message"), div[role="button"]:has-text("Nova mensagem")\');' +
        '  if (newMsgBtn) {' +
        '    await newMsgBtn.click();' +
        '    await new Promise(function(r) { setTimeout(r, 2000); });' +
        '    var toField = await page.$(\'input[aria-label*="To"], input[placeholder*="para"], input[placeholder*="To"]\');' +
        '    if (toField) {' +
        '      await toField.fill(' + target + ');' +
        '      await new Promise(function(r) { setTimeout(r, 2500); });' +
        '      await page.click(\'ul[role="listbox"] li:first-child, div[role="option"]:first-child\', { timeout: 3000 });' +
        '      await new Promise(function(r) { setTimeout(r, 1000); });' +
        '      var msgBox = await page.$(\'div[contenteditable="true"][role="textbox"], div[aria-label="Message"]\');' +
        '      if (msgBox) {' +
        '        await msgBox.click();' +
        '        await page.keyboard.type(' + msg + ');' +
        '        await new Promise(function(r) { setTimeout(r, 500); });' +
        '        await page.keyboard.press("Enter");' +
        '        await new Promise(function(r) { setTimeout(r, 2000); });' +
        '        await context.close();' +
        '        return { dmSent: true, deliveryMsg: "DM Facebook enviado via Browserless (new msg)" };' +
        '      }' +
        '    }' +
        '  }' +

        '  await context.close();' +
        '  return { dmSent: false, deliveryMsg: "Erro ao enviar DM Facebook (tentativa ' + attempt + ')" };' +
        '} catch(err) {' +
        '  return { dmSent: false, deliveryMsg: "Erro Browserless FB (tentativa ' + attempt + '): " + (err.message || "timeout").substring(0, 80) };' +
        '}' +
      '';
    } else {
      return { dmSent: false, deliveryMsg: 'Plataforma nao suportada' };
    }

    var result = await runOnBrowserless(code, 45000);
    return result;
  } catch (e: any) {
    return { dmSent: false, deliveryMsg: 'Erro Browserless HTTP (tentativa ' + attempt + '): ' + (e.message || 'timeout').substring(0, 80) };
  }
}

/* ===== API DIRECT DM (Instagram only — sem browser, HTTP puro) ===== */
function attemptInstagramDirectDM(username: string, message: string, sessionid: string, csrftoken: string) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var cookies = 'sessionid=' + sessionid + '; csrftoken=' + csrftoken + '; ds_user_id=' + dsUserId;

  return fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + username, {
    headers: {
      'Cookie': cookies,
      'X-IG-App-ID': '936619743392459',
      'X-CSRFToken': csrftoken,
      'User-Agent': BL_UA,
      'X-Requested-With': 'XMLHttpRequest'
    }
  }).then(function(profileRes) {
    if (!profileRes.ok) return { dmSent: false, deliveryMsg: 'Perfil IG nao encontrado (HTTP ' + profileRes.status + ')' };
    return profileRes.json().then(function(profileData) {
      var userData = profileData.data && profileData.data.user;
      var userId = userData && (userData.pk || userData.id);
      if (!userId) return { dmSent: false, deliveryMsg: 'User ID nao encontrado' };
      var clientContext = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      return fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
        method: 'POST',
        headers: {
          'Cookie': cookies, 'X-CSRFToken': csrftoken,
          'X-IG-App-ID': '936619743392459',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': BL_UA,
          'X-Requested-With': 'XMLHttpRequest', 'X-IG-WWW-Claim': '0'
        },
        body: new URLSearchParams({
          recipient_users: '[[%7B' + userId + '%7D]]',
          text: message, client_context: clientContext,
          action: 'send_item', thread_ids: '["0"]', platform: 'android'
        }).toString()
      }).then(function(dmRes) {
        if (dmRes.ok) return { dmSent: true, deliveryMsg: 'DM IG enviado (API directa)' };
        return dmRes.text().then(function(txt) {
          return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status + ': ' + txt.substring(0, 120) };
        }).catch(function() { return { dmSent: false, deliveryMsg: 'DM IG falhou HTTP ' + dmRes.status }; });
    }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro ao processar perfil IG' }; });
    });
  }).catch(function() { return { dmSent: false, deliveryMsg: 'Erro de conexao com Instagram' }; });
}

/* ===== ROBUST SEND WITH INTERNAL RETRY ===== */
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
          var result;
          if (method.name === 'Browserless') {
            result = await sendDMViaBrowserless(platform, username, message, cookies, cycle * 2 + attempt);
          } else {
            result = await method.fn();
          }
          if (result.dmSent) {
            return { success: true, dmSent: true, deliveryMsg: result.deliveryMsg, source: method.name.toLowerCase().replace(/ /g, '-'), remainingToday: MAX_PER_DAY - sentToday - 1 };
          }
          lastError = result.deliveryMsg || 'Metodo falhou';
        } catch(e: any) {
          lastError = method.name + ' excecao: ' + (e.message || '').substring(0, 60);
        }
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
        } else {
          lastError = 'Re-login falhou: ' + (loginResult.error || '');
        }
      } catch(e: any) {
        lastError = 'Re-login erro: ' + (e.message || '');
      }
    }

    if (sentToday >= MAX_PER_DAY) {
      return { success: false, dmSent: false, deliveryMsg: 'Limite diario atingido', remainingToday: 0 };
    }
  }

  return {
    success: false, dmSent: false,
    deliveryMsg: 'Todos os metodos falharam: ' + lastError,
    remainingToday: MAX_PER_DAY - sentToday
  };
}

/* ===== MAIN POST HANDLER ===== */
export async function POST(request: any) {
  var body;
  try {
    body = await request.json();
  } catch(e) {
    return NextResponse.json({ error: 'Body JSON invalido' }, { status: 400 });
  }

  // === ACTION: DIAGNOSTIC ===
  if (body.action === 'diagnostic') {
    var diag = await runDiagnostic();
    return NextResponse.json(diag);
  }

  // === ACTION: LOGIN ===
  if (body.action === 'login') {
    var platform = body.platform || 'instagram';
    var username = body.username || '';
    var password = body.password || '';
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username e password obrigatorios' });
    }
    var loginResult = await automateLogin(platform, username, password);
    return NextResponse.json(loginResult);
  }

  // === ACTION: SEND DM ===
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;
  var loginUsername = body.loginUsername || '';
  var loginPassword = body.loginPassword || '';

  if (!dmUsername) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  }

  if (sentToday >= MAX_PER_DAY) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido (' + MAX_PER_DAY + ')', remainingToday: 0 });
  }

  var cookies = body.cookies || '';
  var sessionid = body.sessionid || '';
  var csrftoken = body.csrftoken || '';

  var result = await robustSend(dmPlatform, dmUsername, dmMessage, cookies, sessionid, csrftoken, loginUsername, loginPassword, sentToday);
  return NextResponse.json(result);
}

/* ===== GET: STATUS ===== */
export async function GET() {
  var blOnline = await checkBrowserless();
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    browserless: { online: blOnline, mode: 'http-function-api-esm' }
  });
}