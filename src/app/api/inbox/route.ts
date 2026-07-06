import { NextResponse } from 'next/server';

export var maxDuration = 30;

/* Default credentials */
var _igS1 = '22987806071%3AdZfcQqlpEVlzPb%3A17%3AAYh';
var _igS2 = 'NXm-SkI1Lf16_mMpsfnCYGpcIkKJx0uGdlN6Hpg';
var DEFAULT_IG_SESSION = _igS1 + _igS2;
var DEFAULT_IG_CSRF = 'm6Aj_q2JVN0VbXpC2rZDf6';
var DEFAULT_TT_SESSION = '80d4dc2bfd686d8548d2ab9d832e1281';
var DEFAULT_TT_CSRF = 'lAXQPAkz-jtEWROwVmW7tec4lCWq2iqX62qc';

function fetchW(url, opts, timeout) {
  if (!timeout) timeout = 10000;
  var ac = new AbortController();
  var tid = setTimeout(function() { ac.abort(); }, timeout);
  return fetch(url, { ...opts, signal: ac.signal }).then(function(res) {
    clearTimeout(tid);
    return res;
  }).catch(function() {
    clearTimeout(tid);
    return null;
  });
}

/* ===== INSTAGRAM INBOX ===== */

function fetchIGInbox(sessionid, csrftoken) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var cookies = 'sessionid=' + sessionid +
    '; csrftoken=' + csrftoken +
    '; ds_user_id=' + dsUserId +
    '; ig_did=00000000-0000-0000-0000-000000000000' +
    '; mid=XYZ; rur=FTW';

  return fetchW(
    'https://www.instagram.com/api/v1/direct_v2/inbox/?visual_messages_return=false&thread_message_limit=10&persistentBadging=true&limit=20',
    {
      headers: {
        'Cookie': cookies,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrftoken,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'pt-PT,pt;q=0.9',
        'X-IG-WWW-Claim': '0'
      }
    },
    12000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

function parseIGInbox(data, knownUsernames) {
  var messages = [];
  if (!data || !data.inbox || !data.inbox.threads) return messages;
  var threads = data.inbox.threads;

  for (var ti = 0; ti < threads.length; ti++) {
    var thread = threads[ti];
    var items = thread.items || [];
    var users = thread.users || [];

    /* Find the other person in this thread */
    var otherUsername = '';
    var otherUserId = '';
    for (var ui = 0; ui < users.length; ui++) {
      var u = users[ui];
      var un = (u.username || '').toLowerCase();
      if (knownUsernames.indexOf(un) >= 0) {
        otherUsername = un;
        otherUserId = String(u.pk || u.id || '');
        break;
      }
    }
    if (!otherUsername) continue;

    /* Get text messages from the other person */
    for (var mi = 0; mi < items.length; mi++) {
      var item = items[mi];
      var senderId = String(item.user_id || item.sender_id || '');
      if (senderId !== otherUserId) continue;
      if (item.item_type !== 'text') continue;
      var text = item.text || '';
      if (!text.trim()) continue;
      var timestamp = item.timestamp || 0;
      if (timestamp < 1e12 && timestamp > 0) timestamp = timestamp * 1000;

      messages.push({
        platform: 'instagram',
        username: otherUsername,
        content: text,
        timestamp: timestamp,
        threadId: thread.thread_id || ''
      });
    }
  }
  return messages;
}

/* ===== TIKTOK INBOX ===== */

function fetchTTInbox(sessionid, csrftoken) {
  var cookies = 'sessionid=' + sessionid + '; tt_csrf_token=' + csrftoken;
  return fetchW(
    'https://www.tiktok.com/api/chat/inbox/?count=20&cursor=0&unread=0',
    {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Referer': 'https://www.tiktok.com/'
      }
    },
    10000
  ).then(function(res) {
    if (!res || !res.ok) return null;
    return res.json().then(function(d) { return d; }).catch(function() { return null; });
  });
}

function parseTTInbox(data, knownUsernames) {
  var messages = [];
  if (!data || !data.data) return messages;
  var chats = data.data.chats || data.data.conversations || [];

  for (var ci = 0; ci < chats.length; ci++) {
    var chat = chats[ci];
    var roomName = (chat.room_name || '').replace('@', '').toLowerCase();
    if (knownUsernames.indexOf(roomName) < 0) continue;
    var chatMsgs = chat.messages || [];

    for (var mi = 0; mi < chatMsgs.length; mi++) {
      var msg = chatMsgs[mi];
      if (msg.from_user_id === chat.to_user_id) continue;
      var text = msg.msg_content || '';
      if (!text.trim()) continue;
      messages.push({
        platform: 'tiktok',
        username: roomName,
        content: text,
        timestamp: msg.create_time ? msg.create_time * 1000 : Date.now(),
        threadId: chat.room_id || ''
      });
    }
  }
  return messages;
}

/* ===== MAIN HANDLER ===== */

export async function POST(request) {
  var body = await request.json();

  /* Use provided or default credentials */
  var igSession = body.igSession || DEFAULT_IG_SESSION;
  var igCsrf = body.igCsrf || DEFAULT_IG_CSRF;
  var ttSession = body.ttSession || DEFAULT_TT_SESSION;
  var ttCsrf = body.ttCsrf || DEFAULT_TT_CSRF;

  var knownUsernames = body.knownUsernames || [];
  var lastCheck = body.lastCheckTimestamp || 0;

  var knownLower = [];
  for (var ki = 0; ki < knownUsernames.length; ki++) {
    knownLower.push(knownUsernames[ki].toLowerCase());
  }

  var allMessages = [];
  var logs = [];

  /* Check Instagram */
  if (igSession && igCsrf) {
    var igData = await fetchIGInbox(igSession, igCsrf);
    if (igData) {
      var igMsgs = parseIGInbox(igData, knownLower);
      logs.push('IG inbox: ' + igMsgs.length + ' msgs');
      for (var ii = 0; ii < igMsgs.length; ii++) {
        if (igMsgs[ii].timestamp > lastCheck) allMessages.push(igMsgs[ii]);
      }
    } else {
      logs.push('IG inbox: falhou');
    }
  }

  /* Check TikTok */
  if (ttSession && ttCsrf) {
    var ttData = await fetchTTInbox(ttSession, ttCsrf);
    if (ttData) {
      var ttMsgs = parseTTInbox(ttData, knownLower);
      logs.push('TT inbox: ' + ttMsgs.length + ' msgs');
      for (var ti = 0; ti < ttMsgs.length; ti++) {
        if (ttMsgs[ti].timestamp > lastCheck) allMessages.push(ttMsgs[ti]);
      }
    } else {
      logs.push('TT inbox: falhou');
    }
  }

  allMessages.sort(function(a, b) { return a.timestamp - b.timestamp; });

  return NextResponse.json({
    success: true,
    newMessages: allMessages,
    total: allMessages.length,
    log: logs,
    checkTimestamp: Date.now()
  });
}