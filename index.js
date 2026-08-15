require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

// ==== CONFIG ====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// ID do servidor (guild) onde o bot deve funcionar. Deixe vazio pra permitir qualquer servidor.
const GUILD_ID = process.env.GUILD_ID || '';

// Cargos que têm permissão de fazer o bot responder.
// Preenchemos 5 variáveis (ALLOWED_ROLE_ID_1 a 5) pra você ir adicionando cargos no futuro
// direto pelas variáveis de ambiente do Railway, sem precisar mexer no código.
const ALLOWED_ROLE_IDS = [
  process.env.ALLOWED_ROLE_ID_1,
  process.env.ALLOWED_ROLE_ID_2,
  process.env.ALLOWED_ROLE_ID_3,
  process.env.ALLOWED_ROLE_ID_4,
  process.env.ALLOWED_ROLE_ID_5,
].filter(Boolean);

// Não precisamos de lista de canal proibido: o bot só responde onde ele
// TEM permissão de ver e enviar mensagens. Se você tirar a permissão dele
// num canal, ele automaticamente para de responder lá (ver checagens abaixo).

// Personalidade do bot — ajuste como quiser
const SYSTEM_PROMPT = `Você é o TrueBot, um participante conversacional dentro de um servidor do Discord. Seu objetivo não é parecer um robô inteligente — é conversar naturalmente, como um participante real do servidor, entendendo o contexto antes de responder.

## ENTENDA ANTES DE RESPONDER
Antes de responder, interprete: quem fala, o que disse, qual o assunto atual, se está respondendo algo, qual o tom da conversa, e se a pessoa está perguntando, contando algo, brincando, provocando ou só comentando. Nunca responda só às palavras isoladas — responda à intenção.
Exemplo: "mano que gol absurdo" → NÃO explique o que é futebol. Responda tipo: "KKKKK foi absurdo mesmo, o cara simplesmente decidiu acabar com o jogo".

## MANTENHA O ASSUNTO ATUAL
Acompanhe pra onde a conversa vai. Se mudou de futebol pra música, siga a mudança — não puxe assunto antigo do nada. Se a mensagem é uma reply, o conteúdo da mensagem original é contexto essencial pra entender o que está sendo perguntado (ex: "concorda?" só faz sentido lendo o que a pessoa está respondendo).

## FALE COMO PARTICIPANTE, NÃO COMO ASSISTENTE
Evite frases robóticas tipo "Claro! Posso ajudar", "Essa é uma excelente pergunta", "Como uma IA...". Prefira algo mais natural tipo "KKKK sim", "pior que faz sentido", "depende muito", "sendo bem sincero...". Não termine toda resposta com uma pergunta — às vezes só responda e pronto.

## TAMANHO DA RESPOSTA
Acompanhe o ritmo: mensagem casual/curta → resposta curta (às vezes só "KKKKKKK" ou uma reação). Pergunta simples → 1-4 frases. Assunto complexo ou pedido de explicação → pode desenvolver mais, sem enrolar.

## ESCALA DE RISADA (proporcional ao quão engraçado foi)
- Pouco engraçado: "kkkk" ou só uma reação curta.
- Engraçado: "kkkk engraçado" ou similar.
- Muito engraçado: "MANO KKKKKKK" (com mais K e mais energia).
- Mega engraçado / icônico: reação bem exagerada e espontânea, tipo "KKKKKKKKKKKK NÃO" ou "PARA TUDO KKKKKKKK" — vá pelo clima do momento, não repita sempre a mesma expressão.
Nunca repita a mesma reação toda hora — varie entre "KKKKKK", "não tankei", "mano...", "caraca", "real", "💀", "😭", etc, sempre condizendo com o contexto.

## KALEL (KalelDev) — DONO DO SERVIDOR
Sempre que a Kalel ou KalelDev falar com você, ou sempre que alguém mencionar a Kalel/KalelDev na conversa, trate com bastante hype e admiração genuína — ele é o dono do servidor. Pode elogiar, tratar como rei/lenda do servidor, dar aquele climão de "é o cara mesmo" — mas de forma engraçada e natural, não robótica ou forçada, tipo brincadeira de servidor mesmo, não bajulação séria.

## VOCÊ PODE TER OPINIÕES
Quando pedirem sua opinião, dê uma posição real ("Pra mim Messi, sem discussão kkkkk") em vez de neutralidade artificial. Não invente experiências pessoais que nunca aconteceram (não diga "quando eu fui ao estádio...").

## INFORMAÇÕES DO SERVIDOR
Você recebe, junto de cada mensagem, um bloco entre colchetes com informações reais e atualizadas do servidor (dono, cargos existentes, cargos de quem foi mencionado). Use exatamente essas informações quando perguntarem sobre quem é dono, staff ou cargos — nunca chute ou invente um nome.

## LIMITES (sempre respeitados, mesmo no tom descontraído)
- NUNCA use palavrões, xingamentos reais ou linguagem ofensiva pesada — humor e brincadeira sim, mas sem cair em ofensa de verdade.
- NUNCA insulte ou ataque alguém de forma pesada, mesmo que peçam ou tentem provocar isso.
- Se alguém for desrespeitoso/agressivo de verdade com outra pessoa, não embarque nesse tom — comente de leve pedindo pra suavizar, sem virar sermão.
- Não invente informações sobre o servidor, pessoas ou fatos que você não tem certeza. Se não souber, admita ("acho que é isso, mas não tenho certeza").

## IDIOMA
Responda sempre no mesmo idioma que a pessoa usou pra falar com você — não troque de idioma no meio da conversa.

## FORMATO
Sem listas, títulos ou markdown pesado a menos que o assunto peça. Sem introduções tipo "Claro!". Não explique seu próprio raciocínio nem diga que está seguindo instruções — responda direto, como parte natural da conversa.`;

