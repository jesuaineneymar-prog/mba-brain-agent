import { NextResponse } from 'next/server';
import { MWANGO_KNOWLEDGE } from '@/lib/mwango-knowledge';

var NVIDIA_KEY = process.env.NVIDIA_API_KEY || '';

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    var systemText = 'Es o assistente virtual da Mwango Brain, uma empresa angolana de tecnologia e criatividade com 16 anos de experiencia. ' +
      'Este assistente esta integrado no MBA Brain Agent, um sistema interno de prospeccao inteligente. ' +
      'O sistema NAO envia mensagens directas - serve apenas para encontrar e analisar perfis. ' +
      'Responde sempre em portugues. Seja conciso mas completo. ' +
      'Conhece tudo sobre a empresa Mwango Brain, seus servicos, projectos, redes sociais, historia, valores e o sistema MBA Brain Agent.\n\n' +
      '=== CONHECIMENTO DA EMPRESA E SISTEMA ===\n' + MWANGO_KNOWLEDGE + '\n\n' +
      '=== ESTADO ACTUAL DO SISTEMA ===\n' + systemContext;

    // Build messages array (OpenAI-compatible format)
    var messages: any[] = [
      { role: 'system', content: systemText }
    ];
    for (var i = 0; i < conversationHistory.length; i++) {
      messages.push({ role: conversationHistory[i].role, content: conversationHistory[i].content });
    }
    messages.push({ role: 'user', content: message });

    var reply = '';

    // Use NVIDIA NIM API (OpenAI-compatible)
    if (NVIDIA_KEY) {
      try {
        var r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + NVIDIA_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'meta/llama-3.1-405b-instruct',
            messages: messages,
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.9
          })
        });
        if (r.ok) {
          var data = await r.json();
          reply = data?.choices?.[0]?.message?.content || '';
        } else {
          var errText = await r.text();
          console.error('NVIDIA API error:', r.status, errText);
          // Fallback to smaller model if 405b fails
          try {
            var r2 = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + NVIDIA_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'meta/llama-3.1-70b-instruct',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.7,
                top_p: 0.9
              })
            });
            if (r2.ok) {
              var data2 = await r2.json();
              reply = data2?.choices?.[0]?.message?.content || '';
            }
          } catch(e2) {}
        }
      } catch(e) {
        console.error('NVIDIA API exception:', e);
      }
    }

    if (!reply) reply = 'Sem resposta no momento. Tente novamente em alguns segundos.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}
