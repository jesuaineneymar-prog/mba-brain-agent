const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME = '/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const OUT = '/home/z/my-project/download/';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const results = {};

  // ========================================
  //  INSTAGRAM
  // ========================================
  console.log('\n===== INSTAGRAM =====');
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: OUT + 'ig-1.png' });

    // Wait for username input
    await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });

    // Fill form
    await page.type('input[name="username"]', 'jesuaineneymar', { delay: 50 });
    await page.type('input[name="password"]', '9adJpLRGPX#YGx$', { delay: 50 });
    await sleep(500);
    await page.screenshot({ path: OUT + 'ig-2.png' });

    // Click login
    await page.click('button[type="submit"]');
    console.log('[IG] Waiting for login...');

    // Wait for navigation or error
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      sleep(15000)
    ]);

    await sleep(3000);
    await page.screenshot({ path: OUT + 'ig-3.png' });

    // Check URL
    const url = page.url();
    console.log('[IG] Current URL:', url);

    // Get all cookies
    const cookies = await page.cookies();
    const cookieMap = {};
    for (const c of cookies) cookieMap[c.name] = c.value;

    console.log('[IG] Cookie names:', Object.keys(cookieMap).join(', '));

    if (cookieMap.sessionid) {
      results.instagram = {
        success: true,
        sessionid: cookieMap.sessionid,
        csrftoken: cookieMap.csrftoken,
        ds_user_id: cookieMap.ds_user_id
      };
      console.log('[IG] SUCCESS! sessionid:', cookieMap.sessionid.slice(0, 30) + '...');
    } else {
      // Check for error message
      const errorEl = await page.$('#slfErrorAlert');
      const errorMsg = errorEl ? await page.evaluate(el => el.textContent, errorEl) : '';
      console.log('[IG] No sessionid. Error:', errorMsg || 'None visible');

      // Check if there's a challenge
      if (url.includes('challenge') || url.includes('checkpoint')) {
        console.log('[IG] Security challenge detected');
      }

      results.instagram = {
        success: false,
        error: errorMsg || 'No sessionid received. ' + url,
        cookieNames: Object.keys(cookieMap),
        url: url
      };
    }

    await page.close();
  } catch(e) {
    results.instagram = { success: false, error: e.message };
    console.error('[IG] Error:', e.message);
  }

  // ========================================
  //  FACEBOOK
  // ========================================
  console.log('\n===== FACEBOOK =====');
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: OUT + 'fb-1.png' });

    // Fill form
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.type('#email', '+244 925049405', { delay: 50 });
    await page.type('#pass', 'Jesus888#', { delay: 50 });
    await sleep(500);
    await page.screenshot({ path: OUT + 'fb-2.png' });

    // Click login
    await page.click('#loginbutton');
    console.log('[FB] Waiting for login...');

    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {}),
      sleep(20000)
    ]);

    await sleep(3000);
    const url = page.url();
    await page.screenshot({ path: OUT + 'fb-3.png' });
    console.log('[FB] Current URL:', url.slice(0, 120));

    // Get cookies
    const cookies = await page.cookies();
    const cookieMap = {};
    for (const c of cookies) cookieMap[c.name] = c.value;

    console.log('[FB] Cookie names:', Object.keys(cookieMap).join(', '));

    if (cookieMap.c_user && cookieMap.xs) {
      // Navigate to home to get fb_dtsg
      await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
      await sleep(2000);

      const fbDtsg = await page.evaluate(() => {
        const el = document.querySelector('input[name="fb_dtsg"]');
        return el ? el.value : '';
      });

      results.facebook = {
        success: true,
        fbCookie: Object.entries(cookieMap).map(([k, v]) => k + '=' + v).join('; '),
        fbDtsg: fbDtsg,
        c_user: cookieMap.c_user
      };
      console.log('[FB] SUCCESS! c_user:', cookieMap.c_user);
    } else {
      if (url.includes('two_step') || url.includes('checkpoint')) {
        results.facebook = { success: false, error: '2FA ativado no Facebook. Precisas de desativar ou fornecer o codigo.' };
      } else {
        results.facebook = { success: false, error: 'Login falhou. URL: ' + url.slice(0, 100), cookieNames: Object.keys(cookieMap) };
      }
      console.log('[FB] FAILED');
    }

    await page.close();
  } catch(e) {
    results.facebook = { success: false, error: e.message };
    console.error('[FB] Error:', e.message);
  }

  // ========================================
  //  TIKTOK
  // ========================================
  console.log('\n===== TIKTOK =====');
  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 390, height: 844 });

    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: OUT + 'tt-1.png' });

    // Click "Use phone/email/username"
    const clicked = await page.evaluate(() => {
      const els = document.querySelectorAll('button, a, div[data-e2e], span');
      for (const el of els) {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('phone') || t.includes('email') || t.includes('user')) {
          el.click();
          return t.slice(0, 30);
        }
      }
      return 'not found';
    });
    console.log('[TT] Clicked:', clicked);
    await sleep(2000);

    // Fill username
    const inputFound = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const info = [];
      for (const inp of inputs) {
        info.push({ type: inp.type, name: inp.name, placeholder: inp.placeholder });
      }
      return info;
    });
    console.log('[TT] Inputs:', JSON.stringify(inputFound));

    // Type username in first text input
    const firstInput = await page.$('input[type="text"], input[name*="user"], input[name*="email"]');
    if (firstInput) {
      await firstInput.click();
      await firstInput.type('jesuaineneymar', { delay: 50 });
    }

    // Type password
    const passInput = await page.$('input[type="password"]');
    if (passInput) {
      await passInput.click();
      await passInput.type('Jesus888$', { delay: 50 });
    }

    await sleep(500);
    await page.screenshot({ path: OUT + 'tt-2.png' });

    // Click login button
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button, [data-e2e="login-btn"]');
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t === 'log in' || t === 'login' || b.getAttribute('data-e2e') === 'login-btn') {
          b.click();
          return 'clicked';
        }
      }
      return 'no button';
    });
    console.log('[TT] Waiting for login...');

    await Promise.race([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      sleep(15000)
    ]);

    await sleep(3000);
    const url = page.url();
    await page.screenshot({ path: OUT + 'tt-3.png' });
    console.log('[TT] Current URL:', url);

    // Get cookies
    const cookies = await page.cookies();
    const cookieMap = {};
    for (const c of cookies) cookieMap[c.name] = c.value;

    console.log('[TT] Cookie names:', Object.keys(cookieMap).join(', '));

    if (cookieMap.sessionid) {
      results.tiktok = {
        success: true,
        sessionid: cookieMap.sessionid,
        ttCsrf: cookieMap.tt_csrf_token
      };
      console.log('[TT] SUCCESS! sessionid:', cookieMap.sessionid.slice(0, 30) + '...');
    } else {
      results.tiktok = {
        success: false,
        error: 'No sessionid. URL: ' + url.slice(0, 100),
        cookieNames: Object.keys(cookieMap)
      };
      console.log('[TT] FAILED');
    }

    await page.close();
  } catch(e) {
    results.tiktok = { success: false, error: e.message };
    console.error('[TT] Error:', e.message);
  }

  await browser.close();

  // ========================================
  //  SAVE & DISPLAY
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('RESULTADO FINAL');
  console.log('='.repeat(50));

  const output = {};

  if (results.instagram.success) {
    output.instagram = { sessionid: results.instagram.sessionid, csrftoken: results.instagram.csrftoken };
    console.log('\nINSTAGRAM: OK');
    console.log('  sessionid:', results.instagram.sessionid);
    console.log('  csrftoken:', results.instagram.csrftoken);
  } else {
    output.instagram = { error: results.instagram.error };
    console.log('\nINSTAGRAM: FALHOU -', results.instagram.error);
  }

  if (results.facebook.success) {
    output.facebook = { fbCookie: results.facebook.fbCookie, fbDtsg: results.facebook.fbDtsg };
    console.log('\nFACEBOOK: OK');
    console.log('  fbCookie length:', results.facebook.fbCookie.length);
    console.log('  fb_dtsg:', results.facebook.fbDtsg ? 'found' : 'NOT FOUND');
  } else {
    output.facebook = { error: results.facebook.error };
    console.log('\nFACEBOOK: FALHOU -', results.facebook.error);
  }

  if (results.tiktok.success) {
    output.tiktok = { sessionid: results.tiktok.sessionid, ttCsrf: results.tiktok.ttCsrf };
    console.log('\nTIKTOK: OK');
    console.log('  sessionid:', results.tiktok.sessionid);
    console.log('  tt_csrf_token:', results.tiktok.ttCsrf);
  } else {
    output.tiktok = { error: results.tiktok.error };
    console.log('\nTIKTOK: FALHOU -', results.tiktok.error);
  }

  fs.writeFileSync(OUT + 'cookies-result.json', JSON.stringify(results, null, 2));
  fs.writeFileSync(OUT + 'cookies-simple.json', JSON.stringify(output, null, 2));
  console.log('\nGuardado em /home/z/my-project/download/cookies-simple.json');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });