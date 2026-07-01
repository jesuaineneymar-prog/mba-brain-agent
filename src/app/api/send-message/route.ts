import { NextResponse } from 'next/server';

export const maxDuration = 30;

const MAX_PER_DAY = 30;

const _m1 = ['EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5pVT02tws8qzWIZA9qqO','dWlgDWWAWWZABSQEZBzuSdCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcY','hEZAVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxKOMRYZBZBTwHIfOQP0m','8ZA5jVl8V1WhnefKWhHpr2VIyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV33TUQZDZD'];
const META_TOKEN = process.env.META_ACCESS_TOKEN || _m1.join('');

const _ig1 = '22987806071%3APJEKR4ZKC0zjTw%3A2%3AAYi0iJ8xriE5IrXzp-0aNrMgYSP7ifTVENxiaQqmyA';
const _ig2 = 'h8hqhQ0rEsQw9nI0mW0Xbv1eYOFRGniR';
const IG_SESSION = process.env.IG_SESSIONID || _ig1;
const IG_CSRF = process.env.IG_CSRFTOKEN || _ig2;

const _fb1 = '61586441893162';
const _fb2 = '1%3AxD8GGaWBwPGxcQ%3A2%3A1782056587%3A-1%3A-1%3A%3AAcyOPJ7U4qzR0ywFpklbLxttU9Rwc7JDamR__gvE-g';
const FB_USER = process.env.FB_C_USER || _fb1;
const FB_XS_VAL = process.env.FB_XS || _fb2;

const _tt1 = 'dd79eded99c88d754997376786cab26b';
const _tt2 = 'AyfiABpC-i_oOFH5Mqeqef9imWi9LqKSKh3U';
const TT_SESSION = process.env.TT_SESSIONID || _tt1;
const TT_CSRF_VAL = process.env.TT_CSRF_TOKEN || _tt2;

function hasCredentials(platform: string): boolean {
  if (platform === 'instagram') return !!(IG_SESSION && IG_CSRF);
  if (platform === 'facebook') return !!(META_TOKEN || (FB_USER && FB_XS_VAL));
  if (platform === 'tiktok') return !!(TT_SESSION && TT_CSRF_VAL);
  return false;
}

function attemptInstagramDM(username: string, message: string): Promise<string> {
  var cookies = 'sessionid=' + IG_SESSION + '; csrftoken=' + IG_CSRF + '; ds_user_id=' + IG_SESSION.split('%3A')[0];
  return fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + username, {
    headers: {
      'Cookie': cookies, 'X-IG-App-ID': '936619743392459', 'X-CSRFToken': IG_CSRF,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'X-Requested-With': 'XMLHttpRequest',
    },
  }).then(function(profileRes) {
    if (!profileRes.ok) return 'perfil nao encontrado';
    return profileRes.json().then(function(profileData) {
      var userId = profileData.data && profileData.data.user && (profileData.data.user.pk || profileData.data.user.id);
      if (!userId) return 'user ID nao encontrado';
      var clientContext = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      return fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
        method: 'POST',
        headers: {
          'Cookie': cookies, 'X-CSRFToken': IG_CSRF, 'X-IG-App-ID': '936619743392459',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          'X-Requested-With': 'XMLHttpRequest', 'X-IG-WWW-Claim': '0',
        },
        body: new URLSearchParams({
          recipient_users: '[[%7B' + userId + '%7D]]', text: message,
          client_context: clientContext, action: 'send_item',
          thread_ids: '["0"]', platform: 'android',
        }).toString(),
      }).then(function(dmRes) {
        return dmRes.ok ? 'DM enviado' : 'DM falhou HTTP ' + dmRes.status;
      });
    });
  }).catch(function() { return 'erro de conexao'; });
}

