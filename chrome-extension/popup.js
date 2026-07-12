// ============================================================
//  MBA Brain DM Sender — POPUP
//  Lê perfis do MBA panel, envia DMs via content scripts
// ============================================================

var sendBtn = document.getElementById('sendBtn');
var stopBtn = document.getElementById('stopBtn');
var logArea = document.getElementById('logArea');
var platform = document.getElementById('platform');
var messageEl = document.getElementById('message');
var progressSection = document.getElementById('progressSection');
var progressFill = document.getElementById('progressFill');
var progressText = document.getElementById('progressText');
var progressPercent = document.getElementById('progressPercent');
var profileCount = document.getElementById('profileCount');
var profilesSection = document.getElementById('profilesSection');
var profileList = document.getElementById('profileList');
var pendingCount = document.getElementById('pendingCount');
var igDot = document.getElementById('igDot');
var igLabel = document.getElementById('igLabel');
var fbDot = document.getElementById('fbDot');
var fbLabel = document.getElementById('fbLabel');

var profiles = [];
var sending = false;
var stopped = false;

// Default message
messageEl.value = 'Ola,\nSomos a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.\nAcompanhamos o seu perfil com interesse e gostariamos de lhe apresentar uma proposta de aquisicao da sua conta.\n\nEstamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.\n\nCumprimentos,\nEquipa Mwango Brain\nmwangobrain.com';

function log(msg, type) {
  var div = document.createElement('div');
  div.className = 'log-line ' + (type || 'info');
  div.textContent = (type === 'ok' ? '\u2713 ' : type === 'err' ? '\u2717 ' : '') + msg;
  logArea.appendChild(div);
  logArea.scrollTop = logArea.scrollHeight;
}

