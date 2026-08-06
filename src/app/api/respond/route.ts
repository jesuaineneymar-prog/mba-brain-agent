import { NextResponse } from 'next/server';

var OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    if (!OPENROUTER_KEY) {
      return NextResponse.json({ reply: 'API key nao configurada.' });
    }

    var messages: any[] = [
      { role: 'system', content: 'Es o assistente do Mwango Brain Agent, um sistema de prospeccao inteligente. ' + systemContext + '\nResponde sempre em portugues. Seja conciso e util.' }
    ];
    for (var i = 0; i < conversationHistory.length; i++) {
      messages.push({ role: conversationHistory[i].role, content: conversationHistory[i].content });
    }
    messages.push({ role: 'user', content: message });

    var r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://mba-brain-agent.vercel.app', 'X-Title': 'MBA Brain Agent' },
      body: JSON.stringify({ model: 'google/gemini-2.0-flash-001', messages: messages, max_tokens: 500, temperature: 0.7 })
    });
    var data = await r.json();
    var reply = data?.choices?.[0]?.message?.content || 'Sem resposta.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}