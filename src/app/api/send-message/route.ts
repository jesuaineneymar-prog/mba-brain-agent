import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MIN_INTERVAL = 45000;
const MAX_INTERVAL = 90000;
const PAUSE_AFTER = 10;
const PAUSE_DURATION = 300000;
const MAX_PER_DAY = 30;

const messageQueue: { profileId: string; message: string; platform: string; username: string; scheduledAt: number; sent: boolean; sentResult?: string; }[] = [];

/**
 * Verifica se as credenciais estao configuradas para cada plataforma
 */
function hasCredentials(platform: string): boolean {
  switch (platform) {
    case 'instagram':
      return !!(process.env.IG_SESSIONID && process.env.IG_CSRFTOKEN);
    case 'facebook':
      return !!(process.env.META_ACCESS_TOKEN || (process.env.FB_C_USER && process.env.FB_XS));
    case 'linkedin':
      return !!process.env.LI_AT;
    case 'tiktok':
      return !!(process.env.TT_SESSIONID && process.env.TT_CSRF_TOKEN);
    default:
      return false;
  }
}

function getCredentialStatus(platform: string): string {
  switch (platform) {
    case 'instagram':
      return process.env.IG_SESSIONID ? 'Configurado' : 'Em falta (IG_SESSIONID, IG_CSRFTOKEN)';
    case 'facebook':
      return process.env.META_ACCESS_TOKEN ? 'Configurado (Meta API)' : process.env.FB_C_USER ? 'Configurado (Cookies)' : 'Em falta';
    case 'linkedin':
      return process.env.LI_AT ? 'Configurado' : 'Em falta (LI_AT)';
    case 'tiktok':
      return process.env.TT_SESSIONID ? 'Configurado (limitado)' : 'Em falta';
    default:
      return 'N/A';
  }
}

