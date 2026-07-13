//============================================================
// MBA BRAIN AGENT — CAMPAIGN API
// Orquestra scrape + envio de mensagens
//============================================================
import { NextResponse } from 'next/server';
import {
  createCampaign,
  scrapeLeadsForCampaign,
  startSending,
  getCampaignStats,
  getCampaign,
  getCampaignLeads,
  getAllCampaigns,
  pauseCampaign,
  resumeCampaign,
  deleteCampaign,
  skipLead,
} from '@/lib/campaign-engine';

export const maxDuration = 300; // 5 min para scraping

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // ---- CRIAR CAMPANHA ----
    if (action === 'create') {
      const { name, platforms, messageTemplate, filters, cookies } = body;
      if (!name || !filters || !platforms?.length) {
        return NextResponse.json(
          { success: false, error: 'Faltam campos obrigatorios (name, platforms, filters)' },
          { status: 400 }
        );
      }
      const result = await createCampaign(name, platforms, messageTemplate, filters, cookies || {});
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        campaign: result.campaign,
        message: 'Campanha criada. Agora faz scrape para encontrar leads.',
      });
    }

    // ---- SCRAPE LEADS ----
    if (action === 'scrape') {
      const { campaignId } = body;
      if (!campaignId) {
        return NextResponse.json({ success: false, error: 'Falta campaignId' }, { status: 400 });
      }
      const result = await scrapeLeadsForCampaign(campaignId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        leadsFound: result.leadsFound,
        message: `${result.leadsFound} leads encontrados!`,
      });
    }

    // ---- INICIAR ENVIO ----
    if (action === 'start') {
      const { campaignId } = body;
      if (!campaignId) {
        return NextResponse.json({ success: false, error: 'Falta campaignId' }, { status: 400 });
      }
      const result = await startSending(campaignId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: 'Envio iniciado. As mensagens vao ser enviadas automaticamente com delays.',
      });
    }

    // ---- PAUSAR ----
    if (action === 'pause') {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ success: false, error: 'Falta campaignId' }, { status: 400 });
      const ok = pauseCampaign(campaignId);
      return NextResponse.json({ success: ok, message: ok ? 'Campanha pausada' : 'Campanha nao encontrada' });
    }

    // ---- RESUME ----
    if (action === 'resume') {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ success: false, error: 'Falta campaignId' }, { status: 400 });
      const ok = resumeCampaign(campaignId);
      return NextResponse.json({ success: ok, message: ok ? 'Campanha retomada' : 'Campanha nao encontrada' });
    }

    // ---- SKIP LEAD ----
    if (action === 'skip-lead') {
      const { campaignId, leadId } = body;
      if (!campaignId || !leadId) return NextResponse.json({ success: false, error: 'Faltam IDs' }, { status: 400 });
      const ok = skipLead(campaignId, leadId);
      return NextResponse.json({ success: ok });
    }

    // ---- DELETE ----
    if (action === 'delete') {
      const { campaignId } = body;
      if (!campaignId) return NextResponse.json({ success: false, error: 'Falta campaignId' }, { status: 400 });
      deleteCampaign(campaignId);
      return NextResponse.json({ success: true, message: 'Campanha eliminada' });
    }

    return NextResponse.json({ success: false, error: 'Acao desconhecida' }, { status: 400 });
  } catch (error: any) {
    console.error('[Campaign API]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// ---- GET: LISTAR CAMPANHAS E STATS ----
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('id');
    const includeLeads = searchParams.get('leads') === 'true';

    if (campaignId) {
      const campaign = getCampaign(campaignId);
      if (!campaign) {
        return NextResponse.json({ success: false, error: 'Campanha nao encontrada' }, { status: 404 });
      }
      const stats = getCampaignStats(campaignId);
      const response: any = {
        success: true,
        campaign,
        stats,
      };
      if (includeLeads) {
        response.leads = getCampaignLeads(campaignId);
      }
      return NextResponse.json(response);
    }

    // Listar todas
    const all = getAllCampaigns();
    const withStats = all.map(c => ({
      ...c,
      stats: getCampaignStats(c.id),
    }));

    return NextResponse.json({
      success: true,
      campaigns: withStats,
      total: withStats.length,
    });
  } catch (error: any) {
    console.error('[Campaign API GET]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}