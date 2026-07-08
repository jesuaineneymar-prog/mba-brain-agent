import { NextResponse } from 'next/server';

// ============================================================
//  MBA BRAIN AGENT — WEBHOOK para n8n
//  Recebe actualizacoes de DM status do n8n
//  Tambem fornece a queue de perfis pendentes
// ============================================================

var WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'mba-brain-n8n-2024';

// In-memory store (em producao usar KV/DB)
var dmResults: Array<{
  id: string;
  profileId: string;
  username: string;
  platform: string;
  dmSent: boolean;
  deliveryMsg: string;
  timestamp: string;
}> = [];

/* ===== POST: n8n envia resultado de DM ===== */
export async function POST(request: Request) {
  try {
    var body = await request.json();
    var secret = request.headers.get('x-n8n-secret');
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ success: false, error: 'Secret invalido' }, { status: 401 });
    }

    var action = body.action || 'dm_result';

    if (action === 'dm_result') {
      // n8n envia resultado de cada DM enviado
      var result = {
        id: body.id || Math.random().toString(36).substring(2, 10),
        profileId: body.profileId || '',
        username: body.username || '',
        platform: body.platform || '',
        dmSent: !!body.dmSent,
        deliveryMsg: body.deliveryMsg || '',
        timestamp: new Date().toISOString()
      };
      dmResults.push(result);

      return NextResponse.json({
        success: true,
        message: result.dmSent ? 'DM registado como enviado' : 'DM registado como falhado',
        totalResults: dmResults.length
      });
    }

    if (action === 'batch_result') {
      // n8n envia lote de resultados
      var batch: any[] = body.results || [];
      for (var i = 0; i < batch.length; i++) {
        var r = batch[i];
        dmResults.push({
          id: r.id || Math.random().toString(36).substring(2, 10),
          profileId: r.profileId || '',
          username: r.username || '',
          platform: r.platform || '',
          dmSent: !!r.dmSent,
          deliveryMsg: r.deliveryMsg || '',
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        message: batch.length + ' resultados registados',
        totalResults: dmResults.length
      });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Erro interno' }, { status: 500 });
  }
}

/* ===== GET: Retorna status e resultados recentes ===== */
export async function GET() {
  var recent = dmResults.slice(-50).reverse();
  var sent = dmResults.filter(function(r) { return r.dmSent; }).length;
  var failed = dmResults.filter(function(r) { return !r.dmSent; }).length;
  return NextResponse.json({
    n8n: { connected: true, webhookSecret: WEBHOOK_SECRET.substring(0, 8) + '...' },
    stats: { total: dmResults.length, sent: sent, failed: failed },
    recentResults: recent
  });
}