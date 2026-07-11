'use client';

import { useState, useEffect } from 'react';

// ============================================================
//  PAGINA DE CONFIGURACAO DE COOKIES
//  Mobile-friendly — cola cookies, valida, guarda em localStorage
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
  const [fbCookie, setFbCookie] = useState('');
  const [fbDtsg, setFbDtsg] = useState('');
  const [ttSessionid, setTtSessionid] = useState('');
  const [ttCsrf, setTtCsrf] = useState('');
  const [statuses, setStatuses] = useState<Record<string, CookieStatus>>({});
  const [saved, setSaved] = useState(false);
  const [showHelp, setShowHelp] = useState<string | null>(null);

  const API = '/api/send-message';

  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('mba_cookies') || '{}');
      if (d.igSessionid) setIgSessionid(d.igSessionid);
      if (d.igCsrf) setIgCsrf(d.igCsrf);
      if (d.fbCookie) setFbCookie(d.fbCookie);
      if (d.fbDtsg) setFbDtsg(d.fbDtsg);
      if (d.ttSessionid) setTtSessionid(d.ttSessionid);
      if (d.ttCsrf) setTtCsrf(d.ttCsrf);
      if (Object.keys(d).length > 0) setSaved(true);
    } catch(e) {}
  }, []);

  function getHeaders() {
    const session = localStorage.getItem('mba_session') || '';
    return {
      'Content-Type': 'application/json',
      ...(session ? { 'x-mba-session': session } : { 'Authorization': 'Bearer MBA2026' })
    };
  }

  async function validatePlatform(platform: string) {
    setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, loading: true } }));

    let body: any = { action: 'validate-cookies', platform };

    if (platform === 'instagram') {
      body.sessionid = igSessionid.trim();
      body.csrftoken = igCsrf.trim();
      if (!body.sessionid || !body.csrftoken) {
        setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche sessionid e csrftoken', loading: false } }));
        return;
      }
    } else if (platform === 'facebook') {
      body.fbCookie = fbCookie.trim();
      body.fbDtsg = fbDtsg.trim();
      if (!body.fbCookie || !body.fbDtsg) {
        setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche o cookie e fb_dtsg', loading: false } }));
        return;
      }
    } else if (platform === 'tiktok') {
      body.ttSessionid = ttSessionid.trim();
      body.ttCsrf = ttCsrf.trim();
      if (!body.ttSessionid || !body.ttCsrf) {
        setStatuses(prev => ({ ...prev, [platform]: { platform, valid: false, error: 'Preenche sessionid e tt_csrf_token', loading: false } }));
        return;
      }
    }

    try {
      const res = await fetch(API, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      setStatuses(prev => ({
        ...prev,
        [platform]: {
          platform,
          valid: data.success,
          username: data.username,
          error: data.error,
          loading: false
        }
      }));
    } catch(e: any) {
      setStatuses(prev => ({
        ...prev,
        [platform]: { platform, valid: false, error: e.message || 'Erro de rede', loading: false }
      }));
    }
  }

  function saveCookies() {
    const data: any = {};
    if (igSessionid.trim()) data.igSessionid = igSessionid.trim();
    if (igCsrf.trim()) data.igCsrf = igCsrf.trim();
    if (fbCookie.trim()) data.fbCookie = fbCookie.trim();
    if (fbDtsg.trim()) data.fbDtsg = fbDtsg.trim();
    if (ttSessionid.trim()) data.ttSessionid = ttSessionid.trim();
    if (ttCsrf.trim()) data.ttCsrf = ttCsrf.trim();
    localStorage.setItem('mba_cookies', JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function testDm(platform: string) {
    const usernames: Record<string, string> = { instagram: 'meta', facebook: 'zuck', tiktok: 'tiktok' };
    const testUser = usernames[platform] || 'test';
    if (confirm('Enviar DM de teste para @' + testUser + '?')) {
      const cookies = JSON.parse(localStorage.getItem('mba_cookies') || '{}');
      let body: any = { platform, username: testUser, message: 'Teste DM automatico - ignorar', sentToday: 0 };
      if (platform === 'instagram') { body.igSessionid = cookies.igSessionid; body.igCsrf = cookies.igCsrf; }
      if (platform === 'facebook') { body.fbCookie = cookies.fbCookie; body.fbDtsg = cookies.fbDtsg; }
      if (platform === 'tiktok') { body.ttSessionid = cookies.ttSessionid; body.ttCsrf = cookies.ttCsrf; }
      fetch(API, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) })
        .then(r => r.json())
        .then(d => alert('Resultado: ' + (d.deliveryMsg || JSON.stringify(d))))
        .catch(e => alert('Erro: ' + e.message));
    }
  }

  const platformConfig = [
    {
      id: 'instagram', name: 'Instagram', icon: 'IG', color: '#E1306C',
      fields: [
        { label: 'sessionid', value: igSessionid, set: setIgSessionid, placeholder: 'Copiado do browser' },
        { label: 'csrftoken', value: igCsrf, set: setIgCsrf, placeholder: 'Copiado do browser' }
      ]
    },
    {
      id: 'facebook', name: 'Facebook', icon: 'FB', color: '#1877F2',
      fields: [
        { label: 'cookie (tudo)', value: fbCookie, set: setFbCookie, placeholder: 'Cole TODOS os cookies do FB', big: true },
        { label: 'fb_dtsg', value: fbDtsg, set: setFbDtsg, placeholder: 'Valor de fb_dtsg' }
      ]
    },
    {
      id: 'tiktok', name: 'TikTok', icon: 'TT', color: '#25F4EE',
      fields: [
        { label: 'sessionid', value: ttSessionid, set: setTtSessionid, placeholder: 'Copiado do browser' },
        { label: 'tt_csrf_token', value: ttCsrf, set: setTtCsrf, placeholder: 'Copiado do browser' }
      ]
    }
  ];

  const helpContent: Record<string, string> = {
    instagram: `COMO TIRAR COOKIES DO INSTAGRAM (NO TELEFONE):\n\n1. Abre o Chrome no teu telefone\n2. Vai a instagram.com e faz login\n3. Toca nos 3 pontinhos (canto superior direito)\n4. Marca "Site para computador"\n5. Toca nos 3 pontinhos de novo\n6. Seleciona "Ferramentas de desenvolvedor"\n7. Vai ao separador "Console"\n8. Escreve: document.cookie\n9. Carrega em Enter\n10. Copia o texto que aparece\n11. Procura sessionid=... e csrftoken=...\n12. Cola cada valor no campo certo aqui\n\nDICA: O valor de sessionid e um texto longo depois de "sessionid="\nO csrftoken e mais curto, depois de "csrftoken="`,

    facebook: `COMO TIRAR COOKIES DO FACEBOOK (NO TELEFONE):\n\n1. Abre o Chrome no teu telefone\n2. Vai a facebook.com e faz login\n3. Toca nos 3 pontinhos > "Site para computador"\n4. Toca nos 3 pontinhos de novo\n5. Seleciona "Ferramentas de desenvolvedor"\n6. Vai ao separador "Console"\n7. Escreve: document.cookie\n8. Carrega em Enter\n9. Copia TUDO que aparece e cola no campo "cookie (tudo)"\n\nPARA O fb_dtsg:\n1. Vai a facebook.com/messages\n2. Nos DevTools, Console, escreve:\n   document.querySelector('[name="fb_dtsg"]')?.value\n3. Copia o resultado e cola no campo fb_dtsg`,

    tiktok: `COMO TIRAR COOKIES DO TIKTOK (NO TELEFONE):\n\n1. Abre o Chrome no teu telefone\n2. Vai a tiktok.com e faz login\n3. Toca nos 3 pontinhos > "Site para computador"\n4. Toca nos 3 pontinhos de novo\n5. Seleciona "Ferramentas de desenvolvedor"\n6. Vai ao separador "Console"\n7. Escreve: document.cookie\n8. Carrega em Enter\n9. Copia o texto que aparece\n10. Procura sessionid=... e tt_csrf_token=...\n11. Cola cada valor no campo certo aqui`,

    bookmarklet: `METODO BOOKMARKLET (O MAIS FACIL):\n\n1. No Chrome do telefone, abre o site (IG/FB/TT) e faz login\n2. Cria um favorito novo\n3. No campo URL do favorito, cola este codigo:\n\njavascript:void((function(){var c=document.cookie;var r='';var pairs=c.split(';');for(var i=0;i<pairs.length;i++){var p=pairs[i].trim();var kv=p.split('=');if(kv.length>=2){r+=kv[0].trim()+': '+kv[1].trim()+'\\n';}}var w=window.open('','_blank');w.document.write('<pre style=\\'font-size:16px;padding:20px;word-wrap:break-word;\\'>'+r+'</pre>');w.document.title='COOKIES';})())\n\n4. Quando estiveres logado no site, toca nesse favorito\n5. Vai abrir uma nova janela com todos os cookies organizados\n6. Copia os que precisas (sessionid, csrftoken, etc.)`
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '16px', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', padding: '24px 0 20px', borderBottom: '1px solid #222', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Configurar Cookies</h1>
        <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
          Cola os cookies de cada plataforma para ativar os DMs
        </p>
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
          <div key={platform.id} style={{
            background: '#111', border: '1px solid #222', borderRadius: '16px',
            padding: '20px', marginBottom: '16px'
          }}>
            {/* Platform Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: platform.color, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: platform.id === 'tiktok' ? '#000' : '#fff',
                  fontWeight: 700, fontSize: '16px'
                }}>
                  {platform.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '17px', color: '#fff' }}>{platform.name}</div>
                  {status?.valid && (
                    <div style={{ fontSize: '12px', color: '#4CAF50' }}>
                      Validado @{status.username || 'OK'}
                    </div>
                  )}
                  {status && !status.loading && !status.valid && status.error && (
                    <div style={{ fontSize: '12px', color: '#f44336' }}>
                      {status.error}
                    </div>
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

            {/* Help for this platform */}
            {showHelp === platform.id && (
              <div style={{
                background: '#0a0a0a', border: '1px solid #222', borderRadius: '8px',
                padding: '14px', marginBottom: '14px', whiteSpace: 'pre-wrap',
                fontSize: '12px', lineHeight: '1.5', color: '#aaa', maxHeight: '40vh',
                overflowY: 'auto'
              }}>
                {helpContent[platform.id]}
              </div>
            )}

            {/* Input Fields */}
            {platform.fields.map((field: any) => (
              <div key={field.label} style={{ marginBottom: '12px' }}>
                <label style={{
                  display: 'block', fontSize: '12px', color: '#666',
                  marginBottom: '6px', fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {field.label}
                </label>
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

            {/* Test DM button */}
            {status?.valid && (
              <button
                onClick={() => testDm(platform.id)}
                style={{
                  width: '100%', background: platform.color + '22',
                  border: '1px solid ' + platform.color + '44',
                  color: platform.color, padding: '10px', borderRadius: '10px',
                  fontSize: '13px', cursor: 'pointer', fontWeight: 600, marginTop: '4px'
                }}
              >
                Enviar DM de teste ({platform.name})
              </button>
            )}
          </div>
        );
      })}

      {/* Save Button - Fixed Bottom */}
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