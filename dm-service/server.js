// ============================================
// MBA Brain - DM Automation Service
// Deploy on Render.com (Free Tier)
// Puppeteer COMPLETO com page.fill, page.click
// ============================================

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const crypto = require('crypto');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Config
var API_KEY = process.env.API_KEY || 'mba-brain-dm-2024';
var PORT = process.env.PORT || 3000;

// State
var browser = null;
var pages = {};
var sessions = {
  instagram: { cookies: null, loggedIn: false, userId: null },
  facebook: { loggedIn: false },
  tiktok: { loggedIn: false }
};

// ============================================
// HELPERS
// ============================================

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }

function authMiddleware(req, res, next) {
  var key = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

async function getBrowser() {
  if (browser && browser.connected) return browser;
  console.log('[Browser] Launching new browser...');
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--window-size=1280,720',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--disable-infobars'
    ]
  });
  browser.on('disconnected', function() {
    console.log('[Browser] Disconnected');
    browser = null;
    pages = {};
  });
  return browser;
}

async function getPage(platform) {
  var b = await getBrowser();
  if (!pages[platform] || pages[platform].isClosed()) {
    pages[platform] = await b.newPage();
    await pages[platform].setViewport({ width: 1280, height: 720 });
    await pages[platform].setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await pages[platform].setExtraHTTPHeaders({
      'Accept-Language': 'pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    });
  }
  return pages[platform];
}

// ============================================
// INSTAGRAM
// ============================================

async function handleIGPopups(page) {
  await sleep(2000);
  try {
    await page.evaluate(function() {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = btns[i].textContent || '';
        if (t.includes('Not Now') || t.includes('Agora nao') || t.includes('Not now') || t.includes('agora nao')) {
          btns[i].click();
          return;
        }
      }
    });
  } catch(e) {}
  await sleep(2000);
  try {
    await page.evaluate(function() {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = btns[i].textContent || '';
        if (t.includes('Not Now') || t.includes('Agora nao') || t.includes('Not now') || t.includes('agora nao')) {
          btns[i].click();
          return;
        }
      }
    });
  } catch(e) {}
}

async function storeIGCookies(page) {
  var cookies = await page.cookies();
  var sessionCookie = null;
  var csrfCookie = null;
  var dsUserId = null;
  for (var i = 0; i < cookies.length; i++) {
    if (cookies[i].name === 'sessionid') sessionCookie = cookies[i];
    if (cookies[i].name === 'csrftoken') csrfCookie = cookies[i];
    if (cookies[i].name === 'ds_user_id') dsUserId = cookies[i];
  }
  if (sessionCookie && csrfCookie) {
    sessions.instagram.cookies = {
      sessionid: sessionCookie.value,
      csrftoken: csrfCookie.value
    };
    if (dsUserId) sessions.instagram.userId = dsUserId.value;
    console.log('[IG] Cookies armazenados com sucesso');
    return true;
  }
  console.log('[IG] Nao encontrou cookies de sessao');
  return false;
}