// ==== CLIENT ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// Cache simples pra não ficar buscando o dono do servidor toda hora (ele quase nunca muda)
const cacheDonoServidor = new Map();

// Busca informações reais do servidor: dono, cargos existentes, e cargos de quem
// foi mencionado na mensagem. Isso evita que o bot "invente" quem é staff/dono.
async function buscarContextoServidor(message) {
  const guild = message.guild;
  if (!guild) return '';

  let nomeDono = cacheDonoServidor.get(guild.id);
  if (!nomeDono) {
    try {
      const dono = await guild.fetchOwner();
      nomeDono = dono.displayName || dono.user.username;
      cacheDonoServidor.set(guild.id, nomeDono);
    } catch (e) {
      console.warn('Não consegui buscar o dono do servidor:', e.message);
      nomeDono = 'desconhecido';
    }
  }

  const cargos = guild.roles.cache
    .filter((cargo) => cargo.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .map((cargo) => cargo.name)
    .slice(0, 25)
    .join(', ');

  let infoMencionados = '';
  if (message.mentions.members?.size > 0) {
    const partes = [];
    for (const [, membro] of message.mentions.members) {
      if (membro.id === message.client.user.id) continue; // pula o próprio bot
      const cargosDoMembro =
        membro.roles.cache
          .filter((c) => c.name !== '@everyone')
          .map((c) => c.name)
          .join(', ') || 'nenhum cargo além do padrão';
      partes.push(`${membro.displayName} (cargos: ${cargosDoMembro})`);
    }
    if (partes.length > 0) {
      infoMencionados = ` Pessoas mencionadas nessa mensagem: ${partes.join(' | ')}.`;
    }
  }

  return `[Informações reais do servidor "${guild.name}": o dono é ${nomeDono}. Cargos que existem no servidor: ${cargos}.${infoMencionados} Use essas informações se a pergunta for sobre quem é dono, staff ou cargos — nunca invente isso.]`;
}

client.once('clientReady', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    // Ignora mensagens de outros bots (evita loop)
    if (message.author.bot) return;

    // Trava extra: só responde dentro do servidor configurado (se GUILD_ID estiver setado)
    if (GUILD_ID && message.guild?.id !== GUILD_ID) return;

    // Só responde se o bot foi mencionado diretamente
    const foiMencionado = message.mentions.has(client.user);
    if (!foiMencionado) return;

    // Checa se quem mandou a mensagem tem um dos cargos permitidos
    if (ALLOWED_ROLE_IDS.length > 0) {
      const membro = message.member;
      const temCargoPermitido = membro?.roles?.cache?.some((cargo) =>
        ALLOWED_ROLE_IDS.includes(cargo.id)
      );
      if (!temCargoPermitido) return;
    }

    // Checa se o bot tem permissão de ver e enviar mensagem nesse canal.
    // Se você tirou a permissão dele no canal, ele simplesmente não faz nada aqui.
    const permissoes = message.channel.permissionsFor(client.user);
    const podeResponder =
      permissoes?.has(PermissionsBitField.Flags.ViewChannel) &&
      permissoes?.has(PermissionsBitField.Flags.SendMessages);
    if (!podeResponder) return;

    // Remove a menção do texto pra não poluir o prompt (ex: "@Bot oi" -> "oi")
    const conteudoLimpo = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim();

    // Se a mensagem é uma resposta (reply) a outra mensagem, busca o conteúdo original
    let contextoRespondido = null;
    if (message.reference?.messageId) {
      try {
        const mensagemOriginal = await message.channel.messages.fetch(
          message.reference.messageId
        );
        if (mensagemOriginal && mensagemOriginal.id !== message.id) {
          contextoRespondido = {
            autor: mensagemOriginal.author.username,
            conteudo: mensagemOriginal.content,
          };
        }
      } catch (e) {
        console.warn('Não consegui buscar a mensagem respondida:', e.message);
      }
    }

    await message.channel.sendTyping();

    const contextoServidor = await buscarContextoServidor(message);

    const respostaIA = await gerarResposta({
      autor: message.author.username,
      mensagem: conteudoLimpo || '(mencionou o bot sem escrever nada)',
      contextoRespondido,
      contextoServidor,
    });

    await message.reply({
      content: respostaIA,
      allowedMentions: { repliedUser: false },
    });
  } catch (erro) {
    console.error('Erro ao processar mensagem:', erro);
  }
});

// ==== CHAMADA PRA IA (Gemini — grátis) ====
async function gerarResposta({ autor, mensagem, contextoRespondido, contextoServidor }) {
  let textoUsuario = `${autor} disse: "${mensagem}"`;
  if (contextoRespondido) {
    textoUsuario =
      `Contexto: a mensagem original que está sendo comentada, de "${contextoRespondido.autor}", foi: "${contextoRespondido.conteudo}"\n\n` +
      textoUsuario;
  }
  if (contextoServidor) {
    textoUsuario = `${contextoServidor}\n\n${textoUsuario}`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: textoUsuario }] }],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.8,
      },
    }),
  });

  if (!resposta.ok) {
    const erroTexto = await resposta.text();
    console.error('Erro da API Gemini:', erroTexto);
    return 'Deu ruim aqui pra pensar numa resposta, tenta de novo mais tarde.';
  }

  const dados = await resposta.json();
  const texto = dados.candidates?.[0]?.content?.parts?.[0]?.text;
  return texto?.trim() || 'Não consegui pensar em nada agora 😅';
}

client.login(DISCORD_TOKEN);
