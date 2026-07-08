import { NextResponse } from 'next/server';
import { chromium } from 'playwright-core';

export var maxDuration = 60;

var MAX_PER_DAY = 30;

/* ===== BROWSERLESS CONFIG ===== */
var BL_TOKEN = process.env.BROWSERLESS_TOKEN || '2UqMn3vrQPAsFgGd027555e6ef8261d108a68d3114cbaeedf';
var BL_WSS = 'wss://production-sfo.browserless.io/chromium/playwright?token=' + BL_TOKEN;
var BL_HTTP = 'https://production-sfo.browserless.io';
var BL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.15.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

/* ===== BROWSERLESS HEALTH CHECK ===== */
async function checkBrowserless() {
  try {
    var ctrl = new AbortController();
    var tid = setTimeout(function() { ctrl.abort(); }, 8000);
    var res = await fetch(BL_HTTP + '/content?token=' + BL_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    return res.ok;
  } catch (e) {
    return false;
  }
}

/* ===== LOGIN AUTOMATION VIA BROWSERLESS ===== */
async function automateLogin(platform, username, password) {
  var browser = null;
  try {
    browser = await chromium.connect(BL_WSS, { timeout: 12000 });
    var context = browser.contexts()[0];
    var page = context.pages()[0] || await context.newPage();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.setExtraHTTPHeaders({ 'User-Agent': BL_UA });

    if (platform === 'instagram') {
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await sleep(6000);

      var urlNow = page.url();
      if (urlNow.indexOf('/accounts/login') >= 0) {
        await browser.close();
        return { success: false, error: 'Login falhou - credenciais invalidas ou captcha' };
      }

      await sleep(2000);
      var cookies = await context.cookies();
      var cookiesJson = JSON.stringify(cookies);
      var sessionid = '', csrftoken = '';
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].name === 'sessionid') sessionid = cookies[i].value;
        if (cookies[i].name === 'csrftoken') csrftoken = cookies[i].value;
      }

      await browser.close();
      return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: 'Login Instagram feito com sucesso' };
    }

    if (platform === 'tiktok') {
      await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      try { await page.click('text=Use phone / email / username'); } catch(e) {}
      await sleep(1000);

      await page.fill('input[type="text"]', username);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await sleep(6000);

      var cookies = await context.cookies();
      var cookiesJson = JSON.stringify(cookies);
      var sessionid = '', csrftoken = '';
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].name === 'sessionid') sessionid = cookies[i].value;
        if (cookies[i].name === 'tt_csrf_token') csrftoken = cookies[i].value;
      }

      await browser.close();
      if (sessionid) {
        return { success: true, sessionid: sessionid, csrftoken: csrftoken, cookiesJson: cookiesJson, message: 'Login TikTok feito com sucesso' };
      }
      return { success: false, error: 'Login TikTok falhou - verifica credenciais' };
    }

    if (platform === 'facebook') {
      await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      await page.fill('input[id="email"]', username);
      await page.fill('input[id="pass"]', password);
      await page.click('button[name="login"]');
      await sleep(6000);

      var cookies = await context.cookies();
      var cookiesJson = JSON.stringify(cookies);
      var fbToken = '';
      for (var i = 0; i < cookies.length; i++) {
        if (cookies[i].name === 'datr') fbToken = cookies[i].value;
      }

      await browser.close();
      return { success: true, fbToken: fbToken, cookiesJson: cookiesJson, message: 'Login Facebook feito com sucesso' };
    }

    await browser.close();
    return { success: false, error: 'Plataforma nao suportada: ' + platform };
  } catch (e) {
    if (browser) { try { browser.close(); } catch(ex) {} }
    return { success: false, error: 'Erro Browserless: ' + (e.message || 'timeout') };
  }
}

