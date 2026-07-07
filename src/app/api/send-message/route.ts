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
      body: JSON.stringify({ url: 'https://example.com', elements: [{ selector: 'h1' }] }),
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
    browser = await chromium.connect(BL_WSS, { timeout: 15000 });
    var context = browser.contexts()[0];
    var page = context.pages()[0] || await context.newPage();

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.setExtraHTTPHeaders({ 'User-Agent': BL_UA });

    var loginUrls = {
      instagram: 'https://www.instagram.com/accounts/login/',
      tiktok: 'https://www.tiktok.com/login/',
      facebook: 'https://www.facebook.com/login/'
    };

    var logPrefix = '[LOGIN ' + platform.toUpperCase() + ']';
    console.log(logPrefix + ' Navegando para login...');

    await page.goto(loginUrls[platform], { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    if (platform === 'instagram') {
      return await loginInstagram(page, context, username, password);
    } else if (platform === 'tiktok') {
      return await loginTikTok(page, context, username, password);
    } else if (platform === 'facebook') {
      return await loginFacebook(page, context, username, password);
    }

    return { success: false, error: 'Plataforma nao suportada: ' + platform };
  } catch (e) {
    return { success: false, error: 'Erro ao conectar ao Browserless: ' + (e.message || 'timeout').substring(0, 200) };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

async function loginInstagram(page, context, username, password) {
  try {
    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 15000 }).catch(function() {});
    await sleep(1000);

    // Try to find username and password inputs
    var userInput = await page.$('input[name="username"]') ||
                    await page.$('input[aria-label="Phone number, username, or email"]');
    var passInput = await page.$('input[name="password"]') ||
                    await page.$('input[aria-label="Password"]');

    if (!userInput || !passInput) {
      // Check if already logged in
      var currentUrl = page.url();
      if (currentUrl.indexOf('login') < 0) {
        var cookies = await context.cookies();
        return extractInstagramCookies(cookies, 'Ja esta logado no Instagram');
      }
      return { success: false, error: 'Campos de login do Instagram nao encontrados. A pagina pode ter mudado.' };
    }

    // Fill credentials
    await userInput.click();
    await userInput.fill('');
    await userInput.type(username, { delay: 50 + Math.random() * 80 });
    await sleep(800);

    await passInput.click();
    await passInput.fill('');
    await passInput.type(password, { delay: 40 + Math.random() * 60 });
    await sleep(500);

    // Click login button
    var loginBtn = await page.$('button[type="submit"]') ||
                   await page.$('button:has-text("Log in")') ||
                   await page.$('button:has-text("Log In")') ||
                   await page.$('div[role="button"]:has-text("Log in")');
    if (loginBtn) {
      await loginBtn.click();
    } else {
      await passInput.press('Enter');
    }

    console.log('[LOGIN IG] A aguardar redirecionamento...');
    await sleep(6000);

    // Check for "Save Login Info" popup
    var notNowBtn = await page.$('button:has-text("Not Now")') ||
                    await page.$('button:has-text("Not now")');
    if (notNowBtn) {
      await notNowBtn.click();
      await sleep(2000);
    }

    // Check for notifications popup
    var notNowBtn2 = await page.$('button:has-text("Not Now")') ||
                     await page.$('button:has-text("Not now")');
    if (notNowBtn2) {
      await notNowBtn2.click();
      await sleep(1000);
    }

    // Check if login was successful
    var finalUrl = page.url();
    var loggedIn = finalUrl.indexOf('login') < 0 && finalUrl.indexOf('accounts/login') < 0 && finalUrl.indexOf('challenge') < 0;

    if (!loggedIn) {
      // Check for error messages
      var errorMsg = '';
      var errorEl = await page.$('#slfErrorAlert') || await page.$('[role="alert"]');
      if (errorEl) {
        errorMsg = await errorEl.textContent() || '';
      }
      if (finalUrl.indexOf('challenge') >= 0) {
        return { success: false, error: 'Verificacao de seguranca requerida. Tenta novamente ou entra em instagram.com no teu telemovel e verifica a conta primeiro.' };
      }
      return { success: false, error: 'Login falhou. ' + (errorMsg || 'Verifica as tuas credenciais. Pode haver uma verificacao de seguranca activa.') };
    }

    // Extract cookies
    var cookies = await context.cookies();
    return extractInstagramCookies(cookies, 'Login realizado com sucesso!');

  } catch (e) {
    return { success: false, error: 'Erro no login do Instagram: ' + (e.message || 'desconhecido').substring(0, 200) };
  }
}