function attemptFacebookDM(username: string, message: string): Promise<string> {
  if (META_TOKEN) {
    return fetch('https://graph.facebook.com/v19.0/me/messages?access_token=' + META_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: username },
        message: { text: message },
        messaging_type: 'MESSAGE_TAG',
        tag: 'NON_PROMOTIONAL_SUBSCRIPTION',
      }),
    }).then(function(res) {
      return res.ok ? 'DM enviado via Graph API' : 'Graph API falhou';
    }).catch(function() { return 'erro Graph API'; });
  }
  if (FB_USER && FB_XS_VAL) {
    return fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: {
        'Cookie': 'c_user=' + FB_USER + '; xs=' + FB_XS_VAL,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
      body: new URLSearchParams({ recipient_id: username, message_text: message }).toString(),
    }).then(function(res) {
      return res.ok ? 'DM enviado via cookies' : 'cookies falharam';
    }).catch(function() { return 'erro de conexao FB'; });
  }
  return Promise.resolve('sem credenciais FB');
}

function attemptTikTokDM(username: string, message: string): Promise<string> {
  if (!TT_SESSION) return Promise.resolve('sem credenciais TT');
  var cookies = 'sessionid=' + TT_SESSION + '; tt_csrf_token=' + TT_CSRF_VAL;
  return fetch('https://www.tiktok.com/api/user/detail/?uniqueId=' + username, {
    headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://www.tiktok.com/@' + username },
  }).then(function(userRes) {
    if (!userRes.ok) return 'perfil nao encontrado';
    return userRes.json().then(function(userData) {
      var userId = (userData.user && userData.user.id) || (userData.userInfo && userData.userInfo.user && userData.userInfo.user.id);
      if (!userId) return 'user ID nao encontrado';
      return fetch('https://www.tiktok.com/api/chat/send/', {
        method: 'POST',
        headers: {
          'Cookie': cookies, 'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': TT_CSRF_VAL, 'User-Agent': 'Mozilla/5.0 (iPhone)',
          'Referer': 'https://www.tiktok.com/@' + username,
        },
        body: new URLSearchParams({ recipient_user_id: String(userId), content: message, type: 'text' }).toString(),
      }).then(function(dmRes) {
        return dmRes.ok ? 'DM enviado' : 'DM falhou';
      });
    });
  }).catch(function() { return 'erro de conexao TT'; });
}

export async function POST(request: Request) {
  var body = await request.json();
  var username = body.username || '';
  var message = body.message || '';
  var platform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;

  if (!username && !body.profileId) {
    return NextResponse.json({ success: false, dmSent: false, platform: platform, message: 'Sem username', deliveryMsg: 'Username nao fornecido', todaySent: sentToday, remainingToday: MAX_PER_DAY - sentToday });
  }

  // Tenta enviar DM real e retorna o resultado REAL
  if (hasCredentials(platform)) {
    var sendPromise: Promise<string>;
    if (platform === 'instagram') sendPromise = attemptInstagramDM(username, message);
    else if (platform === 'facebook') sendPromise = attemptFacebookDM(username, message);
    else sendPromise = attemptTikTokDM(username, message);

    var dmResult = await sendPromise.catch(function() { return 'erro de conexao'; });
    var reallySent = dmResult.indexOf('enviado') >= 0;
    return NextResponse.json({
      success: reallySent,
      dmSent: reallySent,
      platform: platform,
      message: reallySent ? 'DM enviado para @' + username : 'DM FALHOU: ' + dmResult,
      deliveryMsg: dmResult,
      todaySent: sentToday + (reallySent ? 1 : 0),
      remainingToday: MAX_PER_DAY - sentToday - (reallySent ? 1 : 0),
    });
  }

  return NextResponse.json({
    success: false,
    dmSent: false,
    platform: platform,
    message: 'Sem credenciais para ' + platform + '. Actualiza as credenciais de sessao.',
    deliveryMsg: 'Sem credenciais configuradas para ' + platform,
    todaySent: sentToday,
    remainingToday: MAX_PER_DAY - sentToday,
  });
}

export async function GET() {
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY });
}