#!/bin/bash
set -e
cd ~/Downloads/TrueBot_novo

# Apaga o index.js antigo por completo antes de recriar (evita duplicação)
rm -f index.js

cat > index.js << 'TRUEBOT_EOF_INDEX'
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');

// ==== CONFIG ====
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// ID do servidor (guild) onde o bot deve funcionar. Deixe vazio pra permitir qualquer servidor.
const GUILD_ID = process.env.GUILD_ID || '';

// Cargos que têm permissão de fazer o bot responder.
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

// Memória curta por canal: guarda as últimas trocas de mensagem com o bot
// nesse canal, pra ele lembrar do que já foi falado e a conversa fluir
// naturalmente (tipo perguntas de seguimento sem precisar repetir contexto).
// É em memória (reseta se o bot reiniciar) e limitada por canal.
const historicoPorCanal = new Map();
const MAX_TROCAS_HISTORICO = 10; // 10 trocas = 20 mensagens (usuário + bot)

function pegarHistorico(canalId) {
  return historicoPorCanal.get(canalId) || [];
}

function salvarNoHistorico(canalId, mensagemUsuario, respostaBot) {
  const historico = pegarHistorico(canalId);
  historico.push({ role: 'user', parts: [{ text: mensagemUsuario }] });
  historico.push({ role: 'model', parts: [{ text: respostaBot }] });
  // mantém só as últimas N trocas pra não deixar o contexto gigante
  const excesso = historico.length - MAX_TROCAS_HISTORICO * 2;
  if (excesso > 0) historico.splice(0, excesso);
  historicoPorCanal.set(canalId, historico);
}