// LOGIN Instagram
app.post('/api/login/instagram', authMiddleware, async function(req, res) {
  try {
    var username = (req.body.username || '') || (process.env.IG_USERNAME || '');
    var password = (req.body.password || '') || (process.env.IG_PASSWORD || '');

    if (!username || !password) {
      return res.json({ success: false, error: 'Credenciais do Instagram nao configuradas. Define IG_USERNAME e IG_PASSWORD.' });
    }

    console.log('[IG] A fazer login...');

    var page = await getPage('instagram');
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });

    var currentUrl = page.url();

    // Ja logado?
    if (!currentUrl.includes('login') && !currentUrl.includes('accounts')) {
      await storeIGCookies(page);
      sessions.instagram.loggedIn = true;
      return res.json({ success: true, message: 'Ja esta logado no Instagram' });
    }

    // Preencher formulario
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await page.click('input[name="username"]', { clickCount: 3 });
    await page.type('input[name="username"]', username, { delay: 80 });
    await page.click('input[name="password"]', { clickCount: 3 });
    await page.type('input[name="password"]', password, { delay: 80 });

    // Tirar screenshot para debug
    try { await page.screenshot({ path: '/tmp/ig-login-before.png' }); } catch(e) {}

    await page.click('button[type="submit"]');

    // Esperar pos-login
    await sleep(6000);

    // Tirar screenshot apos login
    try { await page.screenshot({ path: '/tmp/ig-login-after.png' }); } catch(e) {}

    // Lidar com popups
    await handleIGPopups(page);

    currentUrl = page.url();

    // Verificar se ha captcha/challenge
    if (currentUrl.includes('challenge') || currentUrl.includes('checkpoint')) {
      sessions.instagram.loggedIn = false;
      return res.json({
        success: false,
        error: 'Instagram requer verificacao (captcha ou 2FA). Abre o Instagram no teu telemovel e tenta mais tarde.',
        screenshotAvailable: true
      });
    }

    // Login com sucesso?
    if (!currentUrl.includes('login')) {
      var stored = await storeIGCookies(page);
      sessions.instagram.loggedIn = true;
      if (stored) {
        return res.json({ success: true, message: 'Login Instagram feito! DMs serao enviados via API (rapido).' });
      }
      return res.json({ success: true, message: 'Login feito mas nao conseguiu extrair cookies. DMs via browser.' });
    }

    sessions.instagram.loggedIn = false;
    return res.json({ success: false, error: 'Login falhou. Verifica as credenciais.' });
  } catch(e) {
    console.error('[IG] Login error:', e.message);
    sessions.instagram.loggedIn = false;
    return res.json({ success: false, error: e.message });
  }
});

// SEND DM Instagram (via HTTP API - RAPIDO, sem browser)
async function sendIGDM(username, message) {
  if (!sessions.instagram.loggedIn || !sessions.instagram.cookies) {
    return { success: false, error: 'Nao esta logado no Instagram', needLogin: true };
  }

  try {
    var cookieStr = 'sessionid=' + sessions.instagram.cookies.sessionid + '; csrftoken=' + sessions.instagram.cookies.csrftoken;
    var headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-IG-App-ID': '936619743392459',
      'X-CSRFToken': sessions.instagram.cookies.csrftoken,
      'Cookie': cookieStr,
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://www.instagram.com/'
    };

    // Passo 1: Resolver username para user ID
    console.log('[IG] A procurar ID de @' + username + '...');
    var infoRes = await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
      headers: headers
    });

    if (infoRes.status === 403 || infoRes.status === 401) {
      sessions.instagram.loggedIn = false;
      return { success: false, error: 'Sessao do Instagram expirada', needLogin: true };
    }

    if (!infoRes.ok) {
      return { success: false, error: 'Nao encontrou o usuario @' + username + ' (status ' + infoRes.status + ')' };
    }

    var infoData = await infoRes.json();
    var userId = infoData.data && infoData.data.user && infoData.data.user.pk;

    if (!userId) {
      return { success: false, error: 'Nao encontrou o ID do usuario @' + username };
    }

    console.log('[IG] ID de @' + username + ' = ' + userId);

    // Passo 2: Enviar DM via API
    var dmBody = 'recipient_users=%5B%5B' + userId + '%5D%5D&client_context=' + uuid() + '&text=' + encodeURIComponent(message);

    var dmRes = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: dmBody
    });

    if (dmRes.status === 403 || dmRes.status === 401) {
      sessions.instagram.loggedIn = false;
      return { success: false, error: 'Sessao expirada ao enviar DM', needLogin: true };
    }

    if (!dmRes.ok) {
      var errText = '';
      try { errText = await dmRes.text(); } catch(e) {}
      return { success: false, error: 'Erro ao enviar DM (status ' + dmRes.status + ')' };
    }

    var dmData = await dmRes.json();

    if (dmData.status === 'ok') {
      console.log('[IG] DM enviado para @' + username);
      return { success: true, message: 'DM enviado para @' + username };
    }

    return { success: false, error: 'DM nao enviado: ' + (dmData.message || 'erro desconhecido') };
  } catch(e) {
    console.error('[IG] DM error:', e.message);
    return { success: false, error: e.message };
  }
}

