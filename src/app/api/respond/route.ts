import { NextResponse } from 'next/server';
import { MWANGO_KNOWLEDGE } from '@/lib/mwango-knowledge';

var NVIDIA_KEY = process.env.NVIDIA_API_KEY || '';

// Models available on this NVIDIA NIM key (tested and confirmed working)
var NVIDIA_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'nvidia/nemotron-3-nano-30b-a3b'
];

export async function POST(req: Request) {
  try {
    var body = await req.json();
    var message = body.message || '';
    var conversationHistory = body.conversationHistory || [];
    var systemContext = body.systemContext || '';

    var systemText = 'Es o assistente virtual da Mwango Brain, uma empresa angolana de tecnologia e criatividade com 16 anos de experiencia. ' +
      'Este assistente esta integrado no MBA Brain Agent, um sistema interno de prospeccao inteligente. ' +
      'O sistema NAO envia mensagens directas - serve apenas para encontrar e analisar perfis. ' +
      'Responde sempre em portugues de forma directa e clara. NAO penses em voz alta. ' +
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

    // Try each NVIDIA model until one works
    if (NVIDIA_KEY) {
      for (var m = 0; m < NVIDIA_MODELS.length; m++) {
        try {
          var r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + NVIDIA_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: NVIDIA_MODELS[m],
              messages: messages,
              max_tokens: 1024,
              temperature: 0.7,
              top_p: 0.9
            })
          });
          if (r.ok) {
            var data = await r.json();
            var content = data?.choices?.[0]?.message?.content || '';
            // Some NVIDIA models return reasoning_content instead of content
            if (!content) {
              content = data?.choices?.[0]?.message?.reasoning_content || '';
            }
            if (content) {
              reply = content.trim();
              break;
            }
          }
        } catch(e) {
          console.error('NVIDIA model ' + NVIDIA_MODELS[m] + ' failed:', e);
        }
      }
    }

    if (!reply) reply = 'Sem resposta no momento. Tente novamente em alguns segundos.';

    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: 'Erro: ' + (e.message || 'desconhecido') });
  }
}