function setProgress(current, total) {
  var pct = total > 0 ? Math.round((current / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = current + '/' + total;
  progressPercent.textContent = pct + '%';
}

// Check IG/FB login status
async function checkPlatforms() {
  // Check Instagram
  try {
    var [igTab] = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
    if (igTab) {
      var response = await chrome.tabs.sendMessage(igTab.id, { type: 'check-login' });
      if (response && response.loggedIn) {
        igDot.className = 'dot ok';
        igLabel.textContent = 'IG: logado';
      } else {
        igDot.className = 'dot no';
        igLabel.textContent = 'IG: nao logado';
      }
    } else {
      igDot.className = 'dot no';
      igLabel.textContent = 'IG: sem aba';
    }
  } catch(e) {
    igDot.className = 'dot no';
    igLabel.textContent = 'IG: abre o IG';
  }

  // Check Facebook
  try {
    var [fbTab] = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
    if (fbTab) {
      var response2 = await chrome.tabs.sendMessage(fbTab.id, { type: 'check-login' });
      if (response2 && response2.loggedIn) {
        fbDot.className = 'dot ok';
        fbLabel.textContent = 'FB: logado';
      } else {
        fbDot.className = 'dot no';
        fbLabel.textContent = 'FB: nao logado';
      }
    } else {
      fbDot.className = 'dot no';
      fbLabel.textContent = 'FB: sem aba';
    }
  } catch(e) {
    fbDot.className = 'dot no';
    fbLabel.textContent = 'FB: abre o FB';
  }
}

// Load profiles from MBA panel
async function loadProfiles() {
  profiles = [];
  log('A procurar MBA panel...', 'info');

  // Find MBA tab
  var tabs = await chrome.tabs.query({});
  var mbaTab = null;
  for (var i = 0; i < tabs.length; i++) {
    var url = tabs[i].url || '';
    if (url.indexOf('vercel.app') >= 0 || url.indexOf('mwangobrain') >= 0) {
      mbaTab = tabs[i];
      break;
    }
  }

  if (!mbaTab) {
    log('MBA panel nao encontrada. Abre o painel primeiro.', 'err');
    sendBtn.textContent = 'Abre o MBA panel primeiro';
    sendBtn.disabled = true;
    return;
  }

  // Inject content script to read profiles
  try {
    var results = await chrome.scripting.executeScript({
      target: { tabId: mbaTab.id },
      func: function() {
        try {
          var raw = localStorage.getItem('mba_profiles') || '[]';
          return JSON.parse(raw);
        } catch(e) { return []; }
      }
    });
    profiles = results[0].result || [];
  } catch(e) {
    log('Erro ao ler perfis: ' + e.message, 'err');
    return;
  }

  // Filter: uncontacted, by platform
  var plat = platform.value;
  var pending = profiles.filter(function(p) {
    if (plat === 'instagram' && p.platform !== 'instagram') return false;
    if (plat === 'facebook' && p.platform !== 'facebook') return false;
    // Not yet contacted
    if (p.status === 'contacted' || p.status === 'replied' || p.status === 'accepted') return false;
    // No successful DM
    var msgs = p.messages || [];
    for (var j = 0; j < msgs.length; j++) {
      if (msgs[j].direction === 'outbound' && msgs[j].delivered) return false;
    }
    return true;
  });

  // Sort by angolaScore
  pending.sort(function(a, b) { return (b.angolaScore || 0) - (a.angolaScore || 0); });

  profileCount.textContent = profiles.length + ' perfis';
  pendingCount.textContent = pending.length;

  if (pending.length > 0) {
    profilesSection.style.display = 'block';
    profileList.textContent = pending.slice(0, 10).map(function(p) {
      return '@' + p.username + ' (' + p.platform + ')';
    }).join(' | ') + (pending.length > 10 ? ' ...+' + (pending.length - 10) : '');
    sendBtn.textContent = 'Enviar ' + pending.length + ' DMs';
    sendBtn.disabled = false;
    log(pending.length + ' perfis pendentes em ' + plat, 'ok');
  } else {
    profilesSection.style.display = 'none';
    sendBtn.textContent = 'Sem perfis pendentes';
    sendBtn.disabled = true;
    log('Sem perfis pendentes para ' + plat, 'info');
  }
}

// Send DM to a single profile
async function sendSingleDM(profile, msg, delay) {
  if (stopped) return { ok: false, msg: 'Parado' };

  var plat = profile.platform;
  var tabUrl = plat === 'instagram' ? 'https://www.instagram.com/' : 'https://www.facebook.com/';

  // Find or create tab
  var tabs = await chrome.tabs.query({ url: tabUrl + '*' });
  var tab;
  if (tabs.length > 0) {
    tab = tabs[0];
  } else {
    tab = await chrome.tabs.create({ url: tabUrl, active: false });
    // Wait for page to load
    await new Promise(function(r) { setTimeout(r, 3000); });
  }

  try {
    var response = await chrome.tabs.sendMessage(tab.id, {
      type: 'send-dm',
      username: profile.username,
      message: msg
    });

    if (response && response.success) {
      return { ok: true, msg: '@' + profile.username + ' OK' };
    } else {
      return { ok: false, msg: '@' + profile.username + ': ' + (response ? response.error : 'sem resposta') };
    }
  } catch(e) {
    return { ok: false, msg: '@' + profile.username + ': ' + e.message };
  }
}

// Update profile status in MBA panel
async function updateProfile(profile, success, deliveryMsg) {
  var tabs = await chrome.tabs.query({});
  var mbaTab = null;
  for (var i = 0; i < tabs.length; i++) {
    if ((tabs[i].url || '').indexOf('vercel.app') >= 0) { mbaTab = tabs[i]; break; }
  }
  if (!mbaTab) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: mbaTab.id },
      func: function(data) {
        try {
          var raw = localStorage.getItem('mba_profiles') || '[]';
          var profiles = JSON.parse(raw);
          for (var i = 0; i < profiles.length; i++) {
            if (profiles[i].id === data.profileId) {
              if (!profiles[i].messages) profiles[i].messages = [];
              profiles[i].messages.push({
                content: data.message,
                direction: 'outbound',
                sentAt: new Date().toISOString(),
                type: 'extension',
                sendAttempted: true,
                delivered: data.success,
                deliveryMsg: data.deliveryMsg
              });
              if (data.success && profiles[i].status === 'prospect') {
                profiles[i].status = 'contacted';
              }
              break;
            }
          }
          localStorage.setItem('mba_profiles', JSON.stringify(profiles));
          // Dispatch event to refresh UI
          window.dispatchEvent(new Event('storage'));
          return true;
        } catch(e) { return false; }
      },
      args: [{
        profileId: profile.id,
        message: messageEl.value,
        success: success,
        deliveryMsg: deliveryMsg
      }]
    });
  } catch(e) {}
}