/* ===== SEND DM VIA BROWSERLESS ===== */
async function sendDMViaBrowserless(platform, username, message, cookiesJson) {
  var browser = null;
  try {
    browser = await chromium.connect(BL_WSS, { timeout: 12000 });
    var context = browser.contexts()[0];
    var page = context.pages()[0] || await context.newPage();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.setExtraHTTPHeaders({ 'User-Agent': BL_UA });

    if (cookiesJson) {
      var cookies = JSON.parse(cookiesJson);
      if (cookies.length > 0) await context.addCookies(cookies);
    }

    if (platform === 'instagram') {
      await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      await page.fill('input[placeholder="Search..."]', username);
      await sleep(2000);

      try {
        await page.click('div[role="option"]', { timeout: 3000 });
        await sleep(1000);
        await page.click('div[role="dialog"] button:not([disabled])');
        await sleep(1000);
        await page.keyboard.type(message);
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await browser.close();
        return { dmSent: true, deliveryMsg: 'DM enviado via Browserless' };
      } catch(e) {
        await browser.close();
        return { dmSent: false, deliveryMsg: 'Nao conseguiu abrir conversa: ' + (e.message || '') };
      }
    }

    if (platform === 'tiktok') {
      await page.goto('https://www.tiktok.com/@' + username, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      try {
        var msgBtn = await page.$('div[data-e2e="profile-message-button"]');
        if (msgBtn) await msgBtn.click();
        await sleep(2000);
        await page.keyboard.type(message);
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await browser.close();
        return { dmSent: true, deliveryMsg: 'DM TikTok enviado via Browserless' };
      } catch(e) {
        await browser.close();
        return { dmSent: false, deliveryMsg: 'Erro ao enviar DM TikTok: ' + (e.message || '') };
      }
    }

    if (platform === 'facebook') {
      await page.goto('https://www.facebook.com/messages/t/' + username, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      try {
        await page.keyboard.type(message);
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await browser.close();
        return { dmSent: true, deliveryMsg: 'DM Facebook enviado via Browserless' };
      } catch(e) {
        await browser.close();
        return { dmSent: false, deliveryMsg: 'Erro ao enviar DM Facebook: ' + (e.message || '') };
      }
    }

    await browser.close();
    return { dmSent: false, deliveryMsg: 'Plataforma nao suportada' };
  } catch (e) {
    if (browser) { try { browser.close(); } catch(ex) {} }
    return { dmSent: false, deliveryMsg: 'Erro Browserless: ' + (e.message || 'timeout') };
  }
}

/* ===== API DIRECT DM (Instagram only, fastest) ===== */
function attemptInstagramDirectDM(username, message, sessionid, csrftoken) {
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

/* ===== MAIN POST HANDLER ===== */
export async function POST(request) {
  var body = await request.json();

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

  if (!dmUsername) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Username nao fornecido', remainingToday: MAX_PER_DAY - sentToday });
  }

  // Check daily limit
  if (sentToday >= MAX_PER_DAY) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Limite diario atingido (' + MAX_PER_DAY + ')', remainingToday: 0 });
  }

  var cookies = body.cookies || '';
  var sessionid = body.sessionid || '';
  var csrftoken = body.csrftoken || '';
  var fbToken = body.fbToken || '';

  // === PRIORIDADE 1: API Directa (so Instagram, instantaneo) ===
  if (dmPlatform === 'instagram' && sessionid && csrftoken) {
    try {
      var directResult = await attemptInstagramDirectDM(dmUsername, dmMessage, sessionid, csrftoken);
      if (directResult.dmSent) {
        return NextResponse.json({ success: true, dmSent: true, deliveryMsg: directResult.deliveryMsg, source: 'api-direct', remainingToday: MAX_PER_DAY - sentToday - 1 });
      }
      // API falhou, tenta browserless como fallback
    } catch(e) { /* fallback to browserless */ }
  }

  // === PRIORIDADE 2: Browserless (todas as plataformas) ===
  var blResult = await sendDMViaBrowserless(dmPlatform, dmUsername, dmMessage, cookies || undefined);
  if (blResult.dmSent) {
    return NextResponse.json({ success: true, dmSent: true, deliveryMsg: blResult.deliveryMsg, source: 'browserless', remainingToday: MAX_PER_DAY - sentToday - 1 });
  }

  // === NENHUM FUNCIONOU ===
  return NextResponse.json({
    success: false, dmSent: false,
    deliveryMsg: blResult.deliveryMsg || 'Todos os metodos falharam',
    remainingToday: MAX_PER_DAY - sentToday
  });
}

/* ===== GET: STATUS / HEALTH CHECK ===== */
export async function GET() {
  var blOnline = await checkBrowserless();
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    browserless: { online: blOnline }
  });
}