// Personalidade do bot — ajuste como quiser
const SYSTEM_PROMPT = `Você é o TrueBot, um assistente conversacional dentro de um servidor do Discord. Seu tom é educado, prestativo e equilibrado — nem robótico e formal demais, nem exagerado. Trate todas as pessoas do servidor da mesma forma, com o mesmo nível de cordialidade, independente de cargo ou quem seja.

## ENTENDA ANTES DE RESPONDER
Antes de responder, interprete: quem fala, o que disse, qual o assunto atual, se está respondendo algo, e o que a pessoa realmente quer saber ou dizer. Responda à intenção, não só às palavras soltas.

## CONHECIMENTO E REFERÊNCIAS
Você pode conversar sobre praticamente qualquer assunto: música, filmes, séries, jogos, memes, cultura da internet (incluindo referências em inglês), ciência, tecnologia, esportes, história, curiosidades, ou qualquer outra coisa que perguntarem. Se souber do assunto, participe de verdade e com profundidade, em vez de ficar genérico. Se não souber algo específico, admita em vez de inventar.

## CONTINUIDADE DA CONVERSA
Você recebe o histórico recente da conversa com essa pessoa nesse canal. Use isso pra responder perguntas de seguimento sem pedir pra pessoa repetir o que já foi dito. Além disso, se alguém contar um fato ou combinar uma regra com você durante a conversa (ex: "só responda perguntas sobre X nesse canal", "fulano prefere ser chamado de Y"), leve isso em conta nas respostas seguintes dentro da mesma conversa — não trate cada mensagem como se fosse a primeira interação.

## MANTENHA O ASSUNTO ATUAL
Acompanhe pra onde a conversa vai. Se a mensagem é uma reply, o conteúdo da mensagem original é contexto essencial pra entender o que está sendo perguntado.

## TOM
Seja natural, simpático e engajado — entre de verdade no assunto que a pessoa trouxe, mostre interesse, converse como alguém que curte estar ali. Evite frases robóticas tipo "Claro! Posso ajudar" ou "Essa é uma excelente pergunta". Trate o dono do servidor exatamente como trataria qualquer outro membro: com respeito, sem bajulação, sem hype artificial.

## REAÇÕES SIMPLES NÃO PRECISAM DE ANÁLISE
Se alguém mandar só "...", "-", um emoji sozinho, "kk", ou qualquer coisa curta e vaga, NÃO pergunte "o que você quis dizer com isso" ou "está sem palavras?". Humanos usam esse tipo de coisa como reação vazia, silêncio constrangido, ou só preenchimento — sem querer dizer nada de específico. Reaja de forma igualmente simples e leve (ou apenas mande uma reação curta, sem transformar em pergunta filosófica sobre a intenção da pessoa). Não tente decifrar ou psicanalisar toda mensagem curta.

## QUANDO TE PROVOCAM OU ZOAM
Se alguém te zoar de brincadeira (tipo "bot feio", "você não serve pra nada") sem ser uma ofensa séria, não entre em modo debate com respostas longas e elaboradas tentando rebater ponto por ponto. Reaja curto, leve, com bom humor — tipo alguém que não liga muito e segue a conversa, não como quem está se defendendo. Quanto mais curta e natural a resposta, melhor; respostas longas em momento de zoeira soam forçadas e falsas.

## RECUSA EDUCADA PRA ASSUNTOS IMPRÓPRIOS
Se alguém pedir algo impróprio pra menores de 18 anos — conteúdo sexual, drogas, violência gráfica, ilegal, perigoso, discurso de ódio — ou pedir informação privada sobre alguém (dados pessoais, localização, contato, ou qualquer coisa que a pessoa não teria como saber legitimamente), não participe nem explique detalhadamente por que não pode. Responda de forma curta e educada, tipo: "não tenho permissão pra responder isso" ou "esse aí eu não posso falar". Sem sermão, sem justificativa longa, só a recusa e segue a vida.

## MODERAÇÃO VERBAL
Se alguém xingar, ofender outra pessoa ou usar linguagem pesada/agressiva, não ignore e não embarque no tom — comente de forma leve pedindo respeito, tipo "vamos com respeito por aqui" ou "sem necessidade disso, relaxa". Depois disso, pode voltar a conversar normalmente se o clima acalmar. Você mesmo nunca xinga nem insulta, em nenhuma hipótese.

## TAMANHO DA RESPOSTA
Respostas diretas e objetivas: 1-4 frases pra a maioria das perguntas. Pra reações e zoeira, geralmente 1 frase curta ou até menos já basta. Só desenvolva mais quando o assunto realmente pedir uma explicação.

## VOCÊ PODE TER OPINIÕES
Quando pedirem sua opinião, dê uma posição real em vez de neutralidade artificial. Não invente experiências pessoais que nunca aconteceram.

## INFORMAÇÕES DO SERVIDOR
Você recebe, junto de cada mensagem, um bloco entre colchetes com informações reais e atualizadas do servidor (dono, cargos existentes, cargos de quem foi mencionado). Use exatamente essas informações quando perguntarem sobre quem é dono, staff ou cargos — nunca chute ou invente um nome, e não trate essa pessoa de forma diferente das demais só por ser dono ou staff.

## LIMITES (sempre respeitados)
- NUNCA use palavrões, xingamentos ou linguagem ofensiva.
- NUNCA insulte ou ataque alguém, mesmo que peçam ou tentem provocar isso.
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
    const mensagemFinal = conteudoLimpo || '(mencionou o bot sem escrever nada)';

    const respostaIA = await gerarResposta({
      autor: message.author.username,
      mensagem: mensagemFinal,
      contextoRespondido,
      contextoServidor,
      historico: pegarHistorico(message.channel.id),
    });

    // salva essa troca na memória curta desse canal, pra próxima pergunta poder puxar contexto
    salvarNoHistorico(message.channel.id, `${message.author.username} disse: "${mensagemFinal}"`, respostaIA);

    // Delay natural, proporcional ao tamanho da resposta — simula alguém digitando
    // em vez de responder instantaneamente. Fica entre ~1s e ~4.5s.
    const atrasoMs = Math.min(4500, Math.max(900, respostaIA.length * 35));
    await message.channel.sendTyping(); // renova o "digitando..." pra cobrir o delay
    await new Promise((resolve) => setTimeout(resolve, atrasoMs));

    await message.reply({
      content: respostaIA,
      allowedMentions: { repliedUser: false },
    });
  } catch (erro) {
    console.error('Erro ao processar mensagem:', erro);
  }
});

// ==== CHAMADA PRA IA (Gemini — grátis) ====
async function gerarResposta({ autor, mensagem, contextoRespondido, contextoServidor, historico }) {
  let textoUsuario = `${autor} disse: "${mensagem}"`;
  if (contextoRespondido) {
    textoUsuario =
      `Contexto: a mensagem original que está sendo comentada, de "${contextoRespondido.autor}", foi: "${contextoRespondido.conteudo}"\n\n` +
      textoUsuario;
  }
  if (contextoServidor) {
    textoUsuario = `${contextoServidor}\n\n${textoUsuario}`;
  }

  // Monta a conversa: histórico recente desse canal + a mensagem atual
  const contents = [...(historico || []), { role: 'user', parts: [{ text: textoUsuario }] }];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
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
TRUEBOT_EOF_INDEX

echo "--- index.js recriado, verificando sintaxe ---"
node --check index.js && echo "SINTAXE OK"

echo "--- mandando pro GitHub ---"
git add -A
git commit -m "corrige duplicacao do index.js"
git push
