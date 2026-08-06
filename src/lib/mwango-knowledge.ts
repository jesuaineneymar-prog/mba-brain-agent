export var MWANGO_KNOWLEDGE = `
SOBRE A MWANGO BRAIN:
- Empresa angolana de tecnologia e criatividade (Creative & Technology Agency)
- Slogan: "Let's Brain together"
- Mais de 16 anos de experiencia no mercado
- Parceira de confianca de mais de 100 entidades publicas e privadas
- Site: https://mwangobrain.com
- Alternativas do nome: MB, Mwango Brain, MwangoBrain

REDES SOCIAIS DA MWANGO BRAIN:
- Facebook: https://www.facebook.com/MwangoBrain
- Instagram: https://www.instagram.com/mwangobrain
- LinkedIn: https://www.linkedin.com/company/mwango-brain
- YouTube: https://www.youtube.com/@mwangobrain4450

SERVICOS PRINCIPAIS:
- Desenvolvimento de Sistemas Web (personalizados, escalaveis, alta performance)
- Analise e Insights de Dados (conversao de dados em insights estrategicos, relatorios, modelagem)
- Analise e Optimizacao de Sistemas (avaliacao, melhoria de eficiencia)
- Desenvolvimento de Apps Mobile (Android e iOS)
- Desenvolvimento de Websites (sites modernos, portais web)
- Marketing Digital (estrategias personalizadas para alcancar publico-alvo)
- Design Grafico (solucoes criativas para construir marcas fortes)
- Estrategia de Social Media
- Servicos de SEO
- Fornecimento de equipamentos
- Comunicacao e marketing completo

SOLUCOES:
- Gestao de Dados (implementacao de sistemas de gestao de dados)
- Sistemas M&E (Monitoria e Avaliacao, visibilidade em tempo real sobre desempenho)
- Dashboards (visualizacao de dados em tempo real)
- ERP (sistema para unificar e automatizar processos internos)
- Intranet (comunicacao interna, colaboracao, partilha de conhecimento)

PROJECTOS REALIZADOS:
- PDAC (Plano de Desenvolvimento de Angola Cabinda)
- DIVERSIFICA+ (projeto de diversificacao economica)
- FDCA (Fundacao para o Desenvolvimento de Cabinda)
- MOSAP3 (Multi-Sectoral HIV/AIDS Project Phase 3)
- INTRANET (sistema de intranet)
- ERP (sistema de planeamento de recursos empresariais)
- INAPEM (Instituto Nacional de Apoio as Pequenas e Medias Empresas)
- Njila (plataforma digital)
- PAFAR (Programa de Apoio a Familias Angolanas Rurais)
- DHL (servicos para DHL Angola)
- Provedoria da Justica (sistema para Provedoria da Justica de Angola)

VISAO: Ser referencia em solucoes digitais inovadoras, impulsionando o crescimento sustentavel e a transformacao digital dos clientes.
MISSAO: Oferecer solucoes digitais personalizadas e eficazes, que transformem negocios e impulsionem resultados.

VALORES:
- Inovacao continua
- Abordagem centrada no cliente (cada solucao e personalizada)
- Expertise local com alcance global
- Uniao de criatividade e estrategia digital

LOCALIZACAO: Angola (Luanda). Empresa angolana com foco no mercado local e alcance global.
FUNDADA: Ha aproximadamente 16 anos (aprox. 2008-2010).

---

SOBRE O SISTEMA MBA BRAIN AGENT (este sistema):

O MBA Brain Agent e um sistema interno de prospeccao inteligente desenvolvido pela Mwango Brain. NAO envia mensagens directas (DMs). Serve apenas para encontrar e analisar perfis de potenciais clientes/influenciadores.

FUNCIONALIDADES:
1. DASHBOARD: Painel geral com metricas de perfis guardados, seguidores medios, breakdown por plataforma, localizacao e status.
2. PROSPECCAO: Ferramenta de busca automatica de perfis no Instagram e Facebook com foco em Angola.
3. AGENTE IA: Chatbot inteligente que responde perguntas sobre o sistema e a empresa.

COMO A PROSPECCAO FUNCIONA:
- Usa APIs externas para encontrar perfis relevantes:
  * ScrapingAnt (https://app.scrapingant.com) - para scraping de paginas web
  * Serper (https://serper.dev) - para busca no Google
  * DuckDuckGo - como busca alternativa
- Faz buscas por termos relacionados com Angola (angola, luanda, benguela, cabinda, huambo, kizomba, etc.)
- Filtra perfis com 500 a 100.000 seguidores
- Prioriza perfis angolanos
- Faz enriquecimento de perfis (busca dados adicionais como seguidores, bio, avatar)
- Calcula score de relevancia baseado em palavras-chave angolanas/lusofonas
- Suporta Instagram e Facebook (e a opcao "Todas" para ambos simultaneamente)
- Perfis encontrados sao guardados em localStorage do browser
- Sistema de deduplicacao: perfis que ja apareceram nunca mais aparecem
- Opcao de exportar perfis para CSV
- A prospeccao continua a correr em background mesmo ao mudar de aba

ARQUITECTURA TECNICA:
- Frontend: Next.js 15.3.9, React, Tailwind CSS
- Estado: Zustand (store de gerenciamento de estado)
- UI: Componentes personalizados com tema escuro vermelho (cores: #C0001C, #FF1A3C)
- Autenticacao: Codigo de acesso local (MBA2026)
- Dados: Guardados em localStorage do navegador (perfis, cookies, sessoes)
- API Routes: /api/prospect (prospeccao), /api/respond (agente IA), /api/scrape (scraping)
- Deploy: Vercel (https://mba-brain-agent-jesuaineneymar-3622s-projects.vercel.app)
- Repositorio: GitHub (jesuaineneymar-prog/mba-brain-agent)

CONFIGURACAO DE COOKIES:
- Existe uma pagina /setup-cookies para configurar cookies do Instagram e Facebook
- Os cookies sao usados para validar credenciais das plataformas

PLANOS FUTUROS DO SISTEMA:
- Envio automatizado de DMs (quando cookies estiverem configurados)
- Mais plataformas de prospeccao
- Analise mais profunda de perfis
- Campanhas de marketing automatizadas
`;
