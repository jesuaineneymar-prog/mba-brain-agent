// ============================================================
//  MBA Brain DM Sender — FACEBOOK CONTENT SCRIPT
//  Corre em facebook.com com a sessao REAL do utilizador
//  Usa fetch() com cookies automaticos
// ============================================================

function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function getFbDtsg() {
  // fb_dtsg esta num input hidden no HTML
  var el = document.querySelector('input[name="fb_dtsg"]');
  if (el) return el.value;
  // Tentar do JSON embeded
  try {
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      var text = scripts[i].textContent || '';
      var m = text.match(/"token":"([^"]+)"/);
      if (m) return m[1];
    }
  } catch(e) {}
  return null;
}

function getJazoest() {
  var el = document.querySelector('input[name="jazoest"]');
  return el ? el.value : '22169';
}

// Check if logged in
async function checkLogin() {
  try {
    var res = await fetch('/api/graphql/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'fb_dtsg=' + encodeURIComponent(getFbDtsg() || '') + '&doc_id=4364992440242396&variables=%7B%22scale%22%3A3%7D',
      credentials: 'include'
    });
    var data = await res.json();
    return { loggedIn: !!(data.data && !data.error) };
  } catch(e) {
    // Se consegue fazer fetch, provavelmente esta logado
    var cuser = getCookie('c_user');
    return { loggedIn: !!cuser };
  }
}

// Get Facebook user ID from username
async function fbGetUserId(username) {
  try {
    // Metodo 1: Graph API (precisa de estar logado)
    var res = await fetch('https://www.facebook.com/' + encodeURIComponent(username), {
      credentials: 'include',
      redirect: 'follow'
    });
    var html = await res.text();

    // Procurar entity_id no HTML
    var idMatch = html.match(/"entity_id"\s*:\s*"?(\d+)"?/);
    if (idMatch) return idMatch[1];

    // Procurar user_id
    var userMatch = html.match(/"user_id"\s*:\s*"?(\d+)"?/);
    if (userMatch) return userMatch[1];

    return null;
  } catch(e) { return null; }
}

// Send DM via Facebook
async function fbSendDM(recipientId, message) {
  var fbDtsg = getFbDtsg();
  if (!fbDtsg) return { success: false, error: 'fb_dtsg nao encontrado. Recarrega o Facebook.' };

  try {
    var body = 'fb_dtsg=' + encodeURIComponent(fbDtsg) +
      '&jazoest=' + encodeURIComponent(getJazoest()) +
      '&body=' + encodeURIComponent(message) +
      '&ids[0]=' + recipientId +
      '&action=send';

    var res = await fetch('/messaging/send/', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://www.facebook.com',
        'referer': 'https://www.facebook.com/messages/t/' + recipientId
      },
      body: body,
      credentials: 'include'
    });

    var data = await res.json();
    if (!data.error && data.success !== false) {
      return { success: true };
    }
    return { success: false, error: data.error || 'Erro no envio' };
  } catch(e) {
    return { success: false, error: e.message || 'Erro de rede' };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'check-login') {
    checkLogin().then(sendResponse);
    return true;
  }

  if (request.type === 'send-dm') {
    (async function() {
      var login = await checkLogin();
      if (!login.loggedIn) {
        sendResponse({ success: false, error: 'Nao estas logado no Facebook' });
        return;
      }

      var userId = await fbGetUserId(request.username);
      if (!userId) {
        sendResponse({ success: false, error: 'Perfil ' + request.username + ' nao encontrado' });
        return;
      }

      var result = await fbSendDM(userId, request.message);
      sendResponse(result);
    })();
    return true;
  }
});