// SEND DM Instagram via Browser (fallback)
async function sendIGDMBrowser(username, message) {
  var page = await getPage('instagram');

  try {
    // Metodo 1: Ir ao perfil e clicar Message
    console.log('[IG-Browser] A abrir perfil de @' + username + '...');
    await page.goto('https://www.instagram.com/' + username + '/', { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(3000);

    // Procurar botao de Message
    var msgBtnClicked = await page.evaluate(function() {
      // Procurar por links/botoes com texto "Message"
      var els = document.querySelectorAll('div[role="button"], a, button, span');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim().toLowerCase();
        if (t === 'message' || t === 'messagem' || t === 'enviar mensagem') {
          els[i].click();
          return true;
        }
      }
      return false;
    });

    if (!msgBtnClicked) {
      // Metodo 2: Ir para /direct/new/
      console.log('[IG-Browser] Botao nao encontrado, a tentar /direct/new/...');
      await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'networkidle2', timeout: 20000 });
      await sleep(2000);

      // Procurar campo de pesquisa
      var searchInput = await page.$('input[placeholder="Search..."]') ||
                        await page.$('input[aria-label="Search"]') ||
                        await page.$('input[name="queryBox"]');

      if (!searchInput) {
        searchInput = await page.$('input[type="text"]');
      }

      if (searchInput) {
        await searchInput.click();
        await page.type('input[type="text"], input[placeholder*="Search"], input[aria-label*="Search"]', username, { delay: 50 });
        await sleep(3000);

        // Clicar no primeiro resultado
        var resultClicked = await page.evaluate(function(uname) {
          var links = document.querySelectorAll('a[href*="/direct/t/"], a[href*="/p/"], [role="option"] a');
          for (var i = 0; i < links.length; i++) {
            var href = links[i].href || '';
            var text = (links[i].textContent || '').toLowerCase();
            if (text.includes(uname.toLowerCase()) || href.includes(uname.toLowerCase())) {
              links[i].click();
              return true;
            }
          }
          // Tentar qualquer link na lista de resultados
          var allLinks = document.querySelectorAll('a');
          for (var j = 0; j < allLinks.length; j++) {
            if (allLinks[j].href && allLinks[j].href.includes('direct')) {
              allLinks[j].click();
              return true;
            }
          }
          return false;
        }, username);

        if (!resultClicked) {
          return { success: false, error: 'Nao encontrou o usuario na pesquisa IG' };
        }

        await sleep(3000);
      } else {
        return { success: false, error: 'Campo de pesquisa nao encontrado no DM do IG' };
      }
    } else {
      await sleep(3000);
    }

    // Escrever mensagem
    var msgArea = await page.$('textarea[placeholder="Message..."]') ||
                  await page.$('textarea[placeholder*="Message"]') ||
                  await page.$('div[contenteditable="true"][role="textbox"]') ||
                  await page.$('[aria-label="Message"]');

    if (!msgArea) {
      // Tentar qualquer contenteditable
      msgArea = await page.$('div[contenteditable="true"]');
    }

    if (!msgArea) {
      return { success: false, error: 'Caixa de mensagem nao encontrada no Instagram' };
    }

    await msgArea.click();
    await sleep(500);
    await page.keyboard.type(message, { delay: 30 });
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(2000);

    return { success: true, message: 'DM enviado para @' + username + ' via browser' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

app.post('/api/dm/instagram', authMiddleware, async function(req, res) {
  var username = req.body.username;
  var message = req.body.message;
  if (!username || !message) return res.status(400).json({ error: 'Missing username or message' });

  // Tentar API primeiro (rapido)
  var result = await sendIGDM(username, message);

  // Se a API falhar, tentar browser (fallback)
  if (!result.success && !result.needLogin) {
    console.log('[IG] API falhou, a tentar via browser...');
    result = await sendIGDMBrowser(username, message);
  }

  return res.json(result);
});

// ============================================
// FACEBOOK
// ============================================

app.post('/api/login/facebook', authMiddleware, async function(req, res) {
  try {
    var username = (req.body.username || '') || (process.env.FB_USERNAME || '');
    var password = (req.body.password || '') || (process.env.FB_PASSWORD || '');

    if (!username || !password) {
      return res.json({ success: false, error: 'Credenciais do Facebook nao configuradas. Define FB_USERNAME e FB_PASSWORD.' });
    }

    console.log('[FB] A fazer login...');
    var page = await getPage('facebook');

    await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });

    var currentUrl = page.url();
    if (!currentUrl.includes('login') && !currentUrl.includes('welcome')) {
      sessions.facebook.loggedIn = true;
      return res.json({ success: true, message: 'Ja esta logado no Facebook' });
    }

    await page.waitForSelector('#email', { timeout: 15000 });
    await page.click('#email', { clickCount: 3 });
    await page.type('#email', username, { delay: 80 });
    await page.click('#pass', { clickCount: 3 });
    await page.type('#pass', password, { delay: 80 });

    try { await page.screenshot({ path: '/tmp/fb-login-before.png' }); } catch(e) {}

    await page.click('#loginbutton');

    await sleep(8000);

    try { await page.screenshot({ path: '/tmp/fb-login-after.png' }); } catch(e) {}

    currentUrl = page.url();

    if (currentUrl.includes('checkpoint') || currentUrl.includes('security_check') || currentUrl.includes('two_factor')) {
      sessions.facebook.loggedIn = false;
      return res.json({ success: false, error: 'Facebook requer verificacao. Abre o Facebook e resolve.' });
    }

    if (!currentUrl.includes('login') && !currentUrl.includes('welcome') && !currentUrl.includes('recover')) {
      sessions.facebook.loggedIn = true;
      return res.json({ success: true, message: 'Login Facebook feito com sucesso!' });
    }

    sessions.facebook.loggedIn = false;
    return res.json({ success: false, error: 'Login falhou. Verifica as credenciais.' });
  } catch(e) {
    console.error('[FB] Login error:', e.message);
    sessions.facebook.loggedIn = false;
    return res.json({ success: false, error: e.message });
  }
});

