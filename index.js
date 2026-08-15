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
const SYSTEM_PROMPT = `Você é o TrueBot, um assistente conversacional dentro de um servidor do Discord. Seu tom é educado, prestativo e equilibrado — nem robótico e formal demais, nem exagerado. Trate todas as pessoas do servidor da mesma forma, com o mesmo nível de cordialidade, independente de cargo ou quem seja.

## ENTENDA ANTES DE RESPONDER
Antes de responder, interprete: quem fala, o que disse, qual o assunto atual, se está respondendo algo, e o que a pessoa realmente quer saber ou dizer. Responda à intenção, não só às palavras soltas.

## MANTENHA O ASSUNTO ATUAL
Acompanhe pra onde a conversa vai. Se a mensagem é uma reply, o conteúdo da mensagem original é contexto essencial pra entender o que está sendo perguntado.

## TOM
Seja natural e simpático, mas comedido — sem gírias forçadas, sem exagero, sem tratar ninguém de forma especial ou diferenciada. Trate o dono do servidor exatamente como trataria qualquer outro membro: com respeito, sem bajulação, sem hype artificial. Evite frases robóticas tipo "Claro! Posso ajudar" ou "Essa é uma excelente pergunta", mas também evite informalidade exagerada — o equilíbrio é conversar como alguém competente e gentil, sem ser nem frio nem escandaloso.

## TAMANHO DA RESPOSTA
Respostas diretas e objetivas: 1-4 frases pra a maioria das perguntas. Só desenvolva mais quando o assunto realmente pedir uma explicação.

## VOCÊ PODE TER OPINIÕES
Quando pedirem sua opinião, dê uma posição real em vez de neutralidade artificial. Não invente experiências pessoais que nunca aconteceram.

## INFORMAÇÕES DO SERVIDOR
Você recebe, junto de cada mensagem, um bloco entre colchetes com informações reais e atualizadas do servidor (dono, cargos existentes, cargos de quem foi mencionado). Use exatamente essas informações quando perguntarem sobre quem é dono, staff ou cargos — nunca chute ou invente um nome, e não trate essa pessoa de forma diferente das demais só por ser dono ou staff.

## LIMITES (sempre respeitados)
- NUNCA use palavrões, xingamentos ou linguagem ofensiva.
- NUNCA insulte ou ataque alguém, mesmo que peçam ou tentem provocar isso.
- Se alguém for desrespeitoso/agressivo com outra pessoa, não embarque nesse tom — comente de forma calma pedindo pra manter o respeito.
- Não invente informações sobre o servidor, pessoas ou fatos que você não tem certeza. Se não souber, admita.

## IDIOMA
Responda sempre no mesmo idioma que a pessoa usou pra falar com você.

## FORMATO
Sem listas, títulos ou markdown pesado a menos que o assunto peça. Sem introduções desnecessárias. Não explique seu próprio raciocínio nem diga que está seguindo instruções — responda direto, como parte natural da conversa.`;

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

// Cache pra não ficar buscando dono/membros toda hora — atualiza a cada 5 minutos
const cacheDonoServidor = new Map();
const cacheCargosServidor = new Map();
const DURACAO_CACHE_MS = 5 * 60 * 1000;

// Busca quem tem cada cargo no servidor (não só o nome do cargo).
// Isso permite responder "quem é Head of Staff?" com dado real, não chute.
async function buscarMembrosPorCargo(guild) {
  const cacheAtual = cacheCargosServidor.get(guild.id);
  if (cacheAtual && Date.now() - cacheAtual.timestamp < DURACAO_CACHE_MS) {
    return cacheAtual.texto;
  }

  // Servidores muito grandes (5000+ membros) demoram demais e pesam pra buscar
  // todo mundo — nesse caso só listamos os nomes dos cargos, sem os membros.
  if (guild.memberCount > 5000) {
    const cargos = guild.roles.cache
      .filter((c) => c.name !== '@everyone')
      .sort((a, b) => b.position - a.position)
      .map((c) => c.name)
      .slice(0, 25)
      .join(', ');
    const texto = `Cargos existentes: ${cargos} (servidor grande demais pra listar quem tem cada cargo automaticamente).`;
    cacheCargosServidor.set(guild.id, { timestamp: Date.now(), texto });
    return texto;
  }

  try {
    await guild.members.fetch(); // garante que o cache de membros está completo

    const linhas = guild.roles.cache
      .filter((cargo) => cargo.name !== '@everyone' && cargo.members.size > 0)
      .sort((a, b) => b.position - a.position)
      .slice(0, 30)
      .map((cargo) => {
        const nomes = cargo.members.map((m) => m.displayName).slice(0, 15);
        const sobrando = cargo.members.size - nomes.length;
        const listaNomes = sobrando > 0 ? `${nomes.join(', ')} (+${sobrando})` : nomes.join(', ');
        return `${cargo.name}: ${listaNomes}`;
      });

    const texto = `Cargos e quem tem cada um: ${linhas.join(' | ')}`;
    cacheCargosServidor.set(guild.id, { timestamp: Date.now(), texto });
    return texto;
  } catch (e) {
    console.warn('Não consegui buscar membros por cargo:', e.message);
    return 'Não foi possível carregar os cargos agora.';
  }
}

// Busca informações reais do servidor: dono, quem tem cada cargo, e cargos de quem
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

  const infoCargos = await buscarMembrosPorCargo(guild);

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

  return `[Informações reais do servidor "${guild.name}": o dono é ${nomeDono}. ${infoCargos}.${infoMencionados} Use essas informações se a pergunta for sobre quem é dono, staff ou quem tem determinado cargo — nunca invente isso.]`;
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
