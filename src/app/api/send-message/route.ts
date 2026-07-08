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
        // Check for "save login info" popup and dismiss it
        try {
          await page.click('button:has-text("Not Now")', { timeout: 2000 });
          await sleep(1000);
        } catch(e) {}
        await browser.close();
        return { success: false, error: 'Login falhou - credenciais invalidas ou captcha' };
      }

      // Dismiss "save login info" popup if it appears
      try {
        await page.click('button:has-text("Not Now")', { timeout: 2000 });
        await sleep(500);
      } catch(e) {}

      // Dismiss notifications popup
      try {
        await page.click('button:has-text("Not Now")', { timeout: 2000 });
        await sleep(500);
      } catch(e) {}

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

      // Handle potential "save device" popup
      try {
        await page.click('button:has-text("Not Now")', { timeout: 2000 });
        await sleep(500);
      } catch(e) {}

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

/* ===== SEND DM VIA BROWSERLESS (with internal retry) ===== */
async function sendDMViaBrowserless(platform, username, message, cookiesJson, attempt) {
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
      // METHOD A: Use direct new message flow
      await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);

      await page.fill('input[placeholder="Search..."]', username);
      await sleep(2500);

      // Try clicking on the user result
      var clicked = false;
      try {
        await page.click('div[role="option"]', { timeout: 3000 });
        clicked = true;
        await sleep(1000);
        await page.click('div[role="dialog"] button:not([disabled])');
        await sleep(1000);
        await page.keyboard.type(message);
        await sleep(500);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await browser.close();
        return { dmSent: true, deliveryMsg: 'DM enviado via Browserless (new msg)' };
      } catch(e) {
        if (!clicked) {
          // METHOD B: Try going directly to user profile and message from there
          try {
            await page.goto('https://www.instagram.com/' + username + '/', { waitUntil: 'domcontentloaded', timeout: 10000 });
            await sleep(1500);
            // Look for message button on profile
            var msgBtn = await page.$('button:has-text("Message")');
            if (!msgBtn) msgBtn = await page.$('div[role="button"]:has-text("Message")');
            if (msgBtn) {
              await msgBtn.click();
              await sleep(2000);
              await page.keyboard.type(message);
              await sleep(500);
              await page.keyboard.press('Enter');
              await sleep(2000);
              await browser.close();
              return { dmSent: true, deliveryMsg: 'DM enviado via Browserless (profile msg btn)' };
            }
          } catch(e2) {}

          // METHOD C: Try share/profile message endpoint
          try {
            await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded', timeout: 10000 });
            await sleep(1500);
            // Clear and retry search
            var searchInput = await page.$('input[placeholder="Search..."]');
            if (searchInput) {
              await searchInput.click();
              await searchInput.fill('');
              await sleep(500);
              await searchInput.fill(username);
              await sleep(3000);
              // Try clicking first result
              await page.click('div[role="listbox"] div[role="option"]', { timeout: 3000 });
              await sleep(1000);
              await page.click('button:has-text("Next"), button:has-text("Chat")', { timeout: 2000 });
              await sleep(1000);
              var textarea = await page.$('textarea[placeholder]');
              if (!textarea) textarea = await page.$('div[contenteditable="true"]');
              if (textarea) {
                await textarea.click();
                await page.keyboard.type(message);
                await sleep(500);
                await page.keyboard.press('Enter');
                await sleep(2000);
                await browser.close();
                return { dmSent: true, deliveryMsg: 'DM enviado via Browserless (alt search)' };
              }
            }
          } catch(e3) {}
        }

        await browser.close();
        return { dmSent: false, deliveryMsg: 'Nao conseguiu abrir conversa IG (tentativa ' + attempt + '): ' + (e.message || '').substring(0, 80) };
      }
    }

    if (platform === 'tiktok') {
      await page.goto('https://www.tiktok.com/@' + username, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2500);

      // METHOD A: Profile message button
      try {
        var msgBtn = await page.$('div[data-e2e="profile-message-button"]');
        if (msgBtn) {
          await msgBtn.click();
          await sleep(2000);
          var ta = await page.$('div[contenteditable="true"]');
          if (ta) {
            await ta.click();
            await page.keyboard.type(message);
            await sleep(500);
            await page.keyboard.press('Enter');
            await sleep(2000);
            await browser.close();
            return { dmSent: true, deliveryMsg: 'DM TikTok enviado via Browserless (profile btn)' };
          }
        }
      } catch(e) {}

      // METHOD B: Try direct message URL
      try {
        await page.goto('https://www.tiktok.com/@' + username, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(2000);
        var btns = await page.$$('header button, header div[role="button"]');
        for (var bi = 0; bi < btns.length; bi++) {
          var txt = await btns[bi].textContent();
          if (txt && (txt.indexOf('Message') >= 0 || txt.indexOf('Mensagem') >= 0)) {
            await btns[bi].click();
            await sleep(2000);
            var ta2 = await page.$('div[contenteditable="true"]');
            if (ta2) {
              await ta2.click();
              await page.keyboard.type(message);
              await sleep(500);
              await page.keyboard.press('Enter');
              await sleep(2000);
              await browser.close();
              return { dmSent: true, deliveryMsg: 'DM TikTok enviado via Browserless (header btn)' };
            }
          }
        }
      } catch(e2) {}

      await browser.close();
      return { dmSent: false, deliveryMsg: 'Erro ao enviar DM TikTok (tentativa ' + attempt + ')' };
    }

    if (platform === 'facebook') {
      // METHOD A: Direct message URL
      await page.goto('https://www.facebook.com/messages/t/' + username, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(3000);

      try {
        // Look for message input
        var msgArea = await page.$('div[aria-label="Message"], div[contenteditable="true"][role="textbox"]');
        if (msgArea) {
          await msgArea.click();
          await page.keyboard.type(message);
          await sleep(500);
          await page.keyboard.press('Enter');
          await sleep(2000);
          await browser.close();
          return { dmSent: true, deliveryMsg: 'DM Facebook enviado via Browserless (direct URL)' };
        }
      } catch(e) {}

      // METHOD B: Search for user in messages
      try {
        await page.goto('https://www.facebook.com/messages/', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(2000);
        // Try finding new message button
        var newMsgBtn = await page.$('a[href*="/messages/new/"], div[role="button"]:has-text("New message"), div[role="button"]:has-text("Nova mensagem")');
        if (newMsgBtn) {
          await newMsgBtn.click();
          await sleep(2000);
          // Type username in "To" field
          var toField = await page.$('input[aria-label*="To"], input[placeholder*="para"], input[placeholder*="To"]');
          if (toField) {
            await toField.fill(username);
            await sleep(2500);
            // Click on first result
            await page.click('ul[role="listbox"] li:first-child, div[role="option"]:first-child', { timeout: 3000 });
            await sleep(1000);
            // Type message
            var msgBox = await page.$('div[contenteditable="true"][role="textbox"], div[aria-label="Message"]');
            if (msgBox) {
              await msgBox.click();
              await page.keyboard.type(message);
              await sleep(500);
              await page.keyboard.press('Enter');
              await sleep(2000);
              await browser.close();
              return { dmSent: true, deliveryMsg: 'DM Facebook enviado via Browserless (new msg)' };
            }
          }
        }
      } catch(e2) {}

      // METHOD C: Go to user profile and message from there
      try {
        await page.goto('https://www.facebook.com/' + username, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await sleep(2000);
        var fbMsgBtn = await page.$('a[href*="/messages/t/"], div[role="button"]:has-text("Message"), div[role="button"]:has-text("Mensagem")');
        if (fbMsgBtn) {
          await fbMsgBtn.click();
          await sleep(2500);
          var fbMsgArea = await page.$('div[contenteditable="true"][role="textbox"], div[aria-label="Message"]');
          if (fbMsgArea) {
            await fbMsgArea.click();
            await page.keyboard.type(message);
            await sleep(500);
            await page.keyboard.press('Enter');
            await sleep(2000);
            await browser.close();
            return { dmSent: true, deliveryMsg: 'DM Facebook enviado via Browserless (profile)' };
          }
        }
      } catch(e3) {}

      await browser.close();
      return { dmSent: false, deliveryMsg: 'Erro ao enviar DM Facebook (tentativa ' + attempt + ')' };
    }

    await browser.close();
    return { dmSent: false, deliveryMsg: 'Plataforma nao suportada' };
  } catch (e) {
    if (browser) { try { browser.close(); } catch(ex) {} }
    return { dmSent: false, deliveryMsg: 'Erro Browserless (tentativa ' + attempt + '): ' + (e.message || 'timeout').substring(0, 80) };
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

/* ===== ROBUST SEND WITH INTERNAL RETRY ===== */
async function robustSend(platform, username, message, cookies, sessionid, csrftoken, loginUsername, loginPassword, sentToday) {
  var lastError = '';
  var METHODS = [];

  // Build method list based on platform
  if (platform === 'instagram' && sessionid && csrftoken) {
    METHODS.push({ name: 'IG API Direct', fn: function() { return attemptInstagramDirectDM(username, message, sessionid, csrftoken); } });
  }
  METHODS.push({ name: 'Browserless', fn: function(attempt) { return sendDMViaBrowserless(platform, username, message, cookies, attempt); } });

  // Try each method, with up to 2 Browserless attempts per method cycle
  for (var cycle = 0; cycle < 2; cycle++) {
    for (var mi = 0; mi < METHODS.length; mi++) {
      var method = METHODS[mi];

      // For Browserless, do 2 attempts per cycle
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
        } catch(e) {
          lastError = method.name + ' excecao: ' + (e.message || '').substring(0, 60);
        }
      }
    }

    // After first cycle, try re-login if credentials provided
    if (cycle === 0 && loginUsername && loginPassword) {
      try {
        var loginResult = await automateLogin(platform, loginUsername, loginPassword);
        if (loginResult.success) {
          // Update cookies for next cycle
          cookies = loginResult.cookiesJson || cookies;
          sessionid = loginResult.sessionid || sessionid;
          csrftoken = loginResult.csrftoken || csrftoken;
          // If IG got new session, re-add API method
          if (platform === 'instagram' && sessionid && csrftoken) {
            METHODS.unshift({ name: 'IG API Direct (re-login)', fn: function() { return attemptInstagramDirectDM(username, message, sessionid, csrftoken); } });
          }
        } else {
          lastError = 'Re-login falhou: ' + (loginResult.error || '');
        }
      } catch(e) {
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

  // === ACTION: SEND DM (with robust retry) ===
  var dmUsername = body.username || '';
  var dmMessage = body.message || '';
  var dmPlatform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;
  var loginUsername = body.loginUsername || '';
  var loginPassword = body.loginPassword || '';

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

  // Use robust send with internal retry + re-login capability
  var result = await robustSend(dmPlatform, dmUsername, dmMessage, cookies, sessionid, csrftoken, loginUsername, loginPassword, sentToday);

  return NextResponse.json(result);
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