async function sendFBDM(username, message) {
  if (!sessions.facebook.loggedIn) {
    return { success: false, error: 'Nao esta logado no Facebook', needLogin: true };
  }

  try {
    var page = await getPage('facebook');

    console.log('[FB] A enviar DM para ' + username + '...');

    // Navegar para mensagens com este usuario
    await page.goto('https://www.facebook.com/messages/t/' + encodeURIComponent(username), { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    // Procurar caixa de mensagem - varios seletores
    var selectors = [
      'div[contenteditable="true"][role="textbox"]',
      '[aria-label="Message"]',
      '[data-testid="message-text-input"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      '.notranslate[contenteditable="true"]',
      'div[contenteditable="true"][aria-label*="Message"]'
    ];

    var msgBox = null;
    for (var i = 0; i < selectors.length; i++) {
      try {
        msgBox = await page.waitForSelector(selectors[i], { timeout: 5000 });
        if (msgBox) {
          console.log('[FB] Encontrou caixa com seletor: ' + selectors[i]);
          break;
        }
      } catch(e) {}
    }

    if (!msgBox) {
      // Ultima tentativa: qualquer contenteditable
      msgBox = await page.$('div[contenteditable="true"]');
    }

    if (!msgBox) {
      try { await page.screenshot({ path: '/tmp/fb-dm-error.png' }); } catch(e) {}
      return { success: false, error: 'Caixa de mensagem nao encontrada' };
    }

    await msgBox.click({ clickCount: 3 });
    await sleep(500);
    await page.keyboard.type(message, { delay: 30 });
    await sleep(500);

    // Pressionar Enter para enviar
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');

    await sleep(300);

    // Agora Enter normal para enviar
    // Actually, Facebook Messenger sends on plain Enter
    await page.keyboard.press('Enter');
    await sleep(2000);

    return { success: true, message: 'DM enviado para ' + username + ' no Facebook' };
  } catch(e) {
    console.error('[FB] DM error:', e.message);
    return { success: false, error: e.message };
  }
}

app.post('/api/dm/facebook', authMiddleware, async function(req, res) {
  var username = req.body.username;
  var message = req.body.message;
  if (!username || !message) return res.status(400).json({ error: 'Missing username or message' });
  var result = await sendFBDM(username, message);
  return res.json(result);
});

// ============================================
// TIKTOK
// ============================================

app.post('/api/login/tiktok', authMiddleware, async function(req, res) {
  try {
    var username = (req.body.username || '') || (process.env.TT_USERNAME || '');
    var password = (req.body.password || '') || (process.env.TT_PASSWORD || '');

    if (!username || !password) {
      return res.json({ success: false, error: 'Credenciais do TikTok nao configuradas. Define TT_USERNAME e TT_PASSWORD.' });
    }

    console.log('[TT] A fazer login...');
    var page = await getPage('tiktok');

    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);

    // Clicar em "Use phone/email/username"
    var methodClicked = await page.evaluate(function() {
      var els = document.querySelectorAll('p, span, button, div, a');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim();
        if (t.includes('Use phone') || t.includes('email / username') || t.includes('Telefone') || t.includes('correo')) {
          els[i].click();
          return true;
        }
      }
      return false;
    });

    if (methodClicked) await sleep(3000);

    try { await page.screenshot({ path: '/tmp/tt-login-page.png' }); } catch(e) {}

    // Procurar campo de username
    var usernameInput = await page.$('input[name="username"]');
    if (!usernameInput) usernameInput = await page.$('input[type="text"]');
    if (!usernameInput) usernameInput = await page.$('input[data-e2e="username-input"]');

    if (!usernameInput) {
      // Tentar encontrar qualquer input de texto que nao seja checkbox
      usernameInput = await page.evaluate(function() {
        var inputs = document.querySelectorAll('input');
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i].type === 'text' || inputs[i].name === 'username' || inputs[i].name === 'email') {
            return inputs[i];
          }
        }
        return null;
      });
    }

    if (!usernameInput) {
      return res.json({ success: false, error: 'Campo de username nao encontrado no TikTok' });
    }

    await usernameInput.click({ clickCount: 3 });
    await page.keyboard.type(username, { delay: 80 });

    // Procurar campo de password
    var passwordInput = await page.$('input[type="password"]');
    if (!passwordInput) passwordInput = await page.$('input[name="password"]');

    if (!passwordInput) {
      return res.json({ success: false, error: 'Campo de password nao encontrado no TikTok' });
    }

    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.type(password, { delay: 80 });

    // Clicar em Login
    var loginClicked = await page.evaluate(function() {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var t = (btns[i].textContent || '').trim().toLowerCase();
        if (t.includes('log in') || t.includes('login') || t.includes('entrar') || t.includes('iniciar sesion')) {
          btns[i].click();
          return true;
        }
      }
      return false;
    });

    await sleep(8000);

    try { await page.screenshot({ path: '/tmp/tt-login-after.png' }); } catch(e) {}

    var currentUrl = page.url();
    if (!currentUrl.includes('login')) {
      sessions.tiktok.loggedIn = true;
      return res.json({ success: true, message: 'Login TikTok feito com sucesso!' });
    }

    sessions.tiktok.loggedIn = false;
    return res.json({ success: false, error: 'Login falhou. Verifica as credenciais.' });
  } catch(e) {
    console.error('[TT] Login error:', e.message);
    sessions.tiktok.loggedIn = false;
    return res.json({ success: false, error: e.message });
  }
});

