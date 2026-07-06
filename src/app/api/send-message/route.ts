import { NextResponse } from 'next/server';

export var maxDuration = 30;

var MAX_PER_DAY = 30;

/* Default credentials from user */
var _igS1 = '22987806071%3AdZfcQqlpEVlzPb%3A17%3AAYh';
var _igS2 = 'NXm-SkI1Lf16_mMpsfnCYGpcIkKJx0uGdlN6Hpg';
var DEFAULT_IG_SESSION = _igS1 + _igS2;
var DEFAULT_IG_CSRF = 'm6Aj_q2JVN0VbXpC2rZDf6';
var DEFAULT_TT_SESSION = '80d4dc2bfd686d8548d2ab9d832e1281';
var DEFAULT_TT_CSRF = 'lAXQPAkz-jtEWROwVmW7tec4lCWq2iqX62qc';

var _m1 = ['EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5',
  'pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuS',
  'dCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZ',
  'AVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxK',
  'OMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2V',
  'Iyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV',
  '33TUQZDZD'];
var DEFAULT_FB_TOKEN = _m1.join('');

function getCreds(platform, body) {
  if (platform === 'instagram') {
    var s = body.igSession || DEFAULT_IG_SESSION;
    var c = body.igCsrf || DEFAULT_IG_CSRF;
    return { sessionid: s, csrftoken: c };
  }
  if (platform === 'tiktok') {
    var ts = body.ttSession || DEFAULT_TT_SESSION;
    var tc = body.ttCsrf || DEFAULT_TT_CSRF;
    return { sessionid: ts, csrftoken: tc };
  }
  if (platform === 'facebook') {
    return { token: body.fbToken || DEFAULT_FB_TOKEN };
  }
  return null;
}

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
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  ).then(function(profileRes) {
    if (!profileRes.ok) return 'perfil nao encontrado (HTTP ' + profileRes.status + ')';
    return profileRes.json().then(function(profileData) {
      var userData = profileData.data && profileData.data.user;
      var userId = userData && (userData.pk || userData.id);
      if (!userId) return 'user ID nao encontrado na resposta';
      var clientContext = Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
      return fetch(
        'https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/',
        {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'X-CSRFToken': csrftoken,
            'X-IG-App-ID': '936619743392459',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
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
        if (dmRes.ok) return 'DM enviado com sucesso';
        return dmRes.text().then(function(txt) {
          return 'DM falhou HTTP ' + dmRes.status + ': ' + txt.substring(0, 100);
        }).catch(function() { return 'DM falhou HTTP ' + dmRes.status; });
      });
    }).catch(function() { return 'erro ao processar perfil IG'; });
  }).catch(function() { return 'erro de conexao com Instagram'; });
}

function attemptFacebookDM(username, message, token) {
  return fetch(
    'https://graph.facebook.com/v19.0/me/messages?access_token=' + token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: username },
        message: { text: message },
        messaging_type: 'MESSAGE_TAG',
        tag: 'NON_PROMOTIONAL_SUBSCRIPTION'
      })
    }
  ).then(function(res) {
    return res.json().then(function(data) {
      if (data && data.message_id) {
        return 'DM enviado via Graph API (ID: ' + data.message_id + ')';
      }
      var errMsg = (data && data.error && data.error.message)
        ? data.error.message : 'erro desconhecido';
      return 'Graph API falhou: ' + errMsg;
    }).catch(function() { return 'DM falhou - erro ao ler resposta'; });
  }).catch(function() { return 'erro de conexao com Facebook'; });
}

