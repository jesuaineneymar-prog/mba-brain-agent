import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_API_KEY || '';

// Check the status of an Apify run and return results
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');

  if (!runId || !APIFY_TOKEN) {
    return NextResponse.json({ error: 'runId obrigatório' }, { status: 400 });
  }

  try {
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    if (!statusRes.ok) {
      return NextResponse.json({ error: 'Erro ao verificar run' }, { status: 500 });
    }

    const statusData = await statusRes.json();

    let items: any[] = [];
    if (statusData.status === 'SUCCEEDED') {
      const datasetRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=100`
      );
      if (datasetRes.ok) {
        items = await datasetRes.json();
      }
    }

    return NextResponse.json({
      id: statusData.id,
      status: statusData.status,
      startedAt: statusData.startedAt,
      finishedAt: statusData.finishedAt,
      actId: statusData.actId,
      itemsCount: items.length,
      items,
    });
  } catch (error) {
    console.error('Apify run error:', error);
    return NextResponse.json({ error: 'Erro' }, { status: 500 });
  }
}