export async function POST(request: Request) {
  try {
    const { profileId, message, platform, username, campaignId, abTestGroup, scheduledAt } = await request.json();
    if (!profileId || !message) return NextResponse.json({ error: 'profileId e mensagem obrigatorios' }, { status: 400 });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todaySent = await db.message.count({ where: { direction: 'outbound', sentAt: { gte: today } } });
    if (todaySent >= MAX_PER_DAY) {
      return NextResponse.json({ error: `Limite diario atingido (${MAX_PER_DAY}/dia). Tenta amanha.`, retryAfter: 86400000 }, { status: 429 });
    }

    const plat = platform || 'instagram';
    const credsOk = hasCredentials(plat);

    if (!credsOk) {
      await db.message.create({
        data: { profileId, campaignId: campaignId || '', direction: 'outbound', content: message, abTestGroup: abTestGroup || null },
      });
      await db.profile.update({ where: { id: profileId }, data: { status: 'contacted', contactedAt: new Date() } });
      const statusMsg = getCredentialStatus(plat);
      await db.activityLog.create({
        data: { action: 'MESSAGE_NO_CREDS', details: `DM @${username || profileId} (${plat}): ${statusMsg}` },
      });
      return NextResponse.json({
        success: false, saved: true, platform: plat,
        error: `Credenciais ${plat}: ${statusMsg}`,
        todaySent: todaySent + 1, remainingToday: MAX_PER_DAY - todaySent - 1,
      });
    }

    // Agendar envio
    if (scheduledAt) {
      await db.message.create({
        data: { profileId, campaignId: campaignId || '', direction: 'outbound', content: message, scheduledAt: new Date(scheduledAt), abTestGroup: abTestGroup || null },
      });
      await db.profile.update({ where: { id: profileId }, data: { status: 'contacted', contactedAt: new Date() } });
      return NextResponse.json({ success: true, scheduled: true, scheduledFor: scheduledAt });
    }

    const lastSent = messageQueue.filter(m => m.sent).pop();
    const now = Date.now();
    const baseDelay = Math.floor(Math.random() * (MAX_INTERVAL - MIN_INTERVAL)) + MIN_INTERVAL;
    const delay = lastSent ? Math.max(baseDelay, lastSent.scheduledAt + baseDelay - now) : 0;
    const recentSent = messageQueue.filter(m => m.sent && now - m.scheduledAt < 3600000).length;
    const needsPause = recentSent >= PAUSE_AFTER;
    const totalDelay = needsPause ? delay + PAUSE_DURATION : delay;

    const scheduledItem = { profileId, message, platform: plat, username: username || '', scheduledAt: now + totalDelay, sent: false };
    messageQueue.push(scheduledItem);
    setTimeout(() => sendScheduledMessage(scheduledItem, campaignId, abTestGroup), totalDelay);

    await db.message.create({
      data: { profileId, campaignId: campaignId || '', direction: 'outbound', content: message, abTestGroup: abTestGroup || null },
    });
    await db.profile.update({ where: { id: profileId }, data: { status: 'contacted', contactedAt: new Date() } });

    return NextResponse.json({
      success: true, scheduled: true, platform: plat,
      delayMs: totalDelay, delaySeconds: Math.round(totalDelay / 1000),
      needsPause, todaySent: todaySent + 1, remainingToday: MAX_PER_DAY - todaySent - 1,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Erro ao enviar mensagem' }, { status: 500 });
  }
}

async function sendScheduledMessage(item: typeof messageQueue[0], campaignId: string, abTestGroup?: string) {
  try {
    let sent = false;
    let result = '';
    switch (item.platform) {
      case 'instagram': { const r = await sendInstagramDM(item.username, item.message); sent = r.ok; result = r.msg; break; }
      case 'facebook': { const r = await sendFacebookMessage(item.username, item.message); sent = r.ok; result = r.msg; break; }
      case 'linkedin': { const r = await sendLinkedInMessage(item.username, item.message); sent = r.ok; result = r.msg; break; }
      case 'tiktok': { const r = await sendTikTokDM(item.username, item.message); sent = r.ok; result = r.msg; break; }
    }
    item.sent = sent;
    item.sentResult = result;
    await db.activityLog.create({
      data: { action: sent ? 'MESSAGE_SENT' : 'MESSAGE_FAILED', details: `${item.platform} @${item.username}: ${result}${abTestGroup ? ` [${abTestGroup}]` : ''}` },
    });
    if (sent && campaignId) {
      await db.campaign.update({ where: { id: campaignId }, data: { sentCount: { increment: 1 } } });
    }
  } catch (err) {
    console.error('Scheduled send error:', err);
  }
}

/**
 * Instagram DM via cookies de sessao
 * Passo 1: Busca user ID pelo username
 * Passo 2: Envia DM
 */
async function sendInstagramDM(username: string, message: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const cookies = `sessionid=${process.env.IG_SESSIONID}; csrftoken=${process.env.IG_CSRFTOKEN}; ds_user_id=${process.env.IG_SESSIONID?.split('%3A')[0]}`;
    const csrf = process.env.IG_CSRFTOKEN || '';

    // Passo 1: Buscar user ID
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

    // Passo 2: Enviar DM
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
      return { ok: true, msg: `IG: DM enviado para @${username} (userId: ${userId})` };
    }
    const errBody = await dmRes.text().catch(() => '');
    return { ok: false, msg: `IG: DM falhou para @${username} (HTTP ${dmRes.status}: ${errBody.substring(0, 100)})` };
  } catch (err) {
    return { ok: false, msg: `IG: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Facebook Messenger - tenta Meta Graph API primeiro, depois cookies como fallback
 */
async function sendFacebookMessage(pageIdOrUsername: string, message: string): Promise<{ ok: boolean; msg: string }> {
  // Tentativa 1: Meta Graph API (mais fiavel)
  if (process.env.META_ACCESS_TOKEN) {
    try {
      // Primeiro tentar encontrar o ID da pagina
      const searchRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${process.env.META_ACCESS_TOKEN}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const searchData = await searchRes.json().catch(() => ({}));
      const pages = searchData.data || [];

      // Tentar enviar via cada pagina associada
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
        if (sendRes.ok) {
          return { ok: true, msg: `FB: DM enviado via pagina "${page.name}"` };
        }
      }

      // Fallback: tentar com o token directo
      const directRes = await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${process.env.META_ACCESS_TOKEN}`,
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
      if (directRes.ok) {
        return { ok: true, msg: `FB: DM enviado via Graph API` };
      }
      const errText = await directRes.text().catch(() => '');
      return { ok: false, msg: `FB: Graph API falhou (HTTP ${directRes.status}: ${errText.substring(0, 100)})` };
    } catch (err) {
      return { ok: false, msg: `FB: erro Graph API - ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // Tentativa 2: Via cookies (web)
  if (process.env.FB_C_USER && process.env.FB_XS) {
    try {
      const cookies = `c_user=${process.env.FB_C_USER}; xs=${process.env.FB_XS}`;
      const fbDtsgRes = await fetch('https://www.facebook.com/', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        },
      });
      if (!fbDtsgRes.ok) {
        return { ok: false, msg: `FB: cookies invalidos, nao foi possivel aceder a Facebook` };
      }
      // Tentar enviar via messenger thread
      const threadRes = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        headers: {
          'Cookie': cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        },
        body: new URLSearchParams({
          recipient_id: pageIdOrUsername,
          message_text: message,
        }).toString(),
      });
      if (threadRes.ok) {
        return { ok: true, msg: `FB: DM enviado via cookies` };
      }
      return { ok: false, msg: `FB: cookies falharam (HTTP ${threadRes.status})` };
    } catch (err) {
      return { ok: false, msg: `FB: erro cookies - ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  return { ok: false, msg: 'FB: sem credenciais disponiveis' };
}

/**
 * LinkedIn Message via cookie li_at
 */
async function sendLinkedInMessage(profileIdOrUrl: string, message: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const cookies = `li_at=${process.env.LI_AT}; JSESSIONID=ajax:1`;

    // LinkedIn precisa do URN ID (urn:li:fsd_profile:...)
    // Se o profileId comeca com urn:li: usamos directo, senao pesquisamos
    let urnId = profileIdOrUrl;
    if (!profileIdOrUrl.startsWith('urn:li:')) {
      // Tentar construir URN a partir do username ou buscar
      const searchRes = await fetch(
        `https://www.linkedin.com/voyager/api/messaging/conversations`,
        {
          headers: {
            'Cookie': cookies,
            'X-Li-Track': '{"clientVersion":"*"}',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          },
        }
      );
      if (searchRes.ok) {
        return { ok: false, msg: `LinkedIn: necessario URN ID (urn:li:fsd_profile:...), nao username` };
      }
      return { ok: false, msg: `LinkedIn: erro ao aceder API (HTTP ${searchRes.status})` };
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

    if (res.ok) {
      return { ok: true, msg: `LinkedIn: DM enviado para ${urnId.substring(0, 30)}...` };
    }
    const errBody = await res.text().catch(() => '');
    return { ok: false, msg: `LinkedIn: falhou (HTTP ${res.status}: ${errBody.substring(0, 100)})` };
  } catch (err) {
    return { ok: false, msg: `LinkedIn: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * TikTok DM - tentativa via cookies
 * NOTA: TikTok bloqueia DMs via API nao oficial frequentemente
 * Isso e um melhor esforco, pode nao funcionar
 */
async function sendTikTokDM(username: string, message: string): Promise<{ ok: boolean; msg: string }> {
  if (!process.env.TT_SESSIONID) {
    return { ok: false, msg: 'TikTok: sem credenciais configuradas' };
  }
  try {
    const cookies = `sessionid=${process.env.TT_SESSIONID}; tt_csrf_token=${process.env.TT_CSRF_TOKEN}`;
    const csrfToken = process.env.TT_CSRF_TOKEN || '';

    // Passo 1: Buscar o user ID pelo username
    const userRes = await fetch(`https://www.tiktok.com/api/user/detail/?uniqueId=${username}`, {
      headers: {
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': `https://www.tiktok.com/@${username}`,
      },
    });
    if (!userRes.ok) {
      return { ok: false, msg: `TikTok: nao foi possivel encontrar @${username} (HTTP ${userRes.status})` };
    }
    const userData = await userRes.json().catch(() => ({}));
    const userId = userData.user?.id || userData.userInfo?.user?.id;
    if (!userId) {
      return { ok: false, msg: `TikTok: user ID nao encontrado para @${username}` };
    }

    // Passo 2: Tentar enviar DM
    const dmRes = await fetch('https://www.tiktok.com/api/chat/send/', {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Csrf-Token': csrfToken,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': `https://www.tiktok.com/@${username}`,
      },
      body: new URLSearchParams({
        recipient_user_id: String(userId),
        content: message,
        type: 'text',
      }).toString(),
    });

    if (dmRes.ok) {
      return { ok: true, msg: `TikTok: DM enviado para @${username}` };
    }
    const errBody = await dmRes.text().catch(() => '');
    return { ok: false, msg: `TikTok: DM falhou (HTTP ${dmRes.status}: ${errBody.substring(0, 100)}). TikTok bloqueia DMs via API.` };
  } catch (err) {
    return { ok: false, msg: `TikTok: erro - ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function GET() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaySent = await db.message.count({ where: { direction: 'outbound', sentAt: { gte: today } } });
  const scheduled = await db.message.findMany({
    where: { scheduledAt: { gte: new Date() }, direction: 'outbound' },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
    include: { profile: { select: { username: true, platform: true } } },
  });

  const credentials: Record<string, string> = {
    instagram: getCredentialStatus('instagram'),
    facebook: getCredentialStatus('facebook'),
    linkedin: getCredentialStatus('linkedin'),
    tiktok: getCredentialStatus('tiktok'),
  };

  return NextResponse.json({
    queueLength: messageQueue.filter(m => !m.sent).length,
    sentToday: todaySent,
    maxPerDay: MAX_PER_DAY,
    remainingToday: MAX_PER_DAY - todaySent,
    scheduled,
    credentials,
  });
}
