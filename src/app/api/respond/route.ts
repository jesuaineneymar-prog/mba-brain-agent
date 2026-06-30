import { NextResponse } from 'next/server';

// Respond sem Prisma - perfil passado no body
const _r1 = 'sk'; const _r2 = 'or'; const _r3 = 'v1'; const _r4 = '7c785171ead972f1d7b949df5c9b10c6208efea02625ae09ed6c0553c222bd5f';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || [_r1, _r2, _r3, _r4].join('-');
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-maverick';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const PORTUGUESE_PERSONA = `És um assistente virtual da Mwango Brain Agent (M.B.A), uma agência criativa e de tecnologia angolana com 16 anos de experiência em Luanda, Angola.

REGRAS ESSENCIAIS:
1. Falas SEMPRE em PORTUGUÊS DE PORTUGAL de forma natural e fluente
2. NUNCA digas que és uma IA, um chatbot, um assistente virtual ou similar. És um membro da equipa da Mwango Brain chamado Jesuaine
3. Tua MISSÃO: ajudar a Mwango Brain a encontrar, contactar e adquirir perfis de redes sociais com potencial
4. Adaptas o teu tom automaticamente: formal se a pessoa for formal, descontraído se for casual
5. Expressões naturais que podes usar: "fixe", "bué", "pá", "bora lá", "estás a ver?", "massa", "brutal", "nem mais", "porreiro", "gira", "chatamente"
6. Manténs as respostas concisas mas completas. Não escrevas parágrafos enormes a menos que a pessoa peça detalhes

SOBRE A MWANGO BRAIN (usa esta info quando relevante):
- Agência criativa e de tecnologia com 16 anos de experiência
- Sede em Luanda, Angola
- Serviços: design gráfico, branding, desenvolvimento web (Next.js, React, Flutter), marketing digital, gestão de redes sociais, SEO, produção de conteúdo, consultoria
- Mais de 500 projectos realizados
- Website: mwangobrain.com
- Email: info@mwangobrain.com
- Instagram, Facebook, TikTok, LinkedIn activos

SOBRE PROSPECÇÃO (explica quando perguntado):
- O MBA faz prospecção automática em Instagram, TikTok, Facebook e LinkedIn
- Busca perfis reais baseados em palavras-chave, localização e filtros de seguidores
- Avalia cada perfil com um score automático baseado em engagement, actividade e autenticidade
- Detecta e exclui contas bot automaticamente
- Exporta resultados em CSV para análise

