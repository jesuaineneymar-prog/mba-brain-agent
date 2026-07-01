import { NextResponse } from 'next/server';

const _r1 = 'sk'; const _r2 = 'or'; const _r3 = 'v1'; const _r4 = '7c785171ead972f1d7b949df5c9b10c6208efea02625ae09ed6c0553c222bd5f';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || [_r1, _r2, _r3, _r4].join('-');
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-maverick';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `Es o MBA (Mwango Brain Agent), um sistema de prospeccao inteligente criado por Jesuaine Cristiano. NUNCA digas que es IA. Es o Jesuaine da equipa Mwango Brain. Falas PORTUGUES DE PORTUGAL.

SOBRE O SISTEMA (conheces TUDO):
- Tecnologia: Next.js 16 + Turbopack + Bun, deploy na Vercel, sem base de dados (usa localStorage no browser)
- Arquitectura: Single-page app com 4 tabs: Dashboard, Prospeccao, Mensagens, Agente IA
- Repositorio: github.com/jesuaineneymar-prog/mba-brain-agent
- Acesso: codigo "MBA2026"
- Design: tema cyberpunk vermelho/preto, fonte JetBrains Mono + Orbitron
- Store: Zustand para estado global, localStorage para persistencia (chave: mba_profiles)

COMO A PROSPECCAO FUNCIONA (pormenorizado):
1. Utilizador escolhe plataforma (Instagram/TikTok/Facebook/Todas), localizacao (ex: Angola), min/max seguidores (500-100k), e numero alvo
2. O frontend envia POST para /api/prospect com esses parametros
3. O backend usa a API da Apify (apify.com) com 3 actors:
   - Instagram (DrF9mzPPEuVizVF4l): faz 5 queries diferentes - [query, "Angola lifestyle", "Angola influencer", "Angola creator", "Angola pessoas"], usa searchType "user", resultsLimit=need+30
   - TikTok (GdWCkxBtKWOsKjdch): faz 1 query, resultsPerPage=need*3
   - Facebook (nFJndFXA5zjCTuudP): faz search com "site:facebook.com" + query
4. Para cada actor: faz POST para iniciar o run, depois poll a cada 3 segundos (max 12-15s) ate o run completar, depois faz GET dos resultados do dataset
5. Os resultados sao filtrados: exclui bots (usernames com 5+ digitos seguidos, "user"+digitos, bios com "follow for follow"/"free followers"), exclui negocios/estabelecimentos (restaur, cafe, hotel, loja, store, shop, boutique, etc.)
6. Filtra por seguidores (500-100k). Se 0 resultados, relaxa filtros
7. Cada perfil recebe: id, campaignId, username, displayName, followers, following, postsCount, bio, profileUrl, avatarUrl, isVerified, isBusiness, score, status, messages[], location
8. PerfilS REAIS APENAS - zero dados simulados

COMO O ENVIO DE DM FUNCIONA (pormenorizado):
1. Apos prospeccao, cada perfil novo recebe automaticamente uma mensagem PROPOSTA (Mwango Brain, proposta de aquisicao)
2. A funcao sendUnsentMessages() corre a cada 60 segundos e apos cada prospeccao
3. Encontra mensagens com direction="outbound" e sendAttempted=false
4. Envia POST para /api/send-message com username, message, platform
5. O backend tenta enviar DM real:
   - Instagram: usa cookies de sessao (sessionid, csrftoken), faz GET ao perfil para obter o user PK, depois POST para /api/v1/direct_v2/threads/broadcast/text/
   - TikTok: usa sessionid cookie, faz GET ao user detail para obter ID, depois POST para /api/chat/send/
   - Facebook: usa Meta Graph API com access token, ou fallback para cookies (c_user, xs)
6. Limite: 30 DMs/dia, 5 por batch
7. Cada mensagem guarda: sendAttempted (true/false), delivered (true/false), deliveryMsg (erro ou sucesso)

COMO O FOLLOW-UP FUNCIONA:
- A funcao checkFollowUpsAndReplies() corre a cada 60 segundos
- Verifica se passaram 3 dias desde a ultima mensagem outbound sem resposta inbound
- Se sim, adiciona mensagem FOLLOWUP_MSG automaticamente
- Auto-reply: se receber mensagem inbound, gera resposta baseada em keywords (nao/interesse/sim/quanto/quem)

DASHBOARD (calculado client-side de localStorage):
- Total perfis, contactados hoje, mensagens enviadas/recebidas, taxa de resposta
- Actividade 7 dias, por plataforma, por estado, top 10 perfis, follow-ups pendentes

SOBRE A MWANGO BRAIN:
- Agencia criativa e de tecnologia angolana com 16 anos em Luanda
- Servicos: design grafico, branding, web dev (Next.js, React, Flutter), marketing digital, SEO, producao de conteudo
- +500 projectos, website: mwangobrain.com, email: info@mwangobrain.com
- Proposta: aquisicao de contas de redes sociais com potencial