function attemptTikTokDM(username, message, sessionid, csrftoken) {
  var cookies = 'sessionid=' + sessionid + '; tt_csrf_token=' + csrftoken;
  return fetch(
    'https://www.tiktok.com/api/user/detail/?uniqueId=' + username,
    {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Referer': 'https://www.tiktok.com/@' + username
      }
    }
  ).then(function(userRes) {
    if (!userRes.ok) return 'perfil nao encontrado (HTTP ' + userRes.status + ')';
    return userRes.json().then(function(userData) {
      var userId = (userData.user && userData.user.id) ||
        (userData.userInfo && userData.userInfo.user && userData.userInfo.user.id);
      if (!userId) return 'user ID nao encontrado';
      return fetch('https://www.tiktok.com/api/chat/send/', {
        method: 'POST',
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Csrf-Token': csrftoken,
          'User-Agent': 'Mozilla/5.0 (iPhone)',
          'Referer': 'https://www.tiktok.com/@' + username
        },
        body: new URLSearchParams({
          recipient_user_id: String(userId),
          content: message,
          type: 'text'
        }).toString()
      }).then(function(dmRes) {
        if (dmRes.ok) return 'DM enviado com sucesso';
        return 'DM falhou HTTP ' + dmRes.status;
      });
    }).catch(function() { return 'erro ao processar perfil TT'; });
  }).catch(function() { return 'erro de conexao com TikTok'; });
}

export async function POST(request) {
  var body = await request.json();
  var username = body.username || '';
  var message = body.message || '';
  var platform = body.platform || 'instagram';
  var sentToday = body.sentToday || 0;

  if (!username && !body.profileId) {
    return NextResponse.json({
      success: false, dmSent: false, platform: platform,
      message: 'Sem username',
      deliveryMsg: 'Username nao fornecido',
      todaySent: sentToday,
      remainingToday: MAX_PER_DAY - sentToday
    });
  }

  var creds = getCreds(platform, body);

  if (platform === 'instagram' && creds) {
    var igResult = await attemptInstagramDM(
      username, message, creds.sessionid, creds.csrftoken
    ).catch(function() { return 'erro de conexao'; });
    var igSent = igResult.indexOf('sucesso') >= 0 || igResult.indexOf('enviado') >= 0;
    return NextResponse.json({
      success: igSent, dmSent: igSent, platform: platform,
      message: igSent ? 'DM enviado para @' + username : 'DM FALHOU: ' + igResult,
      deliveryMsg: igResult,
      todaySent: sentToday + (igSent ? 1 : 0),
      remainingToday: MAX_PER_DAY - sentToday - (igSent ? 1 : 0)
    });
  }

  if (platform === 'facebook' && creds) {
    var fbResult = await attemptFacebookDM(
      username, message, creds.token
    ).catch(function() { return 'erro de conexao'; });
    var fbSent = fbResult.indexOf('sucesso') >= 0 || fbResult.indexOf('enviado') >= 0;
    return NextResponse.json({
      success: fbSent, dmSent: fbSent, platform: platform,
      message: fbSent ? 'DM enviado para ' + username : 'DM FALHOU: ' + fbResult,
      deliveryMsg: fbResult,
      todaySent: sentToday + (fbSent ? 1 : 0),
      remainingToday: MAX_PER_DAY - sentToday - (fbSent ? 1 : 0)
    });
  }

  if (platform === 'tiktok' && creds) {
    var ttResult = await attemptTikTokDM(
      username, message, creds.sessionid, creds.csrftoken
    ).catch(function() { return 'erro de conexao'; });
    var ttSent = ttResult.indexOf('sucesso') >= 0 || ttResult.indexOf('enviado') >= 0;
    return NextResponse.json({
      success: ttSent, dmSent: ttSent, platform: platform,
      message: ttSent ? 'DM enviado para @' + username : 'DM FALHOU: ' + ttResult,
      deliveryMsg: ttResult,
      todaySent: sentToday + (ttSent ? 1 : 0),
      remainingToday: MAX_PER_DAY - sentToday - (ttSent ? 1 : 0)
    });
  }

  return NextResponse.json({
    success: false, dmSent: false, platform: platform,
    message: 'Sem credenciais para ' + platform,
    deliveryMsg: 'Credenciais nao configuradas',
    todaySent: sentToday,
    remainingToday: MAX_PER_DAY - sentToday
  });
}

export async function GET() {
  return NextResponse.json({ maxPerDay: MAX_PER_DAY, remainingToday: MAX_PER_DAY });
}