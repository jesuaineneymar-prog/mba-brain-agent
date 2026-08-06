import { NextResponse } from 'next/server';

var OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
var GEMINI_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    var systemText = 'Es o assistente do Mwango Brain Agent, um sistema de prospeccao inteligente. ' + systemContext + '\nResponde sempre em portugues. Seja conciso e util.';

    // Build messages array
    var messages: any[] = [
      { role: 'system', content: systemText }
    ];
    for (var i = 0; i < conversationHistory.length; i++) {
      messages.push({ role: conversationHistory[i].role, content: conversationHistory[i].content });
    }
    messages.push({ role: 'user', content: message });

    var reply = '';

    // Try Gemini first
    if (GEMINI_KEY) {
      try {
        var contents: any[] = [];
        for (var i = 0; i < messages.length; i++) {
          if (messages[i].role === 'system') continue;
          contents.push({ role: messages[i].role === 'assistant' ? 'model' : 'user', parts: [{ text: messages[i].content }] });
        }
        var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents: contents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } })
        });
        if (r.ok) {
          var data = await r.json();
          reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      } catch(e) {}
    }

    // Fallback to OpenRouter with free model
    if (!reply && OPENROUTER_KEY) {
      try {
        var r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://mba-brain-agent.vercel.app', 'X-Title': 'MBA Brain Agent' },
          body: JSON.stringify({ model: 'nvidia/nemotron-3-nano-30b-a3b:free', messages: messages, max_tokens: 500, temperature: 0.7 })
        });
        if (r2.ok) {
          var data2 = await r2.json();
          reply = data2?.choices?.[0]?.message?.content || '';
        }
      } catch(e) {}
    }

    if (!reply) reply = 'Sem resposta. Verifique as configuracoes da API.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}
