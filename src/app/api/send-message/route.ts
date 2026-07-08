import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API
//  Browserless /function API (HTTP, sem WebSocket)
//
//  FORMATO: export default async function({ page }) { ... }
//  APENAS page.goto, page.evaluate, page.title, page.url, page.browserContext
//  NAO USA: page.fill, page.click, page.$, page.keyboard (nao existem)
//  Em vez disso usa evalFill, evalClick, evalExists etc via page.evaluate
// ============================================================

export var maxDuration = 60;
var MAX_PER_DAY = 30;

var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/* ===== CORE: POST code to Browserless ===== */
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

/* ===== UA OVERRIDE SNIPPET ===== */
var UA_OVERRIDE = 'await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, "userAgent", { get: () => ' + JSON.stringify(BL_UA) + ' }); });';

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
  if (platform === 'instagram') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  await page.goto(\"https://www.instagram.com/accounts/login/\", { timeout: 15000 });\n  await evalSleep(4000);\n  var hasForm = await evalExists(page, 'input[name=\"username\"]');\n  if (!hasForm) {\n    // Try alternative: maybe showing consent page or different layout\n    var hasAnyInput = await evalExists(page, 'input');\n    if (!hasAnyInput) {\n      return { success: false, error: \"Instagram nao mostrou formulario de login (possible block/captcha). Tenta novamente mais tarde ou muda de IP.\" };\n    }\n  }\n  await evalFill(page, 'input[name=\"username\"]', USERNAME_PLACEHOLDER);\n  await evalFill(page, 'input[name=\"password\"]', PASSWORD_PLACEHOLDER);\n  await evalClick(page, 'div[role=\"button\"]');\n  // Also try clicking any \"Log in\" text button\n  await evalClickText(page, 'Log in');\n  await evalSleep(7000);\n  var urlNow = page.url();\n  if (urlNow.indexOf(\"/accounts/login\") >= 0) {\n    // Check for error message\n    var errMsg = await page.evaluate(function() {\n      var el = document.getElementById('slfErrorAlert');\n      return el ? el.textContent : '';\n    }).catch(function() { return ''; });\n    return { success: false, error: \"Login IG falhou\" + (errMsg ? \": \" + errMsg.trim().substring(0, 100) : \" - credenciais invalidas ou captcha\") };\n  }\n  try { await evalClickText(page, 'Not Now'); await evalSleep(500); } catch(e) {}\n  try { await evalClickText(page, 'Not Now'); await evalSleep(500); } catch(e) {}\n  await evalSleep(2000);\n  var cookies = await evalGetCookies(page);\n  var sessionid = evalExtractCookie(cookies, 'sessionid');\n  var csrftoken = evalExtractCookie(cookies, 'csrftoken');\n  return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: JSON.stringify(cookies), message: \"Login Instagram feito com sucesso\" };\n}";
  if (platform === 'tiktok') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  await page.goto(\"https://www.tiktok.com/login\", { timeout: 15000 });\n  await evalSleep(3000);\n  await evalClickText(page, 'Use phone / email / username');\n  await evalSleep(1000);\n  await evalFill(page, 'input[type=\"text\"]', USERNAME_PLACEHOLDER);\n  await evalFill(page, 'input[type=\"password\"]', PASSWORD_PLACEHOLDER);\n  await evalPressEnter(page);\n  await evalSleep(7000);\n  var cookies = await evalGetCookies(page);\n  var sessionid = evalExtractCookie(cookies, 'sessionid');\n  var csrftoken = evalExtractCookie(cookies, 'tt_csrf_token');\n  if (sessionid) {\n    return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: JSON.stringify(cookies), message: \"Login TikTok feito com sucesso\" };\n  }\n  return { success: false, error: \"Login TikTok falhou - verifica credenciais\" };\n}";
  if (platform === 'facebook') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  await page.goto(\"https://www.facebook.com/login\", { timeout: 15000 });\n  await evalSleep(3000);\n  await evalFill(page, 'input[id=\"email\"]', USERNAME_PLACEHOLDER);\n  await evalFill(page, 'input[id=\"pass\"]', PASSWORD_PLACEHOLDER);\n  await evalClick(page, 'button[name=\"login\"]');\n  await evalSleep(7000);\n  try { await evalClickText(page, 'Not Now'); await evalSleep(500); } catch(e) {}\n  var cookies = await evalGetCookies(page);\n  var fbToken = evalExtractCookie(cookies, 'datr');\n  return { success: true, fbToken: fbToken, cookiesJson: JSON.stringify(cookies), message: \"Login Facebook feito com sucesso\" };\n}";
  return '';
}

/* ===== DM CODE GENERATORS ===== */
function makeDMCode(platform: string, targetUsername: string, message: string, cookiesJson: string, attempt: number): string {
  var target = JSON.stringify(targetUsername);
  var msg = JSON.stringify(message);
  var ck = cookiesJson ? JSON.stringify(cookiesJson) : 'null';
  if (platform === 'instagram') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  if (CK_PLACEHOLDER) {\n    try { var parsed = JSON.parse(CK_PLACEHOLDER); await evalSetCookies(page, parsed); } catch(e) {}\n  }\n  // METHOD A: New message flow\n  await page.goto(\"https://www.instagram.com/direct/new/\", { timeout: 15000 });\n  await evalSleep(2500);\n  var hasSearch = await evalExists(page, 'input[placeholder=\"Search...\"]');\n  if (hasSearch) {\n    await evalFill(page, 'input[placeholder=\"Search...\"]', TARGET_PLACEHOLDER);\n    await evalSleep(3000);\n    var clicked = await evalClick(page, 'div[role=\"option\"]');\n    if (clicked) {\n      await evalSleep(1000);\n      await evalClick(page, 'div[role=\"dialog\"] button:not([disabled])');\n      await evalSleep(1500);\n      await evalType(page, MSG_PLACEHOLDER);\n      await evalPressEnter(page);\n      await evalSleep(2500);\n      return { dmSent: true, deliveryMsg: \"DM IG enviado (new msg)\" };\n    }\n  }\n  // METHOD B: Profile message button\n  try {\n    await page.goto(\"https://www.instagram.com/\" + TARGET_PLACEHOLDER + \"/\", { timeout: 10000 });\n    await evalSleep(2000);\n    var msgClicked = await evalClickText(page, 'Message');\n    if (msgClicked) {\n      await evalSleep(2500);\n      await evalType(page, MSG_PLACEHOLDER);\n      await evalPressEnter(page);\n      await evalSleep(2500);\n      return { dmSent: true, deliveryMsg: \"DM IG enviado (profile btn)\" };\n    }\n  } catch(e2) {}\n  return { dmSent: false, deliveryMsg: \"Nao conseguiu abrir conversa IG (tentativa ATTEMPT_PLACEHOLDER)\" };\n}";
  if (platform === 'tiktok') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  if (CK_PLACEHOLDER) {\n    try { var parsed = JSON.parse(CK_PLACEHOLDER); await evalSetCookies(page, parsed); } catch(e) {}\n  }\n  await page.goto(\"https://www.tiktok.com/@\" + TARGET_PLACEHOLDER, { timeout: 15000 });\n  await evalSleep(3000);\n  var msgClicked = await evalClick(page, 'div[data-e2e=\"profile-message-button\"]');\n  if (msgClicked) {\n    await evalSleep(2500);\n    await evalClick(page, 'div[contenteditable=\"true\"]');\n    await evalSleep(500);\n    await evalType(page, MSG_PLACEHOLDER);\n    await evalPressEnter(page);\n    await evalSleep(2500);\n    return { dmSent: true, deliveryMsg: \"DM TikTok enviado (profile btn)\" };\n  }\n  return { dmSent: false, deliveryMsg: \"Erro DM TikTok (tentativa ATTEMPT_PLACEHOLDER)\" };\n}";
  if (platform === 'facebook') return "export default async function({ page }) {\n\nvar evalFill = async function(pg, sel, val) {\n  return await pg.evaluate(function(a) {\n    var el = document.querySelector(a.sel);\n    if (!el) return false;\n    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, a.val); else el.value = a.val;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      el.dispatchEvent(new Event('change', { bubbles: true }));\n    } else if (el.contentEditable === 'true') {\n      el.focus(); document.execCommand('selectAll', false, null);\n      document.execCommand('insertText', false, a.val);\n    }\n    return true;\n  }, { sel: sel, val: val });\n};\nvar evalClick = async function(pg, sel) {\n  return await pg.evaluate(function(s) {\n    var els = document.querySelectorAll(s);\n    if (els.length > 0) { els[0].click(); return true; } return false;\n  }, sel);\n};\nvar evalClickText = async function(pg, text) {\n  return await pg.evaluate(function(t) {\n    var els = document.querySelectorAll('div[role=\"button\"], button, a, span');\n    for (var i = 0; i < els.length; i++) {\n      if (els[i].textContent.trim().toLowerCase().indexOf(t.toLowerCase()) >= 0) {\n        els[i].click(); return true;\n      }\n    }\n    return false;\n  }, text);\n};\nvar evalExists = async function(pg, sel) {\n  return await pg.evaluate(function(s) { return !!document.querySelector(s); }, sel);\n};\nvar evalType = async function(pg, txt) {\n  return await pg.evaluate(function(t) {\n    var el = document.activeElement;\n    if (el && el.contentEditable === 'true') {\n      el.focus(); document.execCommand('insertText', false, t); return true;\n    }\n    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {\n      var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;\n      var s = Object.getOwnPropertyDescriptor(proto, 'value');\n      if (s && s.set) s.set.call(el, t); else el.value = t;\n      el.dispatchEvent(new Event('input', { bubbles: true }));\n      return true;\n    }\n    return false;\n  }, txt);\n};\nvar evalPressEnter = async function(pg) {\n  await pg.evaluate(function() {\n    var el = document.activeElement;\n    if (el) {\n      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));\n    }\n  });\n};\nvar evalSleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };\nvar evalGetCookies = async function(pg) {\n  var bc = pg.browserContext();\n  return await bc.cookies();\n};\nvar evalSetCookies = async function(pg, cookies) {\n  var bc = pg.browserContext();\n  for (var i = 0; i < cookies.length; i++) { await bc.setCookie(cookies[i]); }\n};\nvar evalExtractCookie = function(cookies, name) {\n  for (var i = 0; i < cookies.length; i++) { if (cookies[i].name === name) return cookies[i].value; }\n  return '';\n};\n\nawait page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, \"userAgent\", { get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }); });\n\n  if (CK_PLACEHOLDER) {\n    try { var parsed = JSON.parse(CK_PLACEHOLDER); await evalSetCookies(page, parsed); } catch(e) {}\n  }\n  await page.goto(\"https://www.facebook.com/messages/t/\" + TARGET_PLACEHOLDER, { timeout: 15000 });\n  await evalSleep(3500);\n  var msgArea = await evalClick(page, 'div[aria-label=\"Message\"], div[contenteditable=\"true\"][role=\"textbox\"]');\n  if (msgArea) {\n    await evalType(page, MSG_PLACEHOLDER);\n    await evalPressEnter(page);\n    await evalSleep(2500);\n    return { dmSent: true, deliveryMsg: \"DM Facebook enviado (direct URL)\" };\n  }\n  return { dmSent: false, deliveryMsg: \"Erro DM Facebook (tentativa ATTEMPT_PLACEHOLDER)\" };\n}";
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

/* ===== SEND DM VIA BROWSERLESS ===== */
async function sendDMViaBrowserless(platform: string, targetUsername: string, message: string, cookiesJson: string, attempt: number) {
  try {
    var code = makeDMCode(platform, targetUsername, message, cookiesJson, attempt);
    if (!code) return { dmSent: false, deliveryMsg: 'Plataforma nao suportada' };
    return await runOnBrowserless(code, 50000);
  } catch (e: any) {
    return { dmSent: false, deliveryMsg: 'Erro Browserless (tentativa ' + attempt + '): ' + (e.message || 'timeout').substring(0, 80) };
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
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY, browserless: { online: blOnline, mode: 'http-function-eval-only' } });
}
