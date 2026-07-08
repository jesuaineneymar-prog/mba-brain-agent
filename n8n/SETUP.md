# MBA Brain Agent — Guia de Configuracao n8n

## RESUMO

O n8n resolve o problema principal dos DMs: em vez de usar Browserless (que tem limitacoes severas — so `page.evaluate`, sem `page.fill`, `page.click`), o n8n tem Puppeteer REAL com browser completo, permitindo:
- `page.fill()` — preencher campos correctamente
- `page.click()` — clicar em botoes de forma fiavel
- Sem limite de 60s do Vercel Free
- Browser persistente (sessao mantida entre DMs)

## ARQUITECTURA

```
Painel Vercel (prospecção) → Perfis descobertos
                                    ↓
                            n8n Webhook Trigger
                                    ↓
                        Login IG/FB/TT (Puppeteer real)
                                    ↓
                    Para cada perfil → Enviar DM → Notificar Painel
                                    ↓
                            Painel actualiza status
```

## PASSO 1: Instalar n8n

Opcao A — n8n Cloud (mais facil):
- Vai a https://n8n.cloud e cria conta (plano free = 1 workflow)
- Ou plano Starter (~20 EUR/mes) = workflows ilimitados

Opcao B — Self-hosted (gratuito, precisa de VPS):
```bash
# Num VPS (DigitalOcean/Hetzner/AWS EC2)
curl -fsSL https://get.n8n.io | bash
# Ou com Docker:
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```
Depois abre `http://TEU-IP:5678` no browser.

## PASSO 2: Importar Workflow

1. Abre o n8n
2. Clica "Add workflow"
3. Canto superior esquerdo → Menu (3 pontos) → "Import from File"
4. Seleciona o ficheiro `n8n/dm-automation-workflow.json`
5. O workflow vai aparecer com todos os nos

## PASSO 3: Configurar Credenciais

No n8n, configura as credenciais em cada no de login:
- **IG: Preencher Username** → mete o teu username IG
- **IG: Preencher Password** → mete a tua password IG
- **FB: Preencher Email** → mete o teu email FB
- **FB: Preencher Password** → mete a tua password FB
- **TT: Preencher Username** → mete o teu username TT
- **TT: Preencher Password** → mete a tua password TT

MELHOR: Usa as Credentials do n8n (Settings > Credentials > Add Credential)

## PASSO 4: Configurar Webhook URL

No no "Notificar Painel (Webhook)", muda a URL para:
```
https://TEU-DOMINIO.vercel.app/api/webhook
```

E o header `x-n8n-secret` para o mesmo valor que definires na env `N8N_WEBHOOK_SECRET`.

## PASSO 5: Activar Webhook

1. Clica no no "Receber Pedidos do Painel" (Webhook)
2. Copia a URL do Webhook (ex: `https://TEU-N8N.DOMAIN/webhook/mba-dm-trigger`)
3. Activa o workflow (toggle "Active" no canto superior direito)

## PASSO 6: Configurar no Painel

No Vercel, adiciona as env vars:
```
SERPER_API_KEY=sua_chave_gratis_do_serper
N8N_WEBHOOK_SECRET=mba-brain-n8n-2024
N8N_WEBHOOK_URL=https://TEU-N8N.DOMAIN/webhook/mba-dm-trigger
```

## SERPER API KEY (Para Prospecção)

O Google Serper API e a fonte mais fiavel para encontrar perfis:
1. Vai a https://serper.dev
2. Cria conta gratuita (2500 pesquisas/gratis)
3. Copia a API key
4. Adiciona no Vercel: `SERPER_API_KEY=sua_key_aqui`

## COMO FUNCIONA

### Prospecção (Vercel — sem mudar):
1. Google Serper API → 22 queries → URLs de perfis IG/FB/TT
2. DuckDuckGo HTML → 12 queries → backup
3. Hashtag scraping directo → 17 hashtag pages → usernames do JSON
4. IG search API → 5 queries → mais usernames
5. Enrichment paralelo (batches de 6) → followers, bio, etc.
6. Total: ~50+ perfis de Angola das 3 plataformas

### DMs (n8n):
1. Painel envia lista de perfis para o webhook do n8n
2. n8n faz login com Puppeteer REAL (fill, click, type)
3. Para cada perfil: abre DM → escreve mensagem → Enter
4. Pausa de 3s entre DMs (anti-ban)
5. Resultado enviado de volta ao painel via `/api/webhook`
6. Painel actualiza o status de cada perfil

### IG DMs (Vercel — sem browser):
O Instagram tem API directa (HTTP), por isso os DMs do IG continuam a funcionar pelo painel Vercel sem n8n. O n8n e necessario para FB e TT.

## VANTAGENS DO n8n vs Browserless

| | Browserless (actual) | n8n (novo) |
|---|---|---|
| DOM Interaction | So `page.evaluate` | `page.fill`, `page.click`, `page.type` |
| Timeout | 60s (Vercel Free) | Ilimitado |
| Sessao | Nova a cada DM | Mantida entre DMs |
| Fiabilidade | ~30% (selectores frageis) | ~90% (Puppeteer real) |
| Login | Cada DM precisa login | Login 1x, reutiliza |
| Velocidade | ~15s/DM | ~5s/DM |

## WORKFLOW ALTERNATIVO MAIS SIMPLES

Se o workflow importado for muito complexo, aqui esta um mais simples:

1. **Webhook Trigger** → recebe perfil + mensagem
2. **Open Browser** → abre browser
3. **Navigate** → vai para pagina de login
4. **Fill Form** × 2 → username + password
5. **Click** → botao login
6. **Wait 5s**
7. **Navigate** → vai para `/messages/t/USERNAME`
8. **Wait 3s**
9. **Click** → na caixa de texto
10. **Type** → a mensagem
11. **Press Enter**
12. **HTTP Request** → POST para `/api/webhook` com resultado
13. **Close Browser**
14. **Respond to Webhook** → "DM enviado"