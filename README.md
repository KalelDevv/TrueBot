# TrueBot — Bot de Discord com IA (grátis) — Gemini + Railway

## O que o TrueBot faz
- Responde quando é **mencionado** (`@TrueBot`) — só isso já dispara a resposta.
- Se a menção acontece dentro de uma **resposta (reply)** a outra mensagem, o bot busca o conteúdo dessa mensagem original e usa como contexto pra responder de forma coerente.
- Só responde a quem tiver um dos **cargos permitidos** (configurado nas variáveis `ALLOWED_ROLE_ID_1` a `5`).
- Só responde **dentro do canal onde ele tem permissão** de ver e enviar mensagem. Não existe lista de "canal proibido" no código — é 100% controlado pelas permissões do Discord. Se você tirar a permissão do cargo do bot num canal (Ver Canal / Enviar Mensagens), ele para de responder ali automaticamente.
- Trava extra: só funciona dentro do servidor configurado em `GUILD_ID`.

---

## Passo 1 — Discord Developer Portal
1. Acesse https://discord.com/developers/applications e abra a aplicação do TrueBot.
2. Vá em **Bot** (menu lateral).
3. Em **Privileged Gateway Intents**, ative:
   - **Message Content Intent** (obrigatório, sem isso o bot não lê o texto das mensagens)
   - **Server Members Intent** (necessário pra checar os cargos de quem manda mensagem)
4. Clique em **Reset Token** e copie o token — ele vai na variável `DISCORD_TOKEN`.

## Passo 2 — Permissões nos canais
Como não tem mais lista de canal bloqueado no código, é você quem controla tudo direto no Discord:
- Nos canais onde o TrueBot **pode** responder: dê a ele permissão de **Ver Canal** e **Enviar Mensagens** (cargo do bot).
- Nos canais errados: tire essas duas permissões do cargo dele. Pronto, ele nem processa mensagem lá.

## Passo 3 — Chave da IA (Gemini, grátis)
1. Acesse https://aistudio.google.com/apikey
2. Faça login com uma conta Google normal (não precisa de cartão nem verificação extra).
3. Clique em **Create API Key** e copie — ela vai na variável `GEMINI_API_KEY`.

## Passo 4 — Subir pro GitHub
No terminal, dentro da pasta `TrueBot`:
```bash
git init
git add .
git commit -m "primeiro commit do TrueBot"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/TrueBot.git
git push -u origin main
```
(Crie o repositório vazio antes em https://github.com/new com o nome **TrueBot** — não coloque README pra não dar conflito.)

## Passo 5 — Conectar no Railway
1. No seu projeto Railway, clique em **New** → **GitHub Repo** → selecione o repositório **TrueBot**.
2. O Railway detecta automaticamente que é Node.js.
3. Vá em **Variables** e adicione (copiando do `.env.example`):
   - `DISCORD_TOKEN` → seu token
   - `GEMINI_API_KEY` → sua chave
   - `GEMINI_MODEL` → `gemini-2.0-flash` (opcional, já é o padrão)
   - `GUILD_ID` → `1346487110634438800` (já deixei preenchido)
   - `ALLOWED_ROLE_ID_1` → `1536124317858013234` (já deixei preenchido)
   - `ALLOWED_ROLE_ID_2` a `ALLOWED_ROLE_ID_5` → deixe em branco por enquanto, preenche quando quiser liberar outro cargo
4. Confirme que o **Start Command** é `npm start` (padrão do `package.json`, geralmente nem precisa mexer).
5. Deploy automático! A cada `git push` pro GitHub, o Railway atualiza o bot sozinho.

**Resumindo: como você já tem as chaves, é só colar `DISCORD_TOKEN` e `GEMINI_API_KEY` no Railway — o resto (cargo permitido e servidor) já vai pronto.**

---

## Testando
No Discord, com um cargo permitido, mencione o bot em um canal onde ele tem permissão:
> @TrueBot nossa hoje tá muito calor

Ou responda a mensagem de alguém e mencione o bot perguntando o que ele acha — ele vai puxar o conteúdo da mensagem original como contexto.

## Ajustando a personalidade
No `index.js`, edite a constante `SYSTEM_PROMPT` pra mudar como o bot fala, o tom, se ele deve usar gírias, etc.

## Adicionando mais cargos no futuro
Só preencher `ALLOWED_ROLE_ID_2`, `ALLOWED_ROLE_ID_3`, etc. nas Variables do Railway com o ID do cargo novo — não precisa mexer no código nem redeploy manual, o Railway reinicia sozinho quando você salva a variável.
