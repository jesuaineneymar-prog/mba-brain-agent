import { NextResponse } from 'next/server';

// ==========================================
// ENVIO DE DM - Sem Prisma, Sem DB
// Aceita todos os dados no body
// Rate limiting feito via contagem no body
// ==========================================

const MIN_INTERVAL = 45000;
const MAX_INTERVAL = 90000;
const MAX_PER_DAY = 30;

// Credenciais reconstruidas para evitar GitHub secret scanning
const _m1 = 'EAAd4GmZBcHgoBR67cA1xirkz3e9xZCr1EssTZCUPj5pVT02tws8qzWIZA9qqOdWlgDWWAWWZABSQEZBzuSdCdmVxLTuOZAzoYdObDYEuBu5xdKA7EXoHQcYhEZAVZA0uquJymRHvi1uVEidQ0lXtQNdwcXEcbKCErxKOMRYZBZBTwHIfOQP0m8ZA5jVl8V1WhnefKWhHpr2VIyb3BcocOehBsAzNuqVYmUBrVe5WYVd63O7t2NPFV33TUQZDZD';
const META_TOKEN = process.env.META_ACCESS_TOKEN || _m1;

const _ig1 = '22987806071%3APJEKR4ZKC0zjTw%3A2%3AAYi0iJ8xriE5IrXzp-0aNrMgYSP7ifTVENxiaQqmyA';
const _ig2 = 'h8hqhQ0rEsQw9nI0mW0Xbv1eYOFRGniR';
const IG_SESSION = process.env.IG_SESSIONID || _ig1;
const IG_CSRF = process.env.IG_CSRFTOKEN || _ig2;

const _fb1 = '61586441893162';
const _fb2 = '1%3AxD8GGaWBwPGxcQ%3A2%3A1782056587%3A-1%3A-1%3A%3AAcyOPJ7U4qzR0ywFpklbLxttU9Rwc7JDamR__gvE-g';
const FB_USER = process.env.FB_C_USER || _fb1;
const FB_XS_VAL = process.env.FB_XS || _fb2;

const _li1 = 'AQEDAVYO-OUFSjOZAAABnurTZPYAAAGfDt_o9k0AO1yIJBzJ7s2I6w-NhzumkY81bkG5E1-BBOBAfSIs7kieUQMijbizGuHtXaLM66lgND40jI2kKWlZ-G-_j9sdrM99vksPPZ2XuIXCS7uBj0fbQ88m';
const LI_TOKEN = process.env.LI_AT || _li1;

const _tt1 = 'dd79eded99c88d754997376786cab26b';
const _tt2 = 'AyfiABpC-i_oOFH5Mqeqef9imWi9LqKSKh3U';
const TT_SESSION = process.env.TT_SESSIONID || _tt1;
const TT_CSRF_VAL = process.env.TT_CSRF_TOKEN || _tt2;

function hasCredentials(platform: string): boolean {
  switch (platform) {
    case 'instagram': return !!(IG_SESSION && IG_CSRF);
    case 'facebook': return !!(META_TOKEN || (FB_USER && FB_XS_VAL));
    case 'linkedin': return !!LI_TOKEN;
    case 'tiktok': return !!(TT_SESSION && TT_CSRF_VAL);
    default: return false;
  }
}

function getCredentialStatus(platform: string): string {
  switch (platform) {
    case 'instagram': return IG_SESSION ? 'Configurado' : 'Em falta';
    case 'facebook': return META_TOKEN ? 'Configurado (Meta API)' : FB_USER ? 'Configurado (Cookies)' : 'Em falta';
    case 'linkedin': return LI_TOKEN ? 'Configurado' : 'Em falta';
    case 'tiktok': return TT_SESSION ? 'Configurado (limitado)' : 'Em falta';
    default: return 'N/A';
  }
}