// Main send loop
async function sendAll() {
  if (sending) return;
  sending = true;
  stopped = false;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'block';
  progressSection.style.display = 'block';

  var plat = platform.value;
  var msg = messageEl.value.trim();
  if (!msg) { log('Escreve uma mensagem!', 'err'); sending = false; return; }

  // Re-load profiles
  await loadProfiles();
  var tabs = await chrome.tabs.query({});
  var mbaTab = null;
  for (var i = 0; i < tabs.length; i++) {
    if ((tabs[i].url || '').indexOf('vercel.app') >= 0) { mbaTab = tabs[i]; break; }
  }
  if (!mbaTab) {
    log('MBA panel nao encontrada!', 'err');
    sending = false;
    return;
  }

  // Get pending profiles
  var pending = profiles.filter(function(p) {
    if (plat === 'instagram' && p.platform !== 'instagram') return false;
    if (plat === 'facebook' && p.platform !== 'facebook') return false;
    if (p.status === 'contacted' || p.status === 'replied' || p.status === 'accepted') return false;
    var msgs = p.messages || [];
    for (var j = 0; j < msgs.length; j++) {
      if (msgs[j].direction === 'outbound' && msgs[j].delivered) return false;
    }
    return true;
  });
  pending.sort(function(a, b) { return (b.angolaScore || 0) - (a.angolaScore || 0); });

  log('A enviar ' + pending.length + ' DMs via ' + plat + '...', 'info');
  var sent = 0;
  var failed = 0;

  for (var i = 0; i < pending.length; i++) {
    if (stopped) { log('PARADO pelo utilizador', 'err'); break; }

    var p = pending[i];
    setProgress(i, pending.length);
    log('Enviando para @' + p.username + ' (' + p.platform + ')...', 'info');

    var result = await sendSingleDM(p, msg, 2500);

    if (result.ok) {
      sent++;
      log(result.msg, 'ok');
    } else {
      failed++;
      log(result.msg, 'err');
    }

    // Update in MBA panel
    await updateProfile(p, result.ok, result.msg);

    // Delay between DMs (anti-ban)
    if (i < pending.length - 1 && !stopped) {
      await new Promise(function(r) { setTimeout(r, 3000 + Math.random() * 2000); });
    }
  }

  setProgress(pending.length, pending.length);
  log('FINALIZADO: ' + sent + ' enviados, ' + failed + ' falhados', sent > 0 ? 'ok' : 'err');
  sending = false;
  sendBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  sendBtn.textContent = 'Enviar DMs';
  sendBtn.disabled = false;

  // Refresh MBA panel
  if (mbaTab) {
    try { await chrome.tabs.reload(mbaTab.id); } catch(e) {}
  }
}

// Event listeners
sendBtn.addEventListener('click', sendAll);
stopBtn.addEventListener('click', function() { stopped = true; });
platform.addEventListener('change', loadProfiles);

document.getElementById('mbaLink').addEventListener('click', function() {
  chrome.tabs.create({ url: 'https://mba-brain-agent.vercel.app' });
});

// Init
checkPlatforms();
loadProfiles();