//============================================================
// MBA BRAIN AGENT — CAMPAIGN ENGINE
// Integra social-scrapers.ts com send-message API
// Fila inteligente, anti-block, estatísticas
// VERSÃO MÁXIMO ARRISCADO — use por sua conta e risco
//============================================================
import { scrapeInstagram, scrapeFacebook, scrapeLinkedIn, scrapeTikTok, calculateScore } from './social-scrapers';

export interface Campaign {
  id: string;
  name: string;
  platforms: ('instagram' | 'facebook' | 'tiktok' | 'linkedin')[];
  messageTemplate: string;
  filters: {
    query: string;
    minFollowers: number;
    maxFollowers: number;
    minMonthsActive: number;
    requireRegular: boolean;
    targetCount: number;
    excludeVerified: boolean;
    excludeBusiness: boolean;
  };
  cookies: {
    igSessionid?: string;
    igCsrf?: string;
    fbCookie?: string;
    fbDtsg?: string;
    ttSessionid?: string;
    ttCsrf?: string;
  };
  status: 'pending' | 'scraping' | 'sending' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface CampaignLead {
  id: string;
  campaignId: string;
  platform: string;
  username: string;
  displayName: string | null;
  followers: number;
  score: number;
  profileUrl: string;
  externalId: string;
  status: 'pending' | 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';
  sentAt?: number;
  error?: string;
  message?: string;
}

export interface CampaignStats {
  totalLeads: number;
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  sending: number;
  queued: number;
  byPlatform: Record<string, { sent: number; failed: number; pending: number }>;
  lastSendAt?: number;
  nextSendAt?: number;
  estimatedCompletion?: number;
}

// ============================================================
// CONFIG MÁXIMO ARRISCADO
// ============================================================
const CONFIG = {
  // Instagram: máximo arriscado
  igMaxPerDay: 20,
  igMinInterval: 60000,    // 1 min
  igMaxInterval: 120000,   // 2 min
  igPauseAfter: 8,
  igPauseDuration: 300000, // 5 min

  // Facebook: máximo arriscado
  fbMaxPerDay: 30,
  fbMinInterval: 45000,    // 45s
  fbMaxInterval: 90000,    // 1.5 min
  fbPauseAfter: 10,
  fbPauseDuration: 300000,  // 5 min

  // TikTok: máximo arriscado (muito sensível)
  ttMaxPerDay: 15,
  ttMinInterval: 90000,    // 1.5 min
  ttMaxInterval: 180000,   // 3 min
  ttPauseAfter: 6,
  ttPauseDuration: 600000, // 10 min

  maxRetries: 1,
};

// MENSAGEM SOFT MWANGO BRAIN
export const DEFAULT_MESSAGE_SOFT = `Ola {{name}},

Acompanho o teu trabalho ha algum tempo e gosto muito do que fazes.
Somos a Mwango Brain, uma agencia criativa em Luanda. Estamos sempre a procurar criadores com talento para colaborar em projetos inovadores.

Se estiveres aberto a conversar sobre possiveis parcerias, ficava feliz em trocar algumas ideias contigo.
Sem compromisso, claro — so uma conversa.

Cumprimentos,
Equipa Mwango Brain`;

// Variantes da mensagem para rotação (evita padrões repetidos)
export const MESSAGE_VARIANTS = [
  `Ola {{name}},

Tenho seguido o teu conteudo e gosto muito da forma como trabalhas.
Somos a Mwango Brain, uma agencia criativa em Luanda. Estamos a expandir a nossa rede de criadores e o teu perfil chamou-nos a atencao.

Gostavas de conversar sobre como podemos trabalhar juntos? Sem pressa, so quando te for conveniente.

Um abraco,
Equipa Mwango Brain`,

  `Ola {{name}},

Admiro a consistencia e qualidade do teu trabalho. E notavel.
Somos a Mwango Brain em Luanda — uma equipa que apoia criadores a crescer. O teu perfil parece encaixar perfeitamente no que procuramos.

Se te interessar saber mais sobre nos, estamos por aqui.

Cumprimentos,
Equipa Mwango Brain`,

  `Ola {{name}},

Desculpa o contacto directo, mas nao resisti. O teu trabalho e inspirador.
Somos a Mwango Brain, uma agencia criativa em Luanda. Estamos a construir algo especial e gostavamos muito de contar contigo.

Quando tiveres um momento, gostavas de saber mais?

Um abraco,
Equipa Mwango Brain`,

  `Ola {{name}},

Encontrei o teu perfil por acaso e fiquei impressionado com a qualidade do teu conteudo.
Somos a Mwango Brain em Luanda. Trabalhamos com criadores talentosos e o teu trabalho tem exactamente o tipo de autenticidade que valorizamos.

Gostavas de explorar uma possivel colaboracao? Fico a espera do teu feedback.

Cumprimentos,
Equipa Mwango Brain`,

  `Ola {{name}},

O teu perfil apareceu-me nas sugestoes e tive de parar para apreciar o que fazes.
Somos a Mwango Brain, uma agencia criativa em Luanda. Estamos sempre de olho em criadores com potencial e o teu e definitivamente um deles.

Se estiveres curioso sobre o que fazemos, ficava feliz em apresentar-te a nossa visao.

Um abraco,
Equipa Mwango Brain`,
];

// Estado em memória
const campaigns: Map<string, Campaign> = new Map();
const leads: Map<string, CampaignLead[]> = new Map();
const sendState: Record<string, {
  dailyCount: number;
  dailyReset: string;
  lastSend: number;
  count: number;
}> = {};

function generateId(): string {
  return 'camp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function generateLeadId(): string {
  return 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getPlatformConfig(platform: string) {
  switch (platform) {
    case 'instagram':
      return {
        maxPerDay: CONFIG.igMaxPerDay,
        minInterval: CONFIG.igMinInterval,
        maxInterval: CONFIG.igMaxInterval,
        pauseAfter: CONFIG.igPauseAfter,
        pauseDuration: CONFIG.igPauseDuration,
      };
    case 'facebook':
      return {
        maxPerDay: CONFIG.fbMaxPerDay,
        minInterval: CONFIG.fbMinInterval,
        maxInterval: CONFIG.fbMaxInterval,
        pauseAfter: CONFIG.fbPauseAfter,
        pauseDuration: CONFIG.fbPauseDuration,
      };
    case 'tiktok':
      return {
        maxPerDay: CONFIG.ttMaxPerDay,
        minInterval: CONFIG.ttMinInterval,
        maxInterval: CONFIG.ttMaxInterval,
        pauseAfter: CONFIG.ttPauseAfter,
        pauseDuration: CONFIG.ttPauseDuration,
      };
    default:
      return {
        maxPerDay: 10,
        minInterval: 120000,
        maxInterval: 240000,
        pauseAfter: 5,
        pauseDuration: 300000,
      };
  }
}

function getRandomInterval(platform: string): number {
  const cfg = getPlatformConfig(platform);
  return Math.floor(Math.random() * (cfg.maxInterval - cfg.minInterval)) + cfg.minInterval;
}

// Seleciona variante aleatória da mensagem
export function getRandomMessageVariant(name: string, username: string, followers: number): string {
  const variants = [DEFAULT_MESSAGE_SOFT, ...MESSAGE_VARIANTS];
  const variant = variants[Math.floor(Math.random() * variants.length)];
  return variant
    .replace(/{{username}}/g, username)
    .replace(/{{name}}/g, name || username)
    .replace(/{{followers}}/g, followers.toLocaleString('pt-PT'));
}

function getPlatformCookieKey(platform: string, cookies: Campaign['cookies']): string {
  switch (platform) {
    case 'instagram': return cookies.igSessionid || '';
    case 'facebook': return cookies.fbCookie || '';
    case 'tiktok': return cookies.ttSessionid || '';
    default: return '';
  }
}

function canSendToday(platform: string, cookieKey: string): boolean {
  const today = getToday();
  const stateKey = `${platform}_${cookieKey}_${today}`;
  const cfg = getPlatformConfig(platform);
  if (!sendState[stateKey]) {
    sendState[stateKey] = { dailyCount: 0, dailyReset: today, lastSend: 0, count: 0 };
  }
  if (sendState[stateKey].dailyReset !== today) {
    sendState[stateKey] = { dailyCount: 0, dailyReset: today, lastSend: 0, count: 0 };
  }
  return sendState[stateKey].dailyCount < cfg.maxPerDay;
}

function recordSend(platform: string, cookieKey: string): void {
  const today = getToday();
  const stateKey = `${platform}_${cookieKey}_${today}`;
  if (!sendState[stateKey]) {
    sendState[stateKey] = { dailyCount: 0, dailyReset: today, lastSend: 0, count: 0 };
  }
  sendState[stateKey].dailyCount++;
  sendState[stateKey].count++;
  sendState[stateKey].lastSend = Date.now();
}

function getNextAvailableSlot(platform: string, cookieKey: string): number {
  const today = getToday();
  const stateKey = `${platform}_${cookieKey}_${today}`;
  const state = sendState[stateKey];
  const cfg = getPlatformConfig(platform);
  if (!state || state.lastSend === 0) return Date.now() + getRandomInterval(platform);
  let nextSlot = state.lastSend + getRandomInterval(platform);
  if (state.count > 0 && state.count % cfg.pauseAfter === 0) {
    nextSlot += cfg.pauseDuration;
  }
  return nextSlot;
}

//============================================================
// CRIAR CAMPANHA
//============================================================
export async function createCampaign(
  name: string,
  platforms: Campaign['platforms'],
  messageTemplate: string,
  filters: Campaign['filters'],
  cookies: Campaign['cookies']
): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
  try {
    const hasIG = cookies.igSessionid && cookies.igCsrf;
    const hasFB = cookies.fbCookie && cookies.fbDtsg;
    const hasTT = cookies.ttSessionid && cookies.ttCsrf;

    const needed = platforms.filter(p => {
      if (p === 'instagram') return hasIG;
      if (p === 'facebook') return hasFB;
      if (p === 'tiktok') return hasTT;
      return false;
    });

    if (needed.length === 0) {
      return { success: false, error: 'Nenhuma plataforma tem cookies configurados. Vai a /setup-cookies primeiro.' };
    }

    // Calcular máximo seguro baseado nas plataformas escolhidas
    let maxSafe = 0;
    for (const p of needed) {
      maxSafe += getPlatformConfig(p).maxPerDay;
    }
    const safeTargetCount = Math.min(filters.targetCount, maxSafe);

    const campaign: Campaign = {
      id: generateId(),
      name,
      platforms: needed,
      messageTemplate: messageTemplate || DEFAULT_MESSAGE_SOFT,
      filters: { ...filters, targetCount: safeTargetCount },
      cookies,
      status: 'pending',
      createdAt: Date.now(),
    };

    campaigns.set(campaign.id, campaign);
    leads.set(campaign.id, []);

    return { success: true, campaign };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

//============================================================
// FASE 1: SCRAPING DE LEADS
//============================================================
export async function scrapeLeadsForCampaign(campaignId: string): Promise<{ success: boolean; leadsFound?: number; error?: string }> {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return { success: false, error: 'Campanha nao encontrada' };

  campaign.status = 'scraping';

  const allLeads: CampaignLead[] = [];
  const existingLeads = leads.get(campaignId) || [];
  const excludeIds = existingLeads.map(l => l.externalId);

  const filters = {
    ...campaign.filters,
    excludeAlreadyContacted: excludeIds,
  };

  for (const platform of campaign.platforms) {
    try {
      let scraped: any[] = [];
      switch (platform) {
        case 'instagram':
          scraped = await scrapeInstagram(campaign.filters.query, filters);
          break;
        case 'facebook':
          scraped = await scrapeFacebook(campaign.filters.query, filters);
          break;
        case 'tiktok':
          scraped = await scrapeTikTok(campaign.filters.query, filters);
          break;
        case 'linkedin':
          scraped = await scrapeLinkedIn(campaign.filters.query, filters);
          break;
      }

      for (const profile of scraped) {
        const lead: CampaignLead = {
          id: generateLeadId(),
          campaignId,
          platform,
          username: profile.username.replace('@', ''),
          displayName: profile.displayName,
          followers: profile.followers,
          score: calculateScore(profile),
          profileUrl: profile.profileUrl,
          externalId: profile.externalId,
          status: 'pending',
        };
        allLeads.push(lead);
      }
    } catch (e) {
      console.error(`[Scrape ${platform}]`, e);
    }
  }

  allLeads.sort((a, b) => b.score - a.score);

  const current = leads.get(campaignId) || [];
  leads.set(campaignId, [...current, ...allLeads]);

  campaign.status = allLeads.length > 0 ? 'pending' : 'failed';
  if (allLeads.length === 0) campaign.error = 'Nenhum lead encontrado com os filtros atuais';

  return { success: allLeads.length > 0, leadsFound: allLeads.length };
}

//============================================================
// FASE 2: ENVIAR MENSAGENS (MÁXIMO ARRISCADO)
//============================================================
export async function startSending(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return { success: false, error: 'Campanha nao encontrada' };

  const campaignLeads = leads.get(campaignId) || [];
  const pendingLeads = campaignLeads.filter(l => l.status === 'pending');

  if (pendingLeads.length === 0) {
    campaign.status = 'completed';
    campaign.completedAt = Date.now();
    return { success: false, error: 'Nenhum lead pendente' };
  }

  campaign.status = 'sending';
  campaign.startedAt = campaign.startedAt || Date.now();
  processQueue(campaignId);

  return { success: true };
}

async function processQueue(campaignId: string): Promise<void> {
  const campaign = campaigns.get(campaignId);
  if (!campaign || campaign.status !== 'sending') return;

  const campaignLeads = leads.get(campaignId) || [];
  const pendingLeads = campaignLeads.filter(l => l.status === 'pending');

  if (pendingLeads.length === 0) {
    campaign.status = 'completed';
    campaign.completedAt = Date.now();
    return;
  }

  const lead = pendingLeads[0];
  const cookieKey = getPlatformCookieKey(lead.platform, campaign.cookies);

  if (!canSendToday(lead.platform, cookieKey)) {
    campaign.status = 'paused';
    // Agenda retomada para amanhã
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const msUntilTomorrow = tomorrow.getTime() - Date.now();
    setTimeout(() => {
      campaign.status = 'sending';
      processQueue(campaignId);
    }, Math.min(msUntilTomorrow, 3600000));
    return;
  }

  const nextSlot = getNextAvailableSlot(lead.platform, cookieKey);
  const waitTime = Math.max(0, nextSlot - Date.now());
  if (waitTime > 0) {
    setTimeout(() => processQueue(campaignId), waitTime);
    return;
  }

  // Usa variante aleatória da mensagem
  const message = getRandomMessageVariant(
    lead.displayName || lead.username,
    lead.username,
    lead.followers
  );

  lead.status = 'sending';
  lead.message = message;

  try {
    const body: any = {
      platform: lead.platform,
      username: lead.username,
      message: message,
      sentToday: getSentTodayCount(lead.platform, cookieKey),
    };

    if (lead.platform === 'instagram') {
      body.igSessionid = campaign.cookies.igSessionid;
      body.igCsrf = campaign.cookies.igCsrf;
    } else if (lead.platform === 'facebook') {
      body.fbCookie = campaign.cookies.fbCookie;
      body.fbDtsg = campaign.cookies.fbDtsg;
    } else if (lead.platform === 'tiktok') {
      body.ttSessionid = campaign.cookies.ttSessionid;
      body.ttCsrf = campaign.cookies.ttCsrf;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.success && data.dmSent) {
      lead.status = 'sent';
      lead.sentAt = Date.now();
      recordSend(lead.platform, cookieKey);
    } else {
      lead.status = 'failed';
      lead.error = data.deliveryMsg || data.error || 'Erro desconhecido';

      if (data.needCookies ||
          (data.deliveryMsg || '').includes('cookie') ||
          (data.deliveryMsg || '').includes('limit') ||
          (data.deliveryMsg || '').includes('spam') ||
          res.status === 429) {
        campaign.status = 'paused';
        return;
      }
    }
  } catch (e: any) {
    lead.status = 'failed';
    lead.error = e.message;
  }

  setTimeout(() => processQueue(campaignId), getRandomInterval(lead.platform));
}

function getSentTodayCount(platform: string, cookieKey: string): number {
  const today = getToday();
  const stateKey = `${platform}_${cookieKey}_${today}`;
  return sendState[stateKey]?.dailyCount || 0;
}

//============================================================
// ESTATÍSTICAS E GESTÃO
//============================================================
export function getCampaignStats(campaignId: string): CampaignStats | null {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return null;

  const campaignLeads = leads.get(campaignId) || [];
  const byPlatform: CampaignStats['byPlatform'] = {};

  for (const platform of campaign.platforms) {
    const platformLeads = campaignLeads.filter(l => l.platform === platform);
    byPlatform[platform] = {
      sent: platformLeads.filter(l => l.status === 'sent').length,
      failed: platformLeads.filter(l => l.status === 'failed').length,
      pending: platformLeads.filter(l => l.status === 'pending' || l.status === 'queued').length,
    };
  }

  const sentLeads = campaignLeads.filter(l => l.status === 'sent');
  const lastSent = sentLeads.length > 0 ? Math.max(...sentLeads.map(l => l.sentAt || 0)) : undefined;

  const pendingCount = campaignLeads.filter(l => l.status === 'pending').length;
  let avgInterval = 0;
  for (const p of campaign.platforms) {
    const cfg = getPlatformConfig(p);
    avgInterval += (cfg.minInterval + cfg.maxInterval) / 2;
  }
  avgInterval = avgInterval / campaign.platforms.length;
  const estimatedMs = pendingCount * avgInterval;

  return {
    totalLeads: campaignLeads.length,
    pending: campaignLeads.filter(l => l.status === 'pending').length,
    sent: campaignLeads.filter(l => l.status === 'sent').length,
    failed: campaignLeads.filter(l => l.status === 'failed').length,
    skipped: campaignLeads.filter(l => l.status === 'skipped').length,
    sending: campaignLeads.filter(l => l.status === 'sending').length,
    queued: campaignLeads.filter(l => l.status === 'queued').length,
    byPlatform,
    lastSendAt: lastSent,
    nextSendAt: lastSent ? lastSent + avgInterval : undefined,
    estimatedCompletion: pendingCount > 0 ? Date.now() + estimatedMs : undefined,
  };
}

export function getCampaign(campaignId: string): Campaign | undefined {
  return campaigns.get(campaignId);
}

export function getCampaignLeads(campaignId: string): CampaignLead[] {
  return leads.get(campaignId) || [];
}

export function getAllCampaigns(): Campaign[] {
  return Array.from(campaigns.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function pauseCampaign(campaignId: string): boolean {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return false;
  campaign.status = 'paused';
  return true;
}

export function resumeCampaign(campaignId: string): boolean {
  const campaign = campaigns.get(campaignId);
  if (!campaign) return false;
  campaign.status = 'sending';
  processQueue(campaignId);
  return true;
}

export function deleteCampaign(campaignId: string): boolean {
  campaigns.delete(campaignId);
  leads.delete(campaignId);
  return true;
}

export function skipLead(campaignId: string, leadId: string): boolean {
  const campaignLeads = leads.get(campaignId);
  if (!campaignLeads) return false;
  const lead = campaignLeads.find(l => l.id === leadId);
  if (!lead) return false;
  lead.status = 'skipped';
  return true;
}

// Exporta config para a UI
export function getPlatformLimits() {
  return {
    instagram: { maxPerDay: CONFIG.igMaxPerDay, minInterval: CONFIG.igMinInterval, maxInterval: CONFIG.igMaxInterval },
    facebook: { maxPerDay: CONFIG.fbMaxPerDay, minInterval: CONFIG.fbMinInterval, maxInterval: CONFIG.fbMaxInterval },
    tiktok: { maxPerDay: CONFIG.ttMaxPerDay, minInterval: CONFIG.ttMinInterval, maxInterval: CONFIG.ttMaxInterval },
  };
}