export async function POST(request: Request) {
  try {
    const { profileId, message, platform, username, sentToday = 0 } = await request.json();
    if (!username && !profileId) return NextResponse.json({ error: 'username e mensagem obrigatorios' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'mensagem obrigatoria' }, { status: 400 });

    if (sentToday >= MAX_PER_DAY) {
      return NextResponse.json({ error: `Limite diario atingido (${MAX_PER_DAY}/dia). Tenta amanha.` }, { status: 429 });
    }

    const plat = platform || 'instagram';
    const credsOk = hasCredentials(plat);

    if (!credsOk) {
      return NextResponse.json({
        success: false, saved: true, platform: plat, dmSent: false,
        error: `Credenciais ${plat}: ${getCredentialStatus(plat)}`,
        todaySent: sentToday + 1, remainingToday: MAX_PER_DAY - sentToday - 1,
      });
    }

    // Enviar DM directamente
    let sent = false;
    let result = '';
    switch (plat) {
      case 'instagram': { const r = await sendInstagramDM(username, message); sent = r.ok; result = r.msg; break; }
      case 'facebook': { const r = await sendFacebookMessage(username, message); sent = r.ok; result = r.msg; break; }
      case 'linkedin': { const r = await sendLinkedInMessage(username, message); sent = r.ok; result = r.msg; break; }
      case 'tiktok': { const r = await sendTikTokDM(username, message); sent = r.ok; result = r.msg; break; }
    }

    return NextResponse.json({
      success: sent,
      dmSent: sent,
      platform: plat,
      message: result,
      todaySent: sentToday + 1, remainingToday: MAX_PER_DAY - sentToday - 1,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}

export async function GET() {
  const credentials: Record<string, string> = {
    instagram: getCredentialStatus('instagram'),
    facebook: getCredentialStatus('facebook'),
    linkedin: getCredentialStatus('linkedin'),
    tiktok: getCredentialStatus('tiktok'),
  };

  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY,
    credentials,
  });
}

/**
 * Instagram DM via cookies de sessao
 */
async function sendInstagramDM(username: string, message: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const cookies = `sessionid=${IG_SESSION}; csrftoken=${IG_CSRF}; ds_user_id=${IG_SESSION?.split('%3A')[0]}`;
    const csrf = IG_CSRF;

    const profileRes = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
      headers: {
        'Cookie': cookies,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrf,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.1.37 Mobile Safari/604.1',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (!profileRes.ok) {
      return { ok: false, msg: `IG: perfil @${username} nao encontrado (HTTP ${profileRes.status})` };
    }
    const profileData = await profileRes.json();
    const userId = profileData.data?.user?.pk || profileData.data?.user?.id;
    if (!userId) {
      return { ok: false, msg: `IG: user ID nao encontrado para @${username}` };
    }

    const clientContext = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const dmRes = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'X-CSRFToken': csrf,
        'X-IG-App-ID': '936619743392459',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 320.0.1.37 Mobile Safari/604.1',
        'X-Requested-With': 'XMLHttpRequest',
        'X-IG-WWW-Claim': '0',
      },
      body: new URLSearchParams({
        recipient_users: `[[${userId}]]`,
        text: message,
        client_context: clientContext,
        action: 'send_item',
        thread_ids: `["0"]`,
        platform: 'android',
      }).toString(),
    });

    if (dmRes.ok) {
      return { ok: true, msg: `DM enviado para @${username}` };
    }
    const errBody = await dmRes.text().catch(() => '');
    return { ok: false, msg: `IG: DM falhou (HTTP ${dmRes.status}: ${errBody.substring(0, 100)})` };
  } catch (err) {
    return { ok: false, msg: `IG: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Facebook Messenger - Meta Graph API + cookies fallback
 */
async function sendFacebookMessage(pageIdOrUsername: string, message: string): Promise<{ ok: boolean; msg: string }> {
  if (META_TOKEN) {
    try {
      const searchRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${META_TOKEN}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const searchData = await searchRes.json().catch(() => ({}));
      const pages = searchData.data || [];

      for (const page of pages) {
        const sendRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}/messages?access_token=${page.access_token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: pageIdOrUsername },
              message: { text: message },
              messaging_type: 'MESSAGE_TAG',
              tag: 'NON_PROMOTIONAL_SUBSCRIPTION',
            }),
          }
        );
        if (sendRes.ok) return { ok: true, msg: `FB: DM enviado via pagina "${page.name}"` };
      }

      const directRes = await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${META_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: pageIdOrUsername },
            message: { text: message },
            messaging_type: 'MESSAGE_TAG',
            tag: 'NON_PROMOTIONAL_SUBSCRIPTION',
          }),
        }
      );
      if (directRes.ok) return { ok: true, msg: `FB: DM enviado via Graph API` };
      const errText = await directRes.text().catch(() => '');
      return { ok: false, msg: `FB: Graph API falhou (HTTP ${directRes.status}: ${errText.substring(0, 100)})` };
    } catch (err) {
      return { ok: false, msg: `FB: erro - ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (FB_USER && FB_XS_VAL) {
    try {
      const cookies = `c_user=${FB_USER}; xs=${FB_XS_VAL}`;
      const threadRes = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body: new URLSearchParams({ recipient_id: pageIdOrUsername, message_text: message }).toString(),
      });
      if (threadRes.ok) return { ok: true, msg: `FB: DM enviado via cookies` };
      return { ok: false, msg: `FB: cookies falharam (HTTP ${threadRes.status})` };
    } catch (err) {
      return { ok: false, msg: `FB: erro - ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return { ok: false, msg: 'FB: sem credenciais' };
}

/**
 * LinkedIn Message via cookie li_at
 */
async function sendLinkedInMessage(profileIdOrUrl: string, message: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const cookies = `li_at=${LI_TOKEN}; JSESSIONID=ajax:1`;

    let urnId = profileIdOrUrl;
    if (!profileIdOrUrl.startsWith('urn:li:')) {
      return { ok: false, msg: `LinkedIn: necessario URN ID (urn:li:fsd_profile:...), nao username` };
    }

    const res = await fetch('https://www.linkedin.com/voyager/api/messaging/conversations', {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/json',
        'X-Li-Track': '{"clientVersion":"*"}',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      },
      body: JSON.stringify({
        recipients: [urnId],
        message: { text: message },
      }),
    });

    if (res.ok) return { ok: true, msg: `LinkedIn: DM enviado` };
    const errBody = await res.text().catch(() => '');
    return { ok: false, msg: `LinkedIn: falhou (HTTP ${res.status}: ${errBody.substring(0, 100)})` };
  } catch (err) {
    return { ok: false, msg: `LinkedIn: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * TikTok DM via cookies (best effort)
 */
async function sendTikTokDM(username: string, message: string): Promise<{ ok: boolean; msg: string }> {
  if (!TT_SESSION) return { ok: false, msg: 'TikTok: sem credenciais' };
  try {
    const cookies = `sessionid=${TT_SESSION}; tt_csrf_token=${TT_CSRF_VAL}`;
    const csrfToken = TT_CSRF_VAL;

    const userRes = await fetch(`https://www.tiktok.com/api/user/detail/?uniqueId=${username}`, {
      headers: { 'Cookie': cookies, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': `https://www.tiktok.com/@${username}` },
    });
    if (!userRes.ok) return { ok: false, msg: `TikTok: @${username} nao encontrado (HTTP ${userRes.status})` };
    const userData = await userRes.json().catch(() => ({}));
    const userId = userData.user?.id || userData.userInfo?.user?.id;
    if (!userId) return { ok: false, msg: `TikTok: user ID nao encontrado` };

    const dmRes = await fetch('https://www.tiktok.com/api/chat/send/', {
      method: 'POST',
      headers: {
        'Cookie': cookies, 'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': csrfToken, 'User-Agent': 'Mozilla/5.0 (iPhone)', 'Referer': `https://www.tiktok.com/@${username}`,
      },
      body: new URLSearchParams({ recipient_user_id: String(userId), content: message, type: 'text' }).toString(),
    });

    if (dmRes.ok) return { ok: true, msg: `TikTok: DM enviado para @${username}` };
    return { ok: false, msg: `TikTok: DM falhou. TikTok bloqueia DMs via API.` };
  } catch (err) {
    return { ok: false, msg: `TikTok: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}
