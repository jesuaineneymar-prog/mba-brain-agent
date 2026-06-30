import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
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
      `Salve! A Mwango Brain tem 16 anos a criar solucoes digitais em Angola. Ha algo especifico que procura?`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (/preco|custo|quanto|valor|tarifa|cobram|taxa|investimento| orcamento|quanto custa|precos|planos|pacotes/.test(msg)) {
    const pricing = [
      'Os nossos precos variam conforme o projecto. Cada caso e unico e fazemos orcamentos personalizados. O melhor e conversarmos para entender o que precisa. Quer agendar uma chamada? Escreva para info@mwangobrain.com.',
      'Trabalhamos com diferentes faixas de investimento, desde branding completo ate gestao de redes sociais. O ideal e conversarmos para alinhar expectativas e apresentar uma proposta justa.',
      'Cada projecto tem o seu orcamento. A Mwango Brain acredita que boa solucao digital nao precisa de ser cara. Faca-nos chegar os detalhes do seu projecto e apresentamos uma proposta.',
    ];
    return pricing[Math.floor(Math.random() * pricing.length)];
  }

  if (/servico|fazem|o que|oferecem|trabalham|pode|area|especiais|lista/.test(msg)) {
    return 'A Mwango Brain oferece um leque completo de servicos: (1) Design grafico e branding completo, (2) Desenvolvimento web e mobile (Next.js, React, Flutter), (3) Marketing digital e gestao de redes sociais, (4) Producao de conteudo multimedia, (5) SEO e posicionamento, (6) Consultoria tecnologica. Quer saber mais sobre algum em particular?';
  }

  if (/portfolio|trabalhos|exemplos|projetos|casos|clientes|marcas/.test(msg)) {
    return 'Temos mais de 500 projectos realizados em 16 anos. Os nossos clientes incluem marcas angolanas e internacionais em varios sectores: restauracao, entretenimento, tecnologia, imobiliario, e mais. Posso partilhar case studies relevantes para a sua area. Qual e o seu sector?';
  }

  if (/interesse|parceria|colaborar|juntos|trabalhar com|parceiro|alianca/.test(msg)) {
    return 'Adoramos parcerias! O processo e simples: conversamos sobre o seu projecto, definimos objectivos claros, apresentamos uma proposta e comecamos a trabalhar. Tudo com acompanhamento constante. Quer que agendemos um encontro?';
  }

  if (/tempo|prazo|entrega|demora|quando|rapido|urgente|deadline/.test(msg)) {
    return 'Os prazos dependem da complexidade do projecto. Como referencia: logotipos e branding 1-2 semanas, websites 2-4 semanas, apps 1-3 meses, gestao de redes sociais e continuo. Sempre definimos prazos claros no inicio. Tem alguma data limite em mente?';
  }

  if (/rede.?social|instagram|facebook|tiktok|linkedin|seguidor|conta|perfil|post|content/.test(msg)) {
    return 'Gestao de redes sociais e um dos nossos pontos fortes. Criamos estrategia personalizada, producao de conteudo (posts, stories, reels), gestao de comunidade, analise de metricas e relatorios mensais. Trabalhamos com Instagram, Facebook, TikTok e LinkedIn. Quer saber mais sobre a nossa estrategia?';
  }

  if (/website|site|loja.?online|e.?commerce|app|aplicacao|desenvolv|landing|pagina/.test(msg)) {
    return 'Desenvolvemos websites modernos e responsivos com Next.js e React, apps mobile com Flutter, lojas online com Shopify, e landing pages de alta conversao. Todos os projectos incluem SEO basico, analytics e hospedagem. Quer que mostre exemplos do nosso trabalho?';
  }

  if (/angola|luanda|local|escritorio|onde|moram|sede|presenca|mercado/.test(msg)) {
    return 'A Mwango Brain tem sede em Luanda, Angola, com 16 anos de presenca no mercado angolano. Conhecemos profundamente o publico angolano e as tendencias locais. Fazemos reunioes presenciais e remotas. Qual e a sua localizacao?';
  }

  if (/sim|claro|ok|com certeza|obvio|entendi|entendido|massa|fixe|legal|gira|porreiro|bora/.test(msg)) {
    const positives = [
      'Brutal! Entao vamos la. O proximo passo e definirmos os detalhes do seu projecto. Quer agendar uma reuniao com a nossa equipa?',
      'Fixe! Vou preparar uma proposta detalhada. Qual e o melhor contacto seu para enviarmos?',
      'Nem mais! Pode enviar-nos os detalhes por aqui e a equipa comeca a trabalhar o mais rapido possivel.',
      'Massa! Quer que facamos um brainstorm juntos ou prefere que apresente uma proposta directamente?',
    ];
    return positives[Math.floor(Math.random() * positives.length)];
  }

  if (/nao|nao quero|nao interessa|recusar|sem interesse|desistir/.test(msg)) {
    return 'Sem problema! Respeito a sua decisao. Se mudar de ideia no futuro, a Mwango Brain estara aqui. Sucesso com tudo!';
  }

  if (/quem (e|és|sao|são)|quem e que|apresenta|fala de ti|nome/.test(msg)) {
    return 'Chamo-me Jesuaine, sou membro da equipa da Mwango Brain. Somos uma agencia criativa e de tecnologia angolana com 16 anos de experiencia, sede em Luanda. O nosso site e mwangobrain.com.';
  }

  if (/como (faz|fazer|posso|usar|funciona|prospect|iniciar|comecar|usar o mba|sistema)/.test(msg)) {
    return 'Para usar o MBA: (1) PROSPECCAO - escolha a plataforma (Instagram/TikTok/Facebook/LinkedIn), defina palavras-chave e localizacao, e clique em Iniciar. O sistema busca perfis reais automaticamente. (2) MENSAGENS - seleccione um perfil e envie uma mensagem personalizada ou use o Agente IA para gerar uma. (3) EXPORTAR - clique em Exportar CSV para baixar os dados. Simples e directo!';
  }

  if (/pagamento|pagar|metodo|transfer|multicaixa|forma/.test(msg)) {
    return 'Aceitamos transferencia bancaria, Multicaixa Express, PayPal e Wise. Facilitamos ao maximo o processo de pagamento. Para projectos maiores, tambem aceitamos pagamentos faseados.';
  }

  if (/obrigad|agradec|valeu|thanks|gracias/.test(msg)) {
    const thanks = [
      'Nao ha de que! Estou sempre a disposicao para o que precisar. Ate logo!',
      'De nada! Foi um prazer ajudar. A Mwango Brain esta sempre disponivel.',
      'Imagina! Qualquer coisa e so chamar. Sucesso!',
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }

  if (/tchau|adeus|ate|bye|fui|xau/.test(msg)) {
    return 'Ate a proxima! A Mwango Brain estara sempre aqui quando precisar. Sucesso com tudo!';
  }

  if (/restaur|food|comida|gastronom/.test(msg)) {
    return 'Trabalhamos com restaurantes em toda Angola: identidade visual completa, websites com menus online e reservas, gestao de redes sociais com fotografias profissionais, e marketing digital direccionado. Temos experiencia com restaurantes de todos os tamanhos. Quer saber mais?';
  }

  if (/musica|musico|artista|kuduro|semba|kizomba|dj|cantor/.test(msg)) {
    return 'Trabalhamos com artistas e musicos angolanos: branding completo, gestao de redes sociais, estrategias de lancamento, producao de conteudo visual para clips, e marketing digital. A Mwango Brain ja ajudou varios artistas a crescer a sua presenca online. Quer conversar sobre o seu projecto?';
  }

  if (/aquisi|compra|vender|perfil|comprar|compra de/.test(msg)) {
    return 'A Mwango Brain esta sempre a procura de perfis com potencial em todas as plataformas. Avaliamos cada perfil com base na audiencia, engagement e autenticidade. Fazemos ofertas justas e transparentes. Quer conversar sobre os termos?';
  }

  if (/marketing|publicidade|anuncio|trafego|ads|facebook ads|google ads/.test(msg)) {
    return 'O nosso servico de marketing digital inclui: gestao de campanhas (Facebook Ads, Google Ads, TikTok Ads), estrategias de crescimento organico, email marketing, e analise de metricas. Tudo mensuravel com relatorios claros. Quer que apresentemos uma estrategia para o seu caso?';
  }

  if (/logo|logotipo|branding|marca|identidade visual/.test(msg)) {
    return 'Branding e identidade visual e uma das nossas especialidades. Criamos logotipos, manuais de marca, papelada, templates para redes sociais, e toda a identidade visual do zero ou renovamos a que ja existe. Quer ver exemplos?';
  }

  if (/seo|google|posicionar|buscar|pesquisa|ranking/.test(msg)) {
    return 'O nosso servico de SEO inclui: auditoria tecnica do site, optimizacao de conteudo, pesquisa de palavras-chave, link building, e monitorizacao de rankings. Os resultados sao mensuraveis e geralmente visiveis em 2-4 meses. Quer uma auditoria gratuita do seu site?';
  }

  if (/hosting|hospedagem|dominio|servidor/.test(msg)) {
    return 'Oferecemos solucoes de hosting e gestao de dominios para todos os projectos que desenvolvemos. Inclui SSL, backups automaticos, monitorizacao 24/7 e suporte tecnico. Tudo incluido no pacote.';
  }

  if (msg.endsWith('?') || /^que|como|quando|onde|quem|qual|porque|pq|por que/.test(msg)) {
    const generic = [
      'Boa pergunta! Para lhe responder da melhor forma, precisava de mais detalhes. Pode dar-me mais contexto sobre o que precisa?',
      'Essa questao e interessante! A Mwango Brain pode ajudar com isso. Quer que analise o seu caso especificamente?',
      'Para lhe dar a resposta mais precisa, gostava de saber mais sobre o seu projecto. Pode partilhar mais detalhes?',
      'Interessante! Posso ajudar com isso. O melhor e conversarmos sobre os detalhes. Quer agendar uma chamada ou continuar por aqui?',
    ];
    return generic[Math.floor(Math.random() * generic.length)];
  }

  const defaults = [
    'Obrigado pela mensagem! A Mwango Brain esta disponivel para ajudar. Ha algo especifico em que possa ser util?',
    'Compreendido! A nossa equipa vai analisar isso. Quer saber mais sobre os nossos servicos?',
    'Notado! A Mwango Brain tem solucoes personalizadas para cada situacao. Quer conversar sobre o seu projecto?',
    'Fixe! Vou registar isso. Quer explorar alguma das nossas solucoes enquanto isso?',
    'Entendido! A Mwango Brain vai dar-lhe a atencao que merece. Tem mais alguma questao?',
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

export async function POST(request: Request) {
  try {
    const { profileId, message, conversationHistory } = await request.json();

    const profile = profileId ? await db.profile.findUnique({ where: { id: profileId } }) : null;

    // Build context for AI
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
        const systemMsg = `${PORTUGUESE_PERSONA}\n\n${contextParts.length > 0 ? 'CONTEXTO ACTUAL:\n' + contextParts.join('\n') + '\n' : ''}Responde sempre de forma natural e relevante. Se a pessoa faz uma pergunta geral, responde como membro da equipa. Se e sobre um perfil especifico, adapta a resposta ao contexto desse perfil.`;

        const messages: any[] = [
          { role: 'system', content: systemMsg },
        ];

        // Add conversation history with proper role mapping
        if (conversationHistory?.length > 0) {
          for (const msg of conversationHistory.slice(-10)) {
            messages.push({
              role: msg.direction === 'inbound' ? 'user' : 'assistant',
              content: msg.content,
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
        } else {
          const errData = await response.text();
          console.error('OpenRouter API error:', response.status, errData.substring(0, 200));
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

    // Clean up any AI artifacts
    reply = reply.replace(/^\*+[^*]+\*+\s*/g, '').trim();

    // Save to DB
    if (profileId) {
      await db.message.create({ data: { profileId, campaignId: profile?.campaignId || '', direction: 'inbound', content: message } });
      await db.message.create({ data: { profileId, campaignId: profile?.campaignId || '', direction: 'outbound', content: reply } });
      await db.profile.update({ where: { id: profileId }, data: { repliedAt: new Date(), status: 'replied' } });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Respond error:', error);
    const fallbackReply = generateSmartReply(message || '');
    return NextResponse.json({ reply: fallbackReply });
  }
}
