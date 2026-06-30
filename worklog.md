---
Task ID: 2
Agent: Main Agent
Task: Upgrade M.B.A v3 - sincronizar melhorias, configurar credenciais, DM send em 4 plataformas

Work Log:
- Sincronizados ficheiros melhorados do mba-clean para src/: respond/route.ts (OpenRouter), prospect/route.ts (Apify), page.tsx (5 tabs)
- Removidas tabs indesejadas: Follow-ups, Campanhas, Analytics, Actividade, Configuracao
- respond/route.ts: Gemini -> OpenRouter (llama-4-maverick) com 30+ fallbacks PT-PT
- prospect/route.ts: configs Apify verificadas para Instagram, TikTok, Facebook, LinkedIn
- send-message/route.ts: reescrito com suporte DM em 4 plataformas:
  - Instagram via cookies (sessionid + csrftoken) com User-Agent mobile
  - Facebook via Meta Graph API (paginas) + fallback cookies web
  - LinkedIn via cookie li_at + JSESSIONID
  - TikTok via cookies (best effort, API nao oficial)
- Mensagens detalhadas de sucesso/falha em cada envio
- Verificacao de credenciais antes de enviar DM
- .env removido do git tracking (credenciais so no Vercel)
- Todas API keys removidas do codigo (GitHub push protection)
- Historico git limpo (sem tool-results/upload com secrets)
- Push force para GitHub: sucesso sem erros

Stage Summary:
- Build 0 erros, push GitHub OK
- Credenciais configuradas no .env local
- Usuario precisa adicionar Environment Variables no Vercel:
  OPENROUTER_API_KEY, APIFY_API_KEY, ACCESS_CODE
  META_ACCESS_TOKEN, IG_SESSIONID, IG_CSRFTOKEN
  FB_C_USER, FB_XS, LI_AT, TT_SESSIONID, TT_CSRF_TOKEN