async function loginTikTok(page, context, username, password) {
  try {
    await page.waitForSelector('input[type="text"], input[data-e2e="username-input"]', { timeout: 15000 }).catch(function() {});
    await sleep(1000);

    var userInput = await page.$('input[data-e2e="username-input"]') ||
                    await page.$('input[name="username"]') ||
                    await page.$('input[type="text"]');
    var passInput = await page.$('input[data-e2e="password-input"]') ||
                    await page.$('input[name="password"]') ||
                    await page.$('input[type="password"]');

    if (!userInput || !passInput) {
      var currentUrl = page.url();
      if (currentUrl.indexOf('login') < 0) {
        var cookies = await context.cookies();
        return extractTikTokCookies(cookies, 'Ja esta logado no TikTok');
      }
      return { success: false, error: 'Campos de login do TikTok nao encontrados.' };
    }

    await userInput.click();
    await userInput.fill('');
    await userInput.type(username, { delay: 50 + Math.random() * 80 });
    await sleep(800);

    await passInput.click();
    await passInput.fill('');
    await passInput.type(password, { delay: 40 + Math.random() * 60 });
    await sleep(500);

    var loginBtn = await page.$('button[data-e2e="login-button"]') ||
                   await page.$('button[type="submit"]') ||
                   await page.$('button:has-text("Log in")');
    if (loginBtn) await loginBtn.click();
    else await passInput.press('Enter');

    console.log('[LOGIN TT] A aguardar redirecionamento...');
    await sleep(8000);

    var finalUrl = page.url();
    var loggedIn = finalUrl.indexOf('login') < 0;

    if (!loggedIn) {
      return { success: false, error: 'Login falhou no TikTok. Verifica as credenciais ou pode haver verificacao de seguranca.' };
    }

    var cookies = await context.cookies();
    return extractTikTokCookies(cookies, 'Login realizado com sucesso!');

  } catch (e) {
    return { success: false, error: 'Erro no login do TikTok: ' + (e.message || 'desconhecido').substring(0, 200) };
  }
}

async function loginFacebook(page, context, username, password) {
  try {
    await page.waitForSelector('#email', { timeout: 15000 }).catch(function() {});
    await sleep(1000);

    var userInput = await page.$('#email') || await page.$('input[name="email"]');
    var passInput = await page.$('#pass') || await page.$('input[name="pass"]');

    if (!userInput || !passInput) {
      var currentUrl = page.url();
      if (currentUrl.indexOf('login') < 0) {
        var cookies = await context.cookies();
        return extractFacebookCookies(cookies, 'Ja esta logado no Facebook');
      }
      return { success: false, error: 'Campos de login do Facebook nao encontrados.' };
    }

    await userInput.click();
    await userInput.fill('');
    await userInput.type(username, { delay: 50 + Math.random() * 80 });
    await sleep(500);

    await passInput.click();
    await passInput.fill('');
    await passInput.type(password, { delay: 40 + Math.random() * 60 });
    await sleep(500);

    var loginBtn = await page.$('#loginbutton') || await page.$('button[name="login"]');
    if (loginBtn) await loginBtn.click();
    else await passInput.press('Enter');

    console.log('[LOGIN FB] A aguardar redirecionamento...');
    await sleep(6000);

    var finalUrl = page.url();
    var loggedIn = finalUrl.indexOf('login') < 0 && finalUrl.indexOf('checkpoint') < 0;

    if (!loggedIn) {
      if (finalUrl.indexOf('checkpoint') >= 0) {
        return { success: false, error: 'Verificacao de seguranca do Facebook requerida. Verifica a tua conta primeiro.' };
      }
      return { success: false, error: 'Login falhou no Facebook. Verifica as credenciais.' };
    }

    var cookies = await context.cookies();
    return extractFacebookCookies(cookies, 'Login realizado com sucesso!');

  } catch (e) {
    return { success: false, error: 'Erro no login do Facebook: ' + (e.message || 'desconhecido').substring(0, 200) };
  }
}

