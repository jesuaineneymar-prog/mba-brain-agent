import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — SEND MESSAGE API v6
//  Envia DMs via n8n webhooks (login automatico + proxy support)
// ===========================================================

export var maxDuration = 120;
var MAX_PER_DAY = 30;

const N8N_BASE = process.env.N8N_WEBHOOK_URL || 'https://n8n-production-2236.up.railway.app';

const WEBHOOK_PATHS: Record<string, string> = {
  instagram: '/webhook/ig-send-dm',
  facebook: '/webhook/fb-send-dm',
  tiktok: '/webhook/tt-send-dm',
};

const DEFAULT_MESSAGE = `Ola,
O meu nome e Jesuaine Cristiano e represento a Mwango Brain, uma agencia criativa sediada em Luanda, Angola.
Tenho acompanhado o seu perfil com interesse e gostaria de lhe apresentar uma proposta de aquisicao da sua conta.
Estamos dispostos a fazer uma oferta justa pelo seu perfil. Caso tenha interesse em saber mais detalhes, basta responder a esta mensagem e entraremos em contacto rapidamente.
Aguardamos o seu contacto.
Cumprimentos,
Equipa Mwango Brain
mwangobrain.com`;

var dailyCount: Record<string, number> = {};
function getToday() { return new Date().toISOString().split('T')[0]; }
function getSentToday(platform: string) { return dailyCount[platform + '_' + getToday()] || 0; }
function recordSend(platform: string) { var key = platform + '_' + getToday(); dailyCount[key] = (dailyCount[key] || 0) + 1; }

async function sendViaN8N(platform: string, username: string, message: string): Promise<{
  success: boolean; dmSent: boolean; deliveryMsg: string; remainingToday: number; error?: string;
  needsCheckpoint?: boolean; needsProxy?: boolean;
}> {
  var path = WEBHOOK_PATHS[platform];
  if (!path) return { success: false, dmSent: false, deliveryMsg: 'Plataforma nao suportada', remainingToday: MAX_PER_DAY };

  var sentToday = getSentToday(platform);
  if (sentToday >= MAX_PER_DAY) {
    return { success: false, dmSent: false, deliveryMsg: 'Limite diario atingido (' + MAX_PER_DAY + ')', remainingToday: 0 };
  }

  try {
    var res = await fetch(N8N_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, message }),
      signal: AbortSignal.timeout(90000),
    });

    var data = await res.json();
    var plat = platform === 'instagram' ? 'IG' : platform === 'facebook' ? 'FB' : 'TT';

    if (data.success) {
      recordSend(platform);
      return {
        success: true, dmSent: true,
        deliveryMsg: `${plat}: DM enviado para ${platform === 'instagram' ? '@' : ''}${username}`,
        remainingToday: MAX_PER_DAY - getSentToday(platform),
      };
    } else {
      return {
        success: false, dmSent: false,
        deliveryMsg: `${plat}: ${data.error || 'Falhou ao enviar DM'}`,
        remainingToday: MAX_PER_DAY - sentToday,
        error: data.error,
        needsCheckpoint: data.needsCheckpoint,
        needsProxy: data.needsProxy,
        proxyUsed: data.proxyUsed,
      };
    }
  } catch (e: any) {
    return {
      success: false, dmSent: false,
      deliveryMsg: `Erro de conexao com n8n: ${e.message || 'timeout'}`,
      remainingToday: MAX_PER_DAY - sentToday,
    };
  }
}

export async function POST(request: any) {
  var body;
  try { body = await request.json(); } catch(e) { return NextResponse.json({ error: 'JSON invalido' }, { status: 400 }); }

  var platform = (body.platform || '').toLowerCase().trim();
  var username = body.username || '';
  var message = body.message || DEFAULT_MESSAGE;

  if (!platform || !username) {
    return NextResponse.json({ success: false, dmSent: false, deliveryMsg: 'Plataforma e username sao obrigatorios', remainingToday: MAX_PER_DAY });
  }

  if (body.action === 'diagnostic') {
    return NextResponse.json({
      method: 'n8n webhooks v6 (proxy support)',
      n8nUrl: N8N_BASE,
      platforms: Object.keys(WEBHOOK_PATHS),
      maxPerDay: MAX_PER_DAY,
      remainingToday: {
        instagram: MAX_PER_DAY - getSentToday('instagram'),
        facebook: MAX_PER_DAY - getSentToday('facebook'),
        tiktok: MAX_PER_DAY - getSentToday('tiktok'),
      },
      proxyConfig: N8N_BASE + '/webhook/mba-proxy-config',
    });
  }

  if (body.action === 'validate-cookies' || body.action === 'login') {
    return NextResponse.json({ success: true, message: 'Com n8n, o login e automatico. Basta enviar username + mensagem.' });
  }

  if (body.action === 'set-proxy') {
    try {
      var proxyUrl = body.proxy;
      if (!proxyUrl) return NextResponse.json({ success: false, error: 'Envie {proxy: "http://user:pass@host:port"}' });
      var pRes = await fetch(N8N_BASE + '/webhook/mba-proxy-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy: proxyUrl }),
        signal: AbortSignal.timeout(30000),
      });
      var pData = await pRes.json();
      return NextResponse.json(pData);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Erro ao configurar proxy: ' + (e.message || 'timeout') });
    }
  }

  var result = await sendViaN8N(platform, username, message);
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    maxPerDay: MAX_PER_DAY,
    remainingToday: {
      instagram: MAX_PER_DAY - getSentToday('instagram'),
      facebook: MAX_PER_DAY - getSentToday('facebook'),
      tiktok: MAX_PER_DAY - getSentToday('tiktok'),
    },
    method: 'n8n webhooks v6 (proxy support)',
    n8nUrl: N8N_BASE,
    platforms: ['instagram', 'facebook', 'tiktok'],
    note: 'DMs via n8n — login automatico com cache de sessao + suporte a proxy residencial',
    proxyConfig: N8N_BASE + '/webhook/mba-proxy-config',
    defaultMessage: DEFAULT_MESSAGE,
  });
}