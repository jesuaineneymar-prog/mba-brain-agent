import { NextResponse } from 'next/server';

var GROQ_KEY = process.env.GROQ_API_KEY || '';

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    if (!GROQ_KEY) {
      return NextResponse.json({ reply: 'API key nao configurada. Define GROQ_API_KEY nas variaveis de ambiente.' });
    }

    var messages: any[] = [
      { role: 'system', content: 'Es o assistente do Mwango Brain Agent, um sistema de prospeccao inteligente. ' + systemContext + '\nResponde sempre em portugues. Seja conciso e util.' }
    ];
    for (var i = 0; i < conversationHistory.length; i++) {
      messages.push({ role: conversationHistory[i].role, content: conversationHistory[i].content });
    }
    messages.push({ role: 'user', content: message });

    var r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: messages, max_tokens: 500, temperature: 0.7 })
    });
    var data = await r.json();
    var reply = data?.choices?.[0]?.message?.content || 'Sem resposta.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}