async function sendTTDM(username, message) {
  if (!sessions.tiktok.loggedIn) {
    return { success: false, error: 'Nao esta logado no TikTok', needLogin: true };
  }

  try {
    var page = await getPage('tiktok');

    console.log('[TT] A enviar DM para @' + username + '...');

    await page.goto('https://www.tiktok.com/@' + encodeURIComponent(username), { waitUntil: 'networkidle2', timeout: 25000 });
    await sleep(4000);

    // Clicar no botao de mensagem
    var msgBtnClicked = false;

    try {
      await page.waitForSelector('[data-e2e="profile-message-button"]', { timeout: 10000 });
      await page.click('[data-e2e="profile-message-button"]');
      msgBtnClicked = true;
    } catch(e) {}

    if (!msgBtnClicked) {
      // Fallback: procurar botao com texto "Message"
      msgBtnClicked = await page.evaluate(function() {
        var els = document.querySelectorAll('[data-e2e], button, div[role="button"], span, a');
        for (var i = 0; i < els.length; i++) {
          var t = (els[i].textContent || '').trim().toLowerCase();
          if (t === 'message' || t === 'messagem' || els[i].getAttribute('data-e2e') === 'profile-message-button') {
            els[i].click();
            return true;
          }
        }
        return false;
      });
    }

    if (!msgBtnClicked) {
      try { await page.screenshot({ path: '/tmp/tt-profile.png' }); } catch(e) {}
      return { success: false, error: 'Botao de mensagem nao encontrado no perfil @' + username };
    }

    await sleep(4000);

    // Procurar caixa de texto do chat
    var chatInput = await page.$('div[contenteditable="true"]') ||
                    await page.$('[data-e2e="chat-input"]') ||
                    await page.$('textarea');

    if (!chatInput) {
      try { await page.screenshot({ path: '/tmp/tt-chat.png' }); } catch(e) {}
      return { success: false, error: 'Caixa de mensagem nao encontrada no TikTok' };
    }

    await chatInput.click();
    await sleep(500);
    await page.keyboard.type(message, { delay: 30 });
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(2000);

    return { success: true, message: 'DM enviado para @' + username + ' no TikTok' };
  } catch(e) {
    console.error('[TT] DM error:', e.message);
    return { success: false, error: e.message };
  }
}