/* ===== COOKIE EXTRACTION HELPERS ===== */

function extractInstagramCookies(cookies, message) {
  var sessionCookie = cookies.find(function(c) { return c.name === 'sessionid'; });
  var csrfCookie = cookies.find(function(c) { return c.name === 'csrftoken'; });
  var dsUserCookie = cookies.find(function(c) { return c.name === 'ds_user_id'; });

  if (!sessionCookie || !csrfCookie) {
    return { success: false, error: 'Cookies de sessao do Instagram nao encontrados. O login pode nao ter sido concluido.' };
  }

  return {
    success: true,
    platform: 'instagram',
    message: message,
    sessionid: sessionCookie.value,
    csrftoken: csrfCookie.value,
    ds_user_id: dsUserCookie ? dsUserCookie.value : '',
    cookiesJson: JSON.stringify(cookies.map(function(c) { return { name: c.name, value: c.value, domain: c.domain, path: c.path }; }))
  };
}

function extractTikTokCookies(cookies, message) {
  var sessionCookie = cookies.find(function(c) { return c.name === 'sessionid'; });
  var csrfCookie = cookies.find(function(c) { return c.name === 'tt_csrf_token' || c.name === 'csrf_session_token'; });

  if (!sessionCookie) {
    return { success: false, error: 'Cookies de sessao do TikTok nao encontrados.' };
  }

  return {
    success: true,
    platform: 'tiktok',
    message: message,
    sessionid: sessionCookie.value,
    csrftoken: csrfCookie ? csrfCookie.value : '',
    cookiesJson: JSON.stringify(cookies.map(function(c) { return { name: c.name, value: c.value, domain: c.domain, path: c.path }; }))
  };
}

function extractFacebookCookies(cookies, message) {
  var fbCookie = cookies.find(function(c) { return c.name === 'datr' || c.name === 'sb'; });

  return {
    success: true,
    platform: 'facebook',
    message: message,
    sessionid: '',
    csrftoken: '',
    cookiesJson: JSON.stringify(cookies.map(function(c) { return { name: c.name, value: c.value, domain: c.domain, path: c.path }; })),
    note: 'Facebook requer um token de acesso para mensagens. O login foi guardado mas podes precisar de configurar o token do Messenger separadamente.'
  };
}

/* ===== DM VIA BROWSERLESS (BROWSER AUTOMATION) ===== */