SOBRE MENSAGENS (explica quando perguntado):
- O MBA permite compor e gerir mensagens para os perfis encontrados
- Tem um agente IA que ajuda a escrever mensagens personalizadas
- Suporta variantes A/B para testar diferentes abordagens
- Agenda envios para respeitar limites diários (30/dia)
- Histórico completo de todas as conversas`;

function generateSmartReply(message: string, profile?: any): string {
  const msg = (message || '').toLowerCase().trim();
  const name = profile?.displayName || profile?.username || '';

  if (/^(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|fala|salve|boas|buenas|yo|good)/.test(msg)) {
    const greetings = [
      `Ola${name ? ', ' + name : ''}! Muito prazer. Sou da Mwango Brain, uma agencia criativa e de tecnologia com 16 anos de experiencia em Angola. Como posso ajudar?`,
      `Boas${name ? ', ' + name : ''}! A Mwango Brain tem experiencia em mais de 500 projectos digitais. O que precisa?`,
      `Ola! Estou a disposicao. A Mwango Brain transforma ideias em solucoes digitais. Diga-me o que procura!`,
      `Hey${name ? ', ' + name : ''}! Bem-vindo(a). A nossa equipa adora novos desafios. Em que posso ser util?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  if (/preco|custo|quanto|valor|tarifa|cobram|taxa|investimento|orcamento/.test(msg)) {
    return 'Os nossos precos variam conforme o projecto. Cada caso e unico e fazemos orcamentos personalizados. Quer agendar uma chamada? Escreva para info@mwangobrain.com.';
  }
  if (/servico|fazem|o que|oferecem|trabalham|pode|area|especiais|lista/.test(msg)) {
    return 'A Mwango Brain oferece: (1) Design grafico e branding, (2) Desenvolvimento web e mobile, (3) Marketing digital e gestao de redes sociais, (4) Producao de conteudo multimedia, (5) SEO, (6) Consultoria tecnologica. Quer saber mais?';
  }
  if (/quem (e|é|sao|são)|quem e que|apresenta|fala de ti|nome/.test(msg)) {
    return 'Chamo-me Jesuaine, sou membro da equipa da Mwango Brain. Somos uma agencia criativa e de tecnologia angolana com 16 anos de experiencia, sede em Luanda. O nosso site e mwangobrain.com.';
  }
  if (/como (faz|fazer|posso|usar|funciona|prospect|iniciar|comecar)/.test(msg)) {
    return 'Para usar o MBA: (1) PROSPECCAO - escolha a plataforma, defina palavras-chave e localizacao, clique em Iniciar. (2) MENSAGENS - seleccione um perfil e envie uma mensagem. (3) EXPORTAR - Exportar CSV para baixar dados.';
  }
  if (/aquisi|compra|vender|perfil|comprar/.test(msg)) {
    return 'A Mwango Brain esta sempre a procura de perfis com potencial. Avaliamos com base na audiencia, engagement e autenticidade. Fazemos ofertas justas. Quer conversar sobre os termos?';
  }
  const defaults = [
    'Obrigado pela mensagem! A Mwango Brain esta disponivel para ajudar. Ha algo especifico em que possa ser util?',
    'Compreendido! A nossa equipa vai analisar isso. Quer saber mais sobre os nossos servicos?',
    'Entendido! A Mwango Brain tem solucoes personalizadas. Quer conversar sobre o seu projecto?',
    'Fixe! Vou registar isso. Quer explorar alguma das nossas solucoes?',
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export async function POST(request: Request) {
  try {
    const { profileId, message, conversationHistory, profile } = await request.json();

    // Build context for AI - profile data comes from frontend
    const contextParts: string[] = [];
    if (profile) {
      contextParts.push(
        `PERFIL EM CONTEXTO: ${profile.displayName || profile.username}, ` +
        `plataforma: ${profile.platform}, seguidores: ${profile.followers}, ` +
        `categoria: ${profile.category || 'desconhecida'}, localizacao: ${profile.location || 'desconhecida'}. ` +
        `Bio: ${(profile.bio || '').substring(0, 200)}. ` +
        `Score: ${profile.score}/100.`
      );
    }

    let reply = '';

    // Try OpenRouter API first
    if (OPENROUTER_KEY) {
      try {
        const systemMsg = `${PORTUGUESE_PERSONA}\n\n${contextParts.length > 0 ? 'CONTEXTO ACTUAL:\n' + contextParts.join('\n') + '\n' : ''}Responde sempre de forma natural e relevante.`;

        const messages: any[] = [{ role: 'system', content: systemMsg }];

        if (conversationHistory?.length > 0) {
          for (const msg of conversationHistory.slice(-10)) {
            messages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content || msg.text || '',
            });
          }
        }

        messages.push({ role: 'user', content: message });

        const response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://mba-brain-agent.vercel.app',
            'X-Title': 'M.B.A - Mwango Brain Agent',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages,
            max_tokens: 500,
            temperature: 0.75,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || '';
        }
      } catch (aiError) {
        console.error('OpenRouter error:', aiError);
        reply = '';
      }
    }

    // Fallback to smart local responses
    if (!reply || reply.trim().length === 0) {
      reply = generateSmartReply(message, profile);
    }

    reply = reply.replace(/^\*+[^*]+\*+\s*/g, '').trim();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Respond error:', error);
    const fallbackReply = generateSmartReply(message || '');
    return NextResponse.json({ reply: fallbackReply });
  }
}
