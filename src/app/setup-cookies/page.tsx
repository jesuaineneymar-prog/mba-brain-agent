'use client';

import { useState, useEffect } from 'react';

// ============================================================
//  PAGINA DE CONFIGURACAO DE COOKIES v2
//  Suporta formato credentials do send-message v4
// ============================================================

interface CookieStatus {
  platform: string;
  valid: boolean;
  username?: string;
  error?: string;
  loading: boolean;
}

export default function SetupCookies() {
  const [igSessionid, setIgSessionid] = useState('');
  const [igCsrf, setIgCsrf] = useState('');
  const [igDsUserId, setIgDsUserId] = useState('');
  const [fbCookie, setFbCookie] = useState('');
  const [ttSessionid, setTtSessionid] = useState('');
  const [ttCsrf, setTtCsrf] = useState('');
  const [statuses, setStatuses] = useState<Record<string, CookieStatus>>({});
  const [saved, setSaved] = useState(false);
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const [globalStatus, setGlobalStatus] = useState('');

  const API = '/api/send-message';

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('mba_cookies') || '{}');
      if (d.igSessionid) setIgSessionid(d.igSessionid);
      if (d.igCsrf) setIgCsrf(d.igCsrf);
      if (d.igDsUserId) setIgDsUserId(d.igDsUserId);
      if (d.fbCookie) setFbCookie(d.fbCookie);
      if (d.ttSessionid) setTtSessionid(d.ttSessionid);
      if (d.ttCsrf) setTtCsrf(d.ttCsrf);
      if (Object.keys(d).length > 0) setSaved(true);
    } catch(e) {}

    // Check current status
    fetch(API).then(r => r.json()).then(d => {
      const parts: string[] = [];
      if (d.igConfigured) parts.push('IG OK');
      else parts.push('IG --');
      if (d.fbConfigured) parts.push('FB OK');
      else parts.push('FB --');
      if (d.ttConfigured) parts.push('TT OK');
      else parts.push('TT --');
      setGlobalStatus(parts.join(' | '));
    }).catch(() => {});
  }, []);

  function getHeaders() {
    const session = localStorage.getItem('mba_session') || '';
    return {
      'Content-Type': 'application/json',
      ...(session ? { 'x-mba-session': session } : { 'Authorization': 'Bearer MBA2026' })
    };
  }

  function getCredentials() {
    return {
      instagram: { sessionid: igSessionid.trim(), csrftoken: igCsrf.trim(), ds_user_id: igDsUserId.trim() },
      facebook: { cookie: fbCookie.trim() },
      tiktok: { sessionid: ttSessionid.trim(), csrf: ttCsrf.trim() },
    };
  }

  async function validatePlatform(platform: string) {
    setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, loading: true } }));
    const creds = getCredentials();

    if (platform === 'instagram' && (!creds.instagram.sessionid || !creds.instagram.csrftoken)) {
      setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche sessionid e csrftoken', loading: false } }));
      return;
    }
    if (platform === 'facebook' && !creds.facebook.cookie) {
      setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche a cookie do Facebook', loading: false } }));
      return;
    }
    if (platform === 'tiktok' && !creds.tiktok.sessionid) {
      setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche o sessionid do TikTok', loading: false } }));
      return;
    }

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action: 'validate-cookies', platform, credentials: creds }),
      });
      const data = await res.json();
      setStatuses(prev => ({
        ...prev,
        [platform]: { platform, valid: data.success, username: data.username, error: data.error || data.message, loading: false }
      }));
    } catch(e: any) {
      setStatuses(prev => ({
        ...prev,
        [platform]: { platform, valid: false, error: e.message || 'Erro de rede', loading: false }
      }));
    }
  }

  function saveCookies() {
    const data: any = {
      igSessionid: igSessionid.trim(),
      igCsrf: igCsrf.trim(),
      igDsUserId: igDsUserId.trim(),
      fbCookie: fbCookie.trim(),
      ttSessionid: ttSessionid.trim(),
      ttCsrf: ttCsrf.trim(),
    };
    localStorage.setItem('mba_cookies', JSON.stringify(data));

    // Tambem enviar para o servidor
    const creds = getCredentials();
    fetch(API, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(creds) })
      .then(r => r.json())
      .then(d => {
        if (d.success) setGlobalStatus('Actualizado no servidor');
      })
      .catch(() => {});

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function testDm(platform: string) {
    const usernames: Record<string, string> = { instagram: 'meta', facebook: 'zuck', tiktok: 'tiktok' };
    const testUser = usernames[platform] || 'test';
    if (confirm('Enviar DM de teste para ' + (platform === 'instagram' ? '@' : '') + testUser + '?')) {
      const creds = getCredentials();
      fetch(API, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ platform, username: testUser, message: 'Teste DM automatico Mwango Brain - ignorar esta mensagem', credentials: creds }),
      })
        .then(r => r.json())
        .then(d => alert('Resultado: ' + (d.deliveryMsg || JSON.stringify(d))))
        .catch(e => alert('Erro: ' + e.message));
    }
  }

  const platformConfig = [
    {
      id: 'instagram', name: 'Instagram', icon: 'IG', color: '#E1306C',
      fields: [
        { label: 'sessionid', value: igSessionid, set: setIgSessionid, placeholder: 'Texto longo depois de sessionid=' },
        { label: 'csrftoken', value: igCsrf, set: setIgCsrf, placeholder: 'Texto curto depois de csrftoken=' },
        { label: 'ds_user_id (opcional)', value: igDsUserId, set: setIgDsUserId, placeholder: 'Numero, ex: 12345678' },
      ]
    },
    {
      id: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877F2',
      fields: [
        { label: 'cookie completa (tudo)', value: fbCookie, set: setFbCookie, placeholder: 'Cole TODOS os cookies do facebook.com (document.cookie)', big: true },
      ]
    },
    {
      id: 'tiktok', name: 'TikTok', icon: 'TT', color: '#25F4EE',
      fields: [
        { label: 'sessionid', value: ttSessionid, set: setTtSessionid, placeholder: 'Texto longo depois de sessionid=' },
        { label: 'csrf_session_token (opcional)', value: ttCsrf, set: setTtCsrf, placeholder: 'Depois de csrf_session_token=' },
      ]
    }
  ];

  const helpContent: Record<string, string> = {
    instagram: `COMO TIRAR COOKIES DO INSTAGRAM:

NO COMPUTADOR:
1. Abre chrome e vai a instagram.com
2. Faz login
3. Pressiona F12 (DevTools)
4. Vai a Application > Cookies > instagram.com
5. Copia: sessionid, csrftoken, ds_user_id

NO TELEFONE (Chrome):
1. Abre instagram.com no Chrome
2. Faz login
3. Toca nos 3 pontinhos (canto superior)
4. Marca "Site para computador"
5. Toca nos 3 pontinhos de novo
6. Seleciona "Ferramentas de desenvolvedor"
7. Vai ao separador "Console"
8. Escreve: document.cookie
9. Carrega em Enter
10. Procura sessionid=... e csrftoken=...
11. Copia cada valor para o campo certo`,

    facebook: `COMO TIRAR COOKIES DO FACEBOOK:

NO COMPUTADOR:
1. Abre chrome e vai a facebook.com
2. Faz login
3. Pressiona F12 (DevTools)
4. Console > escreve: document.cookie
5. Copia TUDO e cola no campo

NO TELEFONE (Chrome):
1. Abre facebook.com no Chrome
2. Faz login
3. Toca nos 3 pontinhos > "Site para computador"
4. 3 pontinhos > "Ferramentas de desenvolvedor"
5. Console > escreve: document.cookie
6. Copia TUDO e cola aqui

O campo "cookie completa" recebe TODOS os cookies de uma vez.`,

    tiktok: `COMO TIRAR COOKIES DO TIKTOK:

NO COMPUTADOR:
1. Abre chrome e vai a tiktok.com
2. Faz login
3. Pressiona F12 (DevTools)
4. Vai a Application > Cookies > tiktok.com
5. Copia: sessionid, csrf_session_token

NO TELEFONE (Chrome):
1. Abre tiktok.com no Chrome
2. Faz login
3. Toca nos 3 pontinhos > "Site para computador"
4. 3 pontinhos > "Ferramentas de desenvolvedor"
5. Console > escreve: document.cookie
6. Procura sessionid=...
7. Copia para o campo certo`,

    bookmarklet: `METODO FACIL - BOOKMARKLET:

1. No Chrome do telefone, abre o site e faz login
2. Cria um favorito novo
3. No campo URL do favorito, cola:

javascript:void((function(){var c=document.cookie;var r='';var pairs=c.split(';');for(var i=0;i<pairs.length;i++){var p=pairs[i].trim();var kv=p.split('=');if(kv.length>=2){r+=kv[0].trim()+': '+decodeURIComponent(kv[1].trim())+'\\n';}}var w=window.open('','_blank');w.document.write('<pre style=\\'font-size:16px;padding:20px;word-wrap:break-word;\\'>'+r+'</pre>');w.document.title='COOKIES';})())

4. Quando estiveres logado, toca nesse favorito
5. Vai abrir uma janela com todos os cookies
6. Copia os que precisas`
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 0 20px', borderBottom: '1px solid #222', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Configurar Cookies</h1>
        <p style={{ fontSize: '14px', color: '#888', margin: '0 0 4px' }}>
          Cola os cookies de cada plataforma para ativar os DMs
        </p>
        {globalStatus && (
          <p style={{ fontSize: '12px', color: '#4FC3F7', margin: '8px 0 0', fontFamily: 'monospace' }}>{globalStatus}</p>
        )}
        <button
          onClick={() => setShowHelp(showHelp === 'bookmarklet' ? null : 'bookmarklet')}
          style={{ marginTop: '12px', background: 'none', border: '1px solid #333', color: '#4FC3F7', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
        >
          {showHelp === 'bookmarklet' ? 'Fechar ajuda' : 'Como tirar cookies pelo telefone?'}
        </button>
      </div>

      {/* Help Modal */}
      {showHelp && helpContent[showHelp] && (
        <div style={{
          background: '#111', border: '1px solid #333', borderRadius: '12px',
          padding: '20px', marginBottom: '20px', whiteSpace: 'pre-wrap',
          fontSize: '13px', lineHeight: '1.6', color: '#ccc', maxHeight: '60vh',
          overflowY: 'auto'
        }}>
          {helpContent[showHelp]}
        </div>
      )}

      {/* Platform Cards */}
      {platformConfig.map(platform => {
        const status = statuses[platform.id];
        return (
          <div key={platform.id} style={{ background: '#111', border: '1px solid #222', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: platform.color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: platform.id === 'tiktok' ? '#000' : '#fff',
                  fontWeight: 700, fontSize: '16px'
                }}>{platform.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '17px', color: '#fff' }}>{platform.name}</div>
                  {status?.valid && (
                    <div style={{ fontSize: '12px', color: '#4CAF50' }}>Validado @{status.username || 'OK'}</div>
                  )}
                  {status && !status.loading && !status.valid && status.error && (
                    <div style={{ fontSize: '12px', color: '#f44336' }}>{status.error}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowHelp(showHelp === platform.id ? null : platform.id)}
                  style={{ background: 'none', border: '1px solid #333', color: '#888', padding: '6px 10px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}
                  title="Ajuda"
                >?</button>
                <button
                  onClick={() => validatePlatform(platform.id)}
                  disabled={status?.loading}
                  style={{
                    background: status?.valid ? '#1B5E20' : '#1a1a2e',
                    border: '1px solid ' + (status?.valid ? '#4CAF50' : '#333'),
                    color: status?.loading ? '#666' : status?.valid ? '#4CAF50' : '#4FC3F7',
                    padding: '8px 14px', borderRadius: '8px', fontSize: '13px',
                    cursor: status?.loading ? 'wait' : 'pointer', fontWeight: 600
                  }}
                >
                  {status?.loading ? '...' : status?.valid ? 'OK' : 'Validar'}
                </button>
              </div>
            </div>

            {showHelp === platform.id && (
              <div style={{
                background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px',
                padding: '14px', marginBottom: '14px', whiteSpace: 'pre-wrap',
                fontSize: '12px', lineHeight: '1.5', color: '#aaa', maxHeight: '40vh',
                overflowY: 'auto'
              }}>{helpContent[platform.id]}</div>
            )}

            {platform.fields.map((field: any) => (
              <div key={field.label} style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block', fontSize: '12px', color: '#666',
                  marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>{field.label}</label>
                <textarea
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                  placeholder={field.placeholder}
                  rows={field.big ? 3 : 2}
                  style={{
                    width: '100%', background: '#0a0a0a', border: '1px solid #222',
                    borderRadius: '10px', padding: '12px', color: '#fff',
                    fontSize: '14px', fontFamily: 'monospace', resize: 'vertical',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            {status?.valid && (
              <button
                onClick={() => testDm(platform.id)}
                style={{
                  width: '100%', background: platform.color + '22',
                  border: '1px solid ' + platform.color + '44',
                  color: platform.color, padding: '10px', borderRadius: '10px',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 600, marginTop: '4px'
                }}
              >Enviar DM de teste ({platform.name})</button>
            )}
          </div>
        );
      })}

      {/* Save Button */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: 'linear-gradient(transparent, #0a0a0a 30%)' }}>
        <button
          onClick={saveCookies}
          style={{
            width: '100%', padding: '16px', borderRadius: '14px',
            background: saved ? '#1B5E20' : 'linear-gradient(135deg, #4FC3F7, #0288D1)',
            color: '#fff', fontSize: '16px', fontWeight: 700,
            border: 'none', cursor: 'pointer',
            boxShadow: saved ? '0 0 20px #1B5E2044' : '0 4px 20px #0288D144'
          }}
        >
          {saved ? 'Cookies Guardados!' : 'Guardar Cookies'}
        </button>
      </div>
    </div>
  );
}