async function sendDMViaBrowserless(platform, username, message, cookies) {
  var browser = null;
  try {
    browser = await chromium.connect(BL_WSS, { timeout: 15000 });
    var context = browser.contexts()[0];

    // Load cookies if provided
    if (cookies) {
      try {
        var parsed = typeof cookies === 'string' ? JSON.parse(cookies) : cookies;
        if (Array.isArray(parsed) && parsed.length > 0) {
          await context.addCookies(parsed);
        }
      } catch (e) { /* cookies invalidos, tenta sem eles */ }
    }

    var page = context.pages()[0] || await context.newPage();
    await page.setViewportSize({ width: 375, height: 812 });

    username = username.replace('@', '');
    var logPrefix = '[DM ' + platform.toUpperCase() + '] @' + username;
    console.log(logPrefix + ' Iniciando via Browserless...');

    if (platform === 'instagram') {
      return await sendIgDM(page, username, message);
    } else if (platform === 'tiktok') {
      return await sendTtDM(page, username, message);
    } else if (platform === 'facebook') {
      return await sendFbDM(page, username, message);
    }

    return { success: false, dmSent: false, deliveryMsg: 'Plataforma nao suportada' };

  } catch (e) {
    return { success: false, dmSent: false, deliveryMsg: 'Erro Browserless: ' + (e.message || 'timeout').substring(0, 150) };
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

async function sendIgDM(page, username, message) {
  try {
    await page.goto('https://www.instagram.com/' + username + '/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(3000);

    // Check login
    if (page.url().indexOf('login') >= 0 || page.url().indexOf('accounts/login') >= 0) {
      return { success: false, dmSent: false, deliveryMsg: 'Nao esta logado no Instagram. Faz login primeiro.' };
    }

    // Click Message button
    var msgBtn = await page.$('div[role="button"]:has-text("Message")') ||
                 await page.$('button:has-text("Message")') ||
                 await page.$('a[href*="/direct/t/"]') ||
                 await page.$('header + div div div div a[href*="direct"]');

    if (msgBtn) {
      await msgBtn.click();
      await sleep(3000);
    } else {
      // Try direct message URL
      await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000);
      var searchInput = await page.$('input[placeholder*="Search"]') || await page.$('input[placeholder*="search"]') || await page.$('input[aria-label*="Search"]');
      if (searchInput) {
        await searchInput.click();
        await searchInput.fill(username);
        await sleep(3000);
        var result = await page.$('a[href*="/' + username + '"]');
        if (result) { await result.click(); await sleep(2000); }
      }
    }

    // Find textarea
    var textarea = await page.$('textarea[placeholder*="Message"]') ||
                   await page.$('textarea[placeholder*="message"]') ||
                   await page.$('textarea') ||
                   await page.$('div[contenteditable="true"][role="textbox"]');

    if (!textarea) {
      // Check if in conversation already
      var content = await page.content();
      if (content.indexOf('/direct/') >= 0) {
        textarea = await page.$('textarea') || await page.$('div[contenteditable="true"]');
      }
    }

    if (!textarea) {
      return { success: false, dmSent: false, deliveryMsg: 'Campo de mensagem nao encontrado no Instagram' };
    }

    await textarea.click();
    await textarea.fill('');
    await textarea.type(message, { delay: 25 + Math.random() * 45 });
    await sleep(1000);

    // Send
    var sendBtn = await page.$('div[role="button"]:has-text("Send")') || await page.$('button:has-text("Send")');
    if (sendBtn) { await sendBtn.click(); }
    else { await textarea.press('Enter'); }

    await sleep(2000);
    return { success: true, dmSent: true, deliveryMsg: 'DM enviado com sucesso via Instagram (Browserless)' };

  } catch (e) {
    return { success: false, dmSent: false, deliveryMsg: 'Erro ao enviar DM no Instagram: ' + (e.message || '').substring(0, 150) };
  }
}

async function sendTtDM(page, username, message) {
  try {
    await page.goto('https://www.tiktok.com/@' + username, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(3000);

    if (page.url().indexOf('login') >= 0) {
      return { success: false, dmSent: false, deliveryMsg: 'Nao esta logado no TikTok. Faz login primeiro.' };
    }

    var msgBtn = await page.$('div[data-e2e="profile-message-icon"]') ||
                 await page.$('div[class*="message-icon"]') ||
                 await page.$('a[href*="/inbox"]');

    if (msgBtn) {
      await msgBtn.click();
      await sleep(3000);
    } else {
      await page.goto('https://www.tiktok.com/inbox/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(2000);
    }

    var textarea = await page.$('div[contenteditable="true"]') ||
                   await page.$('textarea') ||
                   await page.$('input[type="text"]');

    if (!textarea) {
      return { success: false, dmSent: false, deliveryMsg: 'Campo de mensagem nao encontrado no TikTok' };
    }

    await textarea.click();
    await textarea.fill('');
    await textarea.type(message, { delay: 25 + Math.random() * 45 });
    await sleep(1000);

    var sendBtn = await page.$('div[data-ee="send-button"]') ||
                  await page.$('button:has-text("Send")') ||
                  await page.$('div:has-text("Send"):not(:has(div))');
    if (sendBtn) { await sendBtn.click(); }
    else { await textarea.press('Enter'); }

    await sleep(2000);
    return { success: true, dmSent: true, deliveryMsg: 'DM enviado com sucesso via TikTok (Browserless)' };

  } catch (e) {
    return { success: false, dmSent: false, deliveryMsg: 'Erro ao enviar DM no TikTok: ' + (e.message || '').substring(0, 150) };
  }
}

async function sendFbDM(page, username, message) {
  try {
    await page.goto('https://www.facebook.com/' + username + '/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await sleep(3000);

    if (page.url().indexOf('login') >= 0) {
      return { success: false, dmSent: false, deliveryMsg: 'Nao esta logado no Facebook. Faz login primeiro.' };
    }

    var msgBtn = await page.$('a[aria-label*="Message"]') ||
                 await page.$('a:has-text("Message")') ||
                 await page.$('span:has-text("Message")');

    if (msgBtn) {
      await msgBtn.click();
      await sleep(3000);
    } else {
      await page.goto('https://www.facebook.com/messages/t/' + username + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(3000);
    }

    var textarea = await page.$('div[contenteditable="true"][role="textbox"]') ||
                   await page.$('textarea[aria-label*="Message"]') ||
                   await page.$('div[contenteditable="true"]');

    if (!textarea) {
      return { success: false, dmSent: false, deliveryMsg: 'Campo de mensagem nao encontrado no Facebook' };
    }

    await textarea.click();
    await textarea.fill('');
    await textarea.type(message, { delay: 25 + Math.random() * 45 });
    await sleep(1000);
    await textarea.press('Enter');
    await sleep(2000);

    return { success: true, dmSent: true, deliveryMsg: 'DM enviado com sucesso via Facebook (Browserless)' };

  } catch (e) {
    return { success: false, dmSent: false, deliveryMsg: 'Erro ao enviar DM no Facebook: ' + (e.message || '').substring(0, 150) };
  }
}

/* ===== DIRECT API DM (sem browser - rapido e gratis) ===== */

function attemptInstagramDM(username, message, sessionid, csrftoken) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var cookies = 'sessionid=' + sessionid +
    '; csrftoken=' + csrftoken +
    '; ds_user_id=' + dsUserId;

  return fetch(
    'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + username,
    {
      headers: {
        'Cookie': cookies,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrftoken,
        'User-Agent': BL_UA,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  ).then(function(profileRes) {
    if (!profileRes.ok) return Promise.reject('perfil nao encontrado (HTTP ' + profileRes.status + ')');
    return profileRes.json().then(function(profileData) {
      var userData = profileData.data && profileData.data.user;
      var userId = userData && (userData.pk || userData.id);
      if (!userId) return Promise.reject('user ID nao encontrado');
      var clientContext = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      return fetch(
        'https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/',
        {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'X-CSRFToken': csrftoken,
            'X-IG-App-ID': '936619743392459',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': BL_UA,
            'X-Requested-With': 'XMLHttpRequest',
            'X-IG-WWW-Claim': '0'
          },
          body: new URLSearchParams({
            recipient_users: '[[%7B' + userId + '%7D]]',
            text: message,
            client_context: clientContext,
            action: 'send_item',
            thread_ids: '["0"]',
            platform: 'android'
          }).toString()
        }
      ).then(function(dmRes) {
        if (dmRes.ok) return 'DM enviado com sucesso (API directa)';
        return dmRes.text().then(function(txt) {
          return Promise.reject('HTTP ' + dmRes.status + ': ' + txt.substring(0, 100));
        });
      });
    });
  });
}

function attemptTikTokDM(username, message, sessionid, csrftoken) {
  var cookies = 'sessionid=' + sessionid + '; tt_csrf_token=' + csrftoken;
  return fetch(
    'https://www.tiktok.com/api/user/detail/?uniqueId=' + username,
    {
      headers: {
        'Cookie': cookies,
        'User-Agent': BL_UA,
        'Referer': 'https://www.tiktok.com/@' + username
      }
    }
  ).then(function(userRes) {
    if (!userRes.ok) return Promise.reject('perfil nao encontrado (HTTP ' + userRes.status + ')');
    return userRes.json().then(function(userData) {
      var userId = (userData.user && userData.user.id) ||
        (userData.userInfo && userData.userInfo.user && userData.userInfo.user.id);
      if (!userId) return Promise.reject('user ID nao encontrado');
      return fetch('https://www.tiktok.com/api/chat/send/', {
        method: 'POST',
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': csrftoken,
          'User-Agent': BL_UA,
          'Referer': 'https://www.tiktok.com/@' + username
        },
        body: new URLSearchParams({
          recipient_user_id: String(userId),
          content: message,
          type: 'text'
        }).toString()
      }).then(function(dmRes) {
        if (dmRes.ok) return 'DM enviado com sucesso (API directa)';
        return Promise.reject('HTTP ' + dmRes.status);
      });
    });
  });
}

/* ===== COOKIES VALIDATION ===== */

async function validateCookies(platform, cookiesJson) {
  if (!cookiesJson) return { valid: false, error: 'Sem cookies' };

  try {
    var cookies = typeof cookiesJson === 'string' ? JSON.parse(cookiesJson) : cookiesJson;

    if (platform === 'instagram') {
      var sessionCookie = cookies.find(function(c) { return c.name === 'sessionid'; });
      var csrfCookie = cookies.find(function(c) { return c.name === 'csrftoken'; });
      if (!sessionCookie || !csrfCookie) return { valid: false, error: 'Cookies do Instagram incompletos' };

      // Test the cookies by making a simple API call
      var dsUserId = sessionCookie.value.split('%3A')[0] || '';
      var cookieStr = 'sessionid=' + sessionCookie.value + '; csrftoken=' + csrfCookie.value + '; ds_user_id=' + dsUserId;
      var ctrl = new AbortController();
      var tid = setTimeout(function() { ctrl.abort(); }, 10000);
      var res = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram', {
        headers: {
          'Cookie': cookieStr,
          'X-IG-App-ID': '936619743392459',
          'User-Agent': BL_UA
        },
        signal: ctrl.signal
      });
      clearTimeout(tid);

      if (res.ok) {
        var data = await res.json();
        if (data && data.data && data.data.user) {
          return { valid: true, username: data.data.user.username };
        }
      }
      return { valid: false, error: 'Cookies expirados ou invalidos (HTTP ' + res.status + ')' };
    }

    if (platform === 'tiktok') {
      var ttSession = cookies.find(function(c) { return c.name === 'sessionid'; });
      if (!ttSession) return { valid: false, error: 'Cookies do TikTok incompletos' };
      return { valid: true, note: 'Validacao basica OK' };
    }

    return { valid: false, error: 'Validacao nao disponivel para ' + platform };
  } catch (e) {
    return { valid: false, error: 'Erro ao validar: ' + (e.message || '').substring(0, 100) };
  }
}

/* ===== MAIN HANDLER: POST ===== */

export async function POST(request) {
  var body = await request.json();
  var action = body.action || 'send';
  var platform = body.platform || 'instagram';
  var username = (body.username || '').replace('@', '');
  var message = body.message || '';
  var sentToday = body.sentToday || 0;

  // === ACTION: LOGIN ===
  if (action === 'login') {
    var loginUser = body.loginUser || body.username || '';
    var loginPass = body.loginPass || body.password || '';
    if (!loginUser || !loginPass) {
      return NextResponse.json({ success: false, error: 'Username e password sao obrigatorios para o login' });
    }
    console.log('[LOGIN] Iniciando login ' + platform + ' para ' + loginUser);
    var loginResult = await automateLogin(platform, loginUser, loginPass);
    return NextResponse.json(loginResult);
  }

  // === ACTION: VALIDATE COOKIES ===
  if (action === 'validate') {
    var validationResult = await validateCookies(platform, body.cookies);
    return NextResponse.json(validationResult);
  }

  // === ACTION: CHECK BROWSERLESS ===
  if (action === 'check') {
    var blOk = await checkBrowserless();
    return NextResponse.json({ browserless: blOk, timestamp: new Date().toISOString() });
  }

  // === ACTION: SEND DM ===
  if (!username) {
    return NextResponse.json({
      success: false, dmSent: false, platform: platform,
      deliveryMsg: 'Username nao fornecido',
      todaySent: sentToday,
      remainingToday: MAX_PER_DAY - sentToday
    });
  }

  if (!message.trim()) {
    return NextResponse.json({
      success: false, dmSent: false, platform: platform,
      deliveryMsg: 'Mensagem vazia',
      todaySent: sentToday,
      remainingToday: MAX_PER_DAY - sentToday
    });
  }

  if (sentToday >= MAX_PER_DAY) {
    return NextResponse.json({
      success: false, dmSent: false, platform: platform,
      deliveryMsg: 'Limite diario de ' + MAX_PER_DAY + ' DMs atingido',
      todaySent: sentToday,
      remainingToday: 0
    });
  }

  // === PRIORIDADE 1: API directa com cookies (rapido, gratis, sem browser) ===
  var cookiesJson = body.cookies || null;
  var sessionid = body.sessionid || '';
  var csrftoken = body.csrftoken || '';

  if (platform === 'instagram' && sessionid && csrftoken) {
    try {
      var igResult = await attemptInstagramDM(username, message, sessionid, csrftoken);
      return NextResponse.json({
        success: true, dmSent: true, platform: platform,
        deliveryMsg: igResult,
        todaySent: sentToday + 1,
        remainingToday: MAX_PER_DAY - sentToday - 1,
        source: 'api-direct'
      });
    } catch (e) {
      console.log('[DM IG] API directa falhou: ' + (e.message || e).substring(0, 100) + ', a tentar Browserless...');
    }
  }

  if (platform === 'tiktok' && sessionid && csrftoken) {
    try {
      var ttResult = await attemptTikTokDM(username, message, sessionid, csrftoken);
      return NextResponse.json({
        success: true, dmSent: true, platform: platform,
        deliveryMsg: ttResult,
        todaySent: sentToday + 1,
        remainingToday: MAX_PER_DAY - sentToday - 1,
        source: 'api-direct'
      });
    } catch (e) {
      console.log('[DM TT] API directa falhou: ' + (e.message || e).substring(0, 100) + ', a tentar Browserless...');
    }
  }

  // === PRIORIDADE 2: Browserless (browser na nuvem) ===
  console.log('[DM] Tentando via Browserless...');
  var blResult = await sendDMViaBrowserless(platform, username, message, cookiesJson);

  if (blResult.dmSent || blResult.success) {
    return NextResponse.json({
      success: true, dmSent: true, platform: platform,
      deliveryMsg: blResult.deliveryMsg || 'DM enviado via Browserless',
      todaySent: sentToday + 1,
      remainingToday: MAX_PER_DAY - sentToday - 1,
      source: 'browserless'
    });
  }

  // === NENHUM FUNCIONOU ===
  return NextResponse.json({
    success: false, dmSent: false, platform: platform,
    deliveryMsg: 'Falha ao enviar DM. Browserless: ' + (blResult.deliveryMsg || 'erro desconhecido'),
    todaySent: sentToday,
    remainingToday: MAX_PER_DAY - sentToday
  });
}

/* ===== MAIN HANDLER: GET ===== */

export async function GET() {
  var blOnline = await checkBrowserless();

  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    browserless: {
      online: blOnline,
      url: BL_HTTP
    },
    architecture: 'Browserless Cloud (sem VPS necessario)'
  });
}