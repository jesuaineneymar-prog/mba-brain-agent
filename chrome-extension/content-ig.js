// ============================================================
//  MBA Brain DM Sender — INSTAGRAM CONTENT SCRIPT
//  Corre em instagram.com com a sessao REAL do utilizador
//  Usa fetch() com cookies automaticos (sem copiar nada)
// ============================================================

function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

async function igGetUserId(username) {
  var csrftoken = getCookie('csrftoken');
  if (!csrftoken) return null;

  try {
    var res = await fetch('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
      headers: {
        'x-csrftoken': csrftoken,
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest'
      }
    });
    if (!res.ok) return null;
    var data = await res.json();
    return data.data && data.data.user ? String(data.data.user.pk || data.data.user.id) : null;
  } catch(e) { return null; }
}

async function igSendDM(userId, message) {
  var csrftoken = getCookie('csrftoken');
  if (!csrftoken) return { success: false, error: 'Sem csrftoken. Faz login no Instagram.' };

  try {
    // 1. Criar thread
    var threadRes = await fetch('/api/v1/direct_v2/create_thread/', {
      method: 'POST',
      headers: {
        'x-csrftoken': csrftoken,
        'x-ig-app-id': '936619743392459',
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: 'recipient_users=' + JSON.stringify([userId]) +
            '&client_context=' + Date.now() +
            '&device_id=' + (crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36) + Date.now().toString(36)))
    });

    var threadData = await threadRes.json();
    var threadId = threadData.thread_id;

    // Se ja existe (409), procurar na inbox
    if (!threadId) {
      var inboxRes = await fetch('/api/v1/direct_v2/inbox/', {
        headers: { 'x-csrftoken': csrftoken, 'x-ig-app-id': '936619743392459' }
      });
      if (inboxRes.ok) {
        var inboxData = await inboxRes.json();
        var threads = inboxData.inbox && inboxData.inbox.threads ? inboxData.inbox.threads : [];
        for (var i = 0; i < threads.length; i++) {
          var users = threads[i].users || [];
          if (users.length > 0 && String(users[0].pk) === String(userId)) {
            threadId = threads[i].thread_id;
            break;
          }
        }
      }
    }

    if (!threadId) {
      return { success: false, error: 'Nao criou thread' };
    }

    // 2. Enviar mensagem
    var msgRes = await fetch('/api/v1/direct_v2/threads/' + threadId + '/items/', {
      method: 'POST',
      headers: {
        'x-csrftoken': csrftoken,
        'x-ig-app-id': '936619743392459',
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: 'text=' + encodeURIComponent(message) +
            '&client_context=' + Date.now() +
            '&device_id=' + (crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36) + Date.now().toString(36)))
    });

    if (msgRes.ok) {
      return { success: true };
    }
    var errText = '';
    try { errText = await msgRes.text(); } catch(e) {}
    return { success: false, error: 'Erro ao enviar (HTTP ' + msgRes.status + ')' };

  } catch(e) {
    return { success: false, error: e.message || 'Erro de rede' };
  }
}

// Check if logged in
async function checkLogin() {
  var sessionid = getCookie('sessionid');
  var csrftoken = getCookie('csrftoken');
  if (!sessionid || !csrftoken) return { loggedIn: false };

  try {
    var res = await fetch('/api/v1/accounts/current_user/?fields=username', {
      headers: { 'x-csrftoken': csrftoken, 'x-ig-app-id': '936619743392459' }
    });
    return { loggedIn: res.ok };
  } catch(e) { return { loggedIn: false }; }
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'check-login') {
    checkLogin().then(sendResponse);
    return true; // async
  }

  if (request.type === 'send-dm') {
    (async function() {
      // Check login first
      var login = await checkLogin();
      if (!login.loggedIn) {
        sendResponse({ success: false, error: 'Nao estas logado no Instagram' });
        return;
      }

      // Get user ID
      var userId = await igGetUserId(request.username);
      if (!userId) {
        sendResponse({ success: false, error: 'Utilizador @' + request.username + ' nao encontrado' });
        return;
      }

      // Send DM
      var result = await igSendDM(userId, request.message);
      sendResponse(result);
    })();
    return true; // async
  }
});