app.post('/api/dm/tiktok', authMiddleware, async function(req, res) {
  var username = req.body.username;
  var message = req.body.message;
  if (!username || !message) return res.status(400).json({ error: 'Missing username or message' });
  var result = await sendTTDM(username, message);
  return res.json(result);
});

// ============================================
// BATCH DM
// ============================================

app.post('/api/dm/batch', authMiddleware, async function(req, res) {
  var platform = req.body.platform;
  var targets = req.body.targets;

  if (!platform || !targets || !Array.isArray(targets)) {
    return res.status(400).json({ error: 'Envia {platform: "instagram", targets: [{username, message}]}' });
  }

  console.log('[Batch] ' + targets.length + ' DMs para ' + platform);

  var results = [];
  for (var i = 0; i < targets.length; i++) {
    var target = targets[i];
    console.log('[Batch] (' + (i+1) + '/' + targets.length + ') @' + target.username);

    try {
      var result;
      if (platform === 'instagram') result = await sendIGDM(target.username, target.message);
      else if (platform === 'facebook') result = await sendFBDM(target.username, target.message);
      else if (platform === 'tiktok') result = await sendTTDM(target.username, target.message);
      else result = { success: false, error: 'Plataforma desconhecida: ' + platform };

      results.push({ username: target.username, platform: platform, success: result.success, error: result.error, needLogin: result.needLogin });
    } catch(e) {
      results.push({ username: target.username, platform: platform, success: false, error: e.message });
    }

    // Delay entre DMs (3-8 segundos)
    if (i < targets.length - 1) {
      var delay = 3000 + Math.floor(Math.random() * 5000);
      console.log('[Batch] Esperando ' + delay + 'ms...');
      await sleep(delay);
    }
  }

  res.json({ results: results });
});

// ============================================
// LOGIN ALL (loga nas 3 plataformas de uma vez)
// ============================================

app.post('/api/login/all', authMiddleware, async function(req, res) {
  var results = {};

  // Instagram
  try {
    var igReq = { body: req.body, headers: req.headers };
    var igRes = await new Promise(function(resolve) {
      var mockRes = {
        json: function(data) { resolve(data); },
        status: function() { return { json: function(data) { resolve(data); } }; }
      };
      // Reuse the login handler directly
      (async function() {
        try {
          var username = (req.body.ig_username || '') || (process.env.IG_USERNAME || '');
          var password = (req.body.ig_password || '') || (process.env.IG_PASSWORD || '');
          if (username && password) {
            var page = await getPage('instagram');
            await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
            if (!page.url().includes('login') && !page.url().includes('accounts')) {
              await storeIGCookies(page);
              sessions.instagram.loggedIn = true;
              resolve({ success: true, message: 'IG ja logado' });
              return;
            }
            await page.waitForSelector('input[name="username"]', { timeout: 15000 });
            await page.click('input[name="username"]', { clickCount: 3 });
            await page.type('input[name="username"]', username, { delay: 80 });
            await page.click('input[name="password"]', { clickCount: 3 });
            await page.type('input[name="password"]', password, { delay: 80 });
            await page.click('button[type="submit"]');
            await sleep(6000);
            await handleIGPopups(page);
            var url = page.url();
            if (!url.includes('login')) {
              await storeIGCookies(page);
              sessions.instagram.loggedIn = true;
              resolve({ success: true, message: 'IG login OK' });
            } else {
              sessions.instagram.loggedIn = false;
              resolve({ success: false, error: 'IG login falhou' });
            }
          } else {
            resolve({ success: false, error: 'Sem credenciais IG' });
          }
        } catch(e) { resolve({ success: false, error: e.message }); }
      })();
    });
    results.instagram = igRes;
  } catch(e) { results.instagram = { success: false, error: e.message }; }

  // Facebook e TikTok seriam adicionados aqui de forma similar
  // Para simplificar, retorna o status atual
  results.facebook = { success: sessions.facebook.loggedIn, message: sessions.facebook.loggedIn ? 'Ja logado' : 'Faz login separado' };
  results.tiktok = { success: sessions.tiktok.loggedIn, message: sessions.tiktok.loggedIn ? 'Ja logado' : 'Faz login separado' };

  res.json(results);
});

// ============================================
// STATUS & DASHBOARD
// ============================================

app.get('/api/status', authMiddleware, async function(req, res) {
  var browserStatus = 'disconnected';
  try {
    if (browser && browser.connected) {
      var pages_list = await browser.pages();
      browserStatus = 'connected (' + pages_list.length + ' pages)';
    }
  } catch(e) {}

  res.json({
    status: 'running',
    uptime: Math.floor(process.uptime()),
    browser: browserStatus,
    loginStatus: {
      instagram: sessions.instagram.loggedIn,
      facebook: sessions.facebook.loggedIn,
      tiktok: sessions.tiktok.loggedIn
    }
  });
});

// Screenshot para debug
app.get('/api/screenshot/:platform', authMiddleware, async function(req, res) {
  try {
    var platform = req.params.platform;
    if (platform === 'all') platform = 'instagram';
    var page = await getPage(platform);
    var screenshot = await page.screenshot({ encoding: 'base64' });
    res.json({ screenshot: 'data:image/png;base64,' + screenshot, platform: platform });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// Dashboard simples
app.get('/', function(req, res) {
  var uptime = Math.floor(process.uptime());
  var minutes = Math.floor(uptime / 60);
  var seconds = uptime % 60;

  res.send('<!DOCTYPE html><html><head><title>MBA Brain - DM Service</title>' +
    '<style>body{font-family:monospace;max-width:700px;margin:40px auto;padding:20px;background:#0a0a0a;color:#e0e0e0;}' +
    'h1{color:#7c3aed;} h3{color:#a78bfa;} .ok{color:#22c55e;} .err{color:#ef4444;} pre{background:#1a1a2e;padding:15px;border-radius:8px;overflow-x:auto;}</style>' +
    '</head><body>' +
    '<h1>MBA Brain - DM Service</h1>' +
    '<p>Status: <span class="ok">Running</span> | Uptime: ' + minutes + 'm ' + seconds + 's</p>' +
    '<h3>Login Status</h3>' +
    '<ul>' +
    '<li>Instagram: ' + (sessions.instagram.loggedIn ? '<span class="ok">Online</span>' : '<span class="err">Offline</span>') + (sessions.instagram.cookies ? ' (API ready)' : '') + '</li>' +
    '<li>Facebook: ' + (sessions.facebook.loggedIn ? '<span class="ok">Online</span>' : '<span class="err">Offline</span>') + '</li>' +
    '<li>TikTok: ' + (sessions.tiktok.loggedIn ? '<span class="ok">Online</span>' : '<span class="err">Offline</span>') + '</li>' +
    '</ul>' +
    '<h3>API Endpoints</h3>' +
    '<pre>' +
    'POST /api/login/instagram\n' +
    'POST /api/login/facebook\n' +
    'POST /api/login/tiktok\n' +
    'POST /api/login/all\n\n' +
    'POST /api/dm/instagram   {"username":"...", "message":"..."}\n' +
    'POST /api/dm/facebook    {"username":"...", "message":"..."}\n' +
    'POST /api/dm/tiktok      {"username":"...", "message":"..."}\n' +
    'POST /api/dm/batch       {"platform":"instagram", "targets":[{"username":"...","message":"..."}]}\n\n' +
    'GET  /api/status\n' +
    'GET  /api/screenshot/:platform\n' +
    '</pre>' +
    '<p style="color:#666;">Powered by Puppeteer + Stealth | Deploy on Render.com</p>' +
    '</body></html>');
});

// ============================================
// START
// ============================================

app.listen(PORT, '0.0.0.0', function() {
  console.log('============================================');
  console.log('MBA Brain DM Service');
  console.log('Port: ' + PORT);
  console.log('API Key: ' + API_KEY.substring(0, 8) + '...');
  console.log('============================================');
});