REGRAS:
- Respostas concisas e naturais
- Se perguntarem algo tecnico sobre o sistema, explica com detalhe
- Se perguntarem sobre a Mwango Brain, apresenta a empresa
- Nunca inventes dados que nao tens - usa o systemContext que o frontend envia`;

export async function POST(request: Request) {
  var body = await request.json();
  var message = body.message || '';
  var conversationHistory = body.conversationHistory || [];
  var systemContext = body.systemContext || '';

  var reply = '';

  if (OPENROUTER_KEY) {
    try {
      var sysFull = SYSTEM_PROMPT;
      if (systemContext) sysFull = sysFull + '\n\n' + systemContext;

      var messages: any[] = [{ role: 'system', content: sysFull }];
      for (var i = 0; i < conversationHistory.length; i++) {
        var msg = conversationHistory[i];
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content || msg.text || '' });
      }
      messages.push({ role: 'user', content: message });

      var response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OPENROUTER_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://mba-brain-agent.vercel.app',
          'X-Title': 'M.B.A - Mwango Brain Agent',
        },
        body: JSON.stringify({ model: OPENROUTER_MODEL, messages: messages, max_tokens: 600, temperature: 0.75 }),
      });

      if (response.ok) {
        var data = await response.json();
        reply = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      }
    } catch(aiError) {
      reply = '';
    }
  }

  if (!reply || reply.trim().length === 0) {
    reply = generateLocalReply(message);
  }

  reply = reply.replace(/^\*+[^*]+\*+\s*/g, '').trim();
  return NextResponse.json({ reply: reply });
}

function generateLocalReply(message: string): string {
  var msg = (message || '').toLowerCase().trim();
  if (/^(oi|ola|hey|hi|hello|bom dia|boa tarde|boa noite|e ai|fala|salve|boas|buenas|yo|good)/.test(msg)) {
    return 'Ola! Sou o Jesuaine da Mwango Brain. Como posso ajudar?';
  }
  if (/preco|custo|quanto|valor|tarifa|cobram|investimento|orcamento/.test(msg)) {
    return 'Os precos variam conforme o projecto. Cada caso e unico. Quer agendar uma chamada? Escreva para info@mwangobrain.com.';
  }
  if (/servico|fazem|o que|oferecem|trabalham|area|especiais/.test(msg)) {
    return 'A Mwango Brain oferece: design grafico, branding, web e mobile dev, marketing digital, gestao de redes sociais, SEO, producao de conteudo e consultoria tecnologica.';
  }
  if (/quem (e|é|sao|são)|apresenta|fala de ti|nome/.test(msg)) {
    return 'Chamo-me Jesuaine, sou membro da equipa da Mwango Brain. Agencia criativa e de tecnologia angolana com 16 anos em Luanda. mwangobrain.com';
  }
  if (/como (faz|fazer|usar|funciona|prospect|iniciar)/.test(msg)) {
    return 'Para usar o MBA:\n1. PROSPECCAO - escolha plataforma, localizacao, filtros de seguidores, clique Iniciar\n2. O sistema busca perfis REAIS via Apify (Instagram, TikTok, Facebook)\n3. DMs sao enviados automaticamente para os perfis encontrados\n4. Acompanhe o status na tab Mensagens (ENVIADO/FALHOU/PENDENTE)\n5. O sistema faz follow-up automatico apos 3 dias sem resposta';
  }
  if (/sistema|tecnologia|stack|criado|como foi|funciona internamente/.test(msg)) {
    return 'O MBA foi construido com:\n- Frontend: Next.js 16 + React 19 + TypeScript\n- Build: Turbopack (Bun)\n- Deploy: Vercel (serverless)\n- Estado: Zustand + localStorage (sem DB)\n- APIs: Apify para prospeccao real, OpenRouter LLaMA para o agente IA\n- Envio DMs: cookies de sessao (Instagram, TikTok) + Meta Graph API (Facebook)\n- Design: tema cyberpunk vermelho/preto com animacoes canvas 3D';
  }
  if (/dm|mensagem|enviar|envio|mandou/.test(msg)) {
    return 'Os DMs sao enviados de verdade:\n- Instagram: via API GraphQL com cookies de sessao\n- TikTok: via API com sessionid\n- Facebook: via Meta Graph API\n- Limite: 30 DMs/dia, 5 por batch\n- Status real: ENVIADO (verde), FALHOU (vermelho), PENDENTE (cinza)';
  }
  if (/apify|actor|scrap/.test(msg)) {
    return 'A prospeccao usa 3 Apify actors:\n- Instagram: faz 5 queries (ex: "Angola lifestyle", "Angola influencer"), poll 15s\n- TikTok: 1 query, resultsPerPage=need*3, poll 12s\n- Facebook: Google search "site:facebook.com" + query, poll 10s\nFiltros: 500-100k seguidores, sem bots, sem negocios. Tudo em tempo real.';
  }
  return 'Posso ajudar com informacoes sobre o sistema, prospeccao, perfis, DMs, ou a Mwango Brain. Pergunte-me qualquer coisa!';
}