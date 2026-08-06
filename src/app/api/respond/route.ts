import { NextResponse } from 'next/server';

var GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    if (!GEMINI_KEY) {
      return NextResponse.json({ reply: 'API key nao configurada.' });
    }

    var contents: any[] = [];
    var systemText = 'Es o assistente do Mwango Brain Agent, um sistema de prospeccao inteligente. ' + systemContext + '\nResponde sempre em portugues. Seja conciso e util.';
    for (var i = 0; i < conversationHistory.length; i++) {
      contents.push({ role: conversationHistory[i].role === 'assistant' ? 'model' : 'user', parts: [{ text: conversationHistory[i].content }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents: contents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } })
    });
    var data = await r.json();
    var reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}
