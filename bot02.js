const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const atendimentosHumanos = new Map();

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, 'session')
    }),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let inatividadeTimer = null;
const TEMPO_INATIVIDADE = 5 * 60 * 1000; // 5 minutos (em milissegundos)

function reiniciarTimerDeInatividade() {
    if (inatividadeTimer) {
        clearTimeout(inatividadeTimer);
    }
    inatividadeTimer = setTimeout(() => {
        console.log('🕒 Nenhuma mensagem recebida em 5 minutos. Encerrando o bot...');
        process.exit();
    }, TEMPO_INATIVIDADE);
}

function registrarAtendimento(dados) {
    const { numero, mensagem, resposta, horario } = dados;
    let produto = null;

    const encontrado = buscarNoCatalogo(mensagem);
    if (encontrado) {
        const nomeProduto = encontrado.match(/\*\*(.*?)\*\*/);
        if (nomeProduto) {
            produto = nomeProduto[1];
        }
    }

    const sql = 'INSERT INTO historico (numero, mensagem, resposta, horario, produto) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [numero, mensagem, resposta, horario, produto], (err) => {
        if (err) {
            return console.error('Erro ao salvar no banco:', err.message);
        }
    });
}

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('Bot está pronto!');
});

const catalogo = JSON.parse(fs.readFileSync('./catalogo.json', 'utf-8'));

if (!catalogo || typeof catalogo !== 'object') {
    console.error('Erro: catalogo.json não é um objeto válido!');
    process.exit(1); 
}

const saudacoesSimples = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'opa'];
const horarioAtendimento = { inicio: 8, fim: 18 }; 

function dentroDoHorarioComercial() {
    const hora = new Date().getHours();
    return hora >= horarioAtendimento.inicio && hora < horarioAtendimento.fim;
}

function buscarNoCatalogo(texto) {
    if (!catalogo || typeof catalogo !== 'object') {
        console.error('Catálogo não carregado ou inválido!');
        return null;
    }

    texto = texto.toLowerCase();

    for (const categoria in catalogo) {
        const itens = catalogo[categoria];

        if (Array.isArray(itens)) {
            for (const produto of itens) {
                const nomeProduto = produto.nome?.toLowerCase() || '';
                if (nomeProduto && texto.includes(nomeProduto)) {
                    return `🔍 *${produto.nome}*\n${produto.descricao}`;
                }
            }
        }
        else if (typeof itens === 'object') {
            for (const subcategoria in itens) {
                const produtos = itens[subcategoria];
                if (Array.isArray(produtos)) {
                    for (const produto of produtos) {
                        const nomeProduto = produto.nome?.toLowerCase() || '';
                        if (nomeProduto && texto.includes(nomeProduto)) {
                            return `🔍 *${produto.nome}*\n${produto.descricao}`;
                        }
                    }
                }
            }
        }
    }
    return null; 
}

const baseConhecimento = {
  "LINHA DESENGRAXANTES": {
    "DESENGRAXANTES BASE ÁGUA": [
      {
        "nome": "ARCLEANING - A",
        "descricao": "Desengraxante a base d'água, com PH ácido.",
        "aplicacao": "Indicado para limpeza pesada de metais ferrosos, remoção de óxidos e graxas industriais",
        "caracteristicas": ["PH ácido (2.0-3.5)", "Não inflamável", "Diluível em água"]
      },
      {
        "nome": "ARCLEANING - B",
        "descricao": "Desengraxante a base d'água, com PH alcalino.",
        "aplicacao": "Eficaz na remoção de graxas pesadas e óleos lubrificantes em peças automotivas",
        "caracteristicas": ["PH alcalino (11.0-12.5)", "Baixa espuma", "Biodegradável"]
      },
      {
        "nome": "ARCLEANING - N",
        "descricao": "Desengraxante a base d'água, com PH neutro.",
        "aplicacao": "Limpeza geral de equipamentos e peças sensíveis",
        "caracteristicas": ["PH neutro (6.5-7.5)", "Seguro para metais não-ferrosos"]
      },
      {
        "nome": "ARCLEANING - P",
        "descricao": "Desengraxante a base d'água, com opção protetiva.",
        "aplicacao": "Limpeza com proteção anticorrosiva para peças armazenadas",
        "caracteristicas": ["Proteção até 30 dias", "Base água"]
      }
    ],
    "DESENGRAXANTES BASE SOLVENTE": [
      {
        "nome": "ARSOLVº",
        "descricao": "Desengraxante insolúvel em água, à base de solventes isoparafínicos, hidrogenados ou oxigenados.",
        "aplicacao": "Limpeza rápida de equipamentos industriais sem resíduos",
        "precaucoes": ["Uso com EPI", "Ambiente ventilado", "Evitar contato com plásticos"]
      },
      {
        "nome": "ARSOLVºEM",
        "descricao": "Desengraxante emulsionável em água, à base de solventes isoparafínicos, hidrogenados ou oxigenados.",
        "aplicacao": "Limpeza econômica com poder solvente",
        "vantagens": ["Redução de 40% no consumo", "Menor impacto ambiental"]
      }
    ]
  },
  "LINHA METAL WORKING": {
    "ÓLEOS DE CORTE INTEGRAL": [
      {
        "nome": "ARCUTºEE",
        "descricao": "Fluído de eletroerosão.",
        "aplicacao": "Usinagem por descarga elétrica em metais duros",
        "viscosidade": "ISO VG 22"
      },
      {
        "nome": "ARCUTºM",
        "descricao": "Fluído de corte integral.",
        "beneficios": ["Vida útil prolongada", "Proteção contra ferrugem"]
      },
      {
        "nome": "ARCUTºVG",
        "descricao": "Fluido de corte integral, tipo biodegradável.",
        "certificacoes": ["ISO 14001", "Ecolabel"]
      }
    ],
    "ÓLEOS PROTETIVOS": [
      {
        "nome": "ARPROTºDW",
        "descricao": "Protetivo desaguante.",
        "aplicacao": "Proteção de peças após lavagem industrial"
      },
      {
        "nome": "ARPROTºE",
        "descricao": "Protetivo aquoso.",
        "duracao": "Proteção por 3 meses"
      },
      {
        "nome": "ARPROTºWAX",
        "descricao": "Protetivo ceroso.",
        "aplicacao": "Proteção de longa duração para peças armazenadas"
      },
      {
        "nome": "ARPROTºW",
        "descricao": "Protetivo sintético aquoso.",
        "vantagens": ["Secagem rápida", "Não pegajoso"]
      },
      {
        "nome": "ARPROTºVG",
        "descricao": "Protetivo de filme vegetal.",
        "caracteristicas": ["Biodegradável", "Atóxico"]
      }
    ],
    "ÓLEOS DE CORTE SOLÚVEL": [
      {
        "nome": "ARCOOL MS",
        "descricao": "Óleo de corte mineral, solúvel.",
        "diluicao": "5-8% em água"
      },
      {
        "nome": "ARCOOL SP",
        "descricao": "Fluído solúvel sintético, tipo polímero.",
        "vida_util": "Até 6 meses"
      },
      {
        "nome": "ARCOOL SR",
        "descricao": "Fluído solúvel sintético.",
        "aplicacao": "Usinagem de alta velocidade"
      },
      {
        "nome": "ARCOOL SS",
        "descricao": "Óleo solúvel semi sintético.",
        "beneficios": ["Economia de 30%", "Menor névoa"]
      },
      {
        "nome": "ARCOOL VG",
        "descricao": "Fluído solúvel sintético biodegradável.",
        "certificacoes": ["NSF H1", "ISO 15380"]
      }
    ],
    "ÓLEOS LUBRIFICANTES INDUSTRIAIS": [
      {
        "nome": "ARLUB HPL",
        "descricao": "Óleo hidráulico - DIN 51.524 HPL.",
        "aplicacao": "Sistemas hidráulicos de alta pressão"
      },
      {
        "nome": "ARLUB CLP",
        "descricao": "Óleo de engrenagem industrial - DIN 51.502 CLP.",
        "viscosidades": ["ISO VG 68", "ISO VG 100"]
      },
      {
        "nome": "ARLUB CGLP",
        "descricao": "Óleo de guias e barramento - DIN 51.502 CGLP.",
        "caracteristicas": ["Antidesgaste", "Antiferrugem"]
      },
      {
        "nome": "ARLUB HEES",
        "descricao": "Fluído lubrificante biodegradável - DIN 15.380 HEES.",
        "vantagens": ["Biodegradável em 28 dias", "Atóxico"]
      }
    ],
    "ÓLEOS DE ESTAMPAGEM": [
      {
        "nome": "ARSTAMPºEY",
        "descricao": "Óleo de estampagem evaporativo.",
        "aplicacao": "Estampagem de chapas finas"
      },
      {
        "nome": "ARSTAMPºM",
        "descricao": "Óleo de estampagem severa.",
        "especificacao": "Para operações com alto atrito"
      },
      {
        "nome": "RM",
        "descricao": "Fluído de estampagem solúvel.",
        "diluicao": "10-15% em água"
      },
      {
        "nome": "ARSTAMPºVG",
        "descricao": "Fluído de estampagem biodegradável.",
        "certificacoes": ["Ecolabel", "ISO 14001"]
      }
    ]
  },
  "DIVERSAS APLICAÇÕES": [
    {
      "nome": "ARBAC",
      "descricao": "Bactericida, fungicida, levicida para tratamento de óleo solúvel.",
      "dosagem": "0.1-0.3% do volume do tanque"
    },
    {
      "nome": "ARFORGE W",
      "descricao": "Fluído de forjamento - isento de grafite.",
      "aplicacao": "Forjamento a quente de metais"
    },
    {
      "nome": "ARGLASS",
      "descricao": "Fluído de corte de vidro.",
      "vantagens": ["Corte preciso", "Sem riscos"]
    },
    {
      "nome": "ARLUB DT",
      "descricao": "Fluído refletivo (ensaio não destrutivo - detecção de trincas).",
      "aplicacao": "Inspeção de peças críticas"
    },
    {
      "nome": "ARPAPER MT",
      "descricao": "Fluído para corte de papel e fralda.",
      "caracteristicas": ["Não mancha", "Secagem rápida"]
    },
    {
      "nome": "ARTEXM",
      "descricao": "Óleo lubrificante para teares - circular lavável.",
      "beneficios": ["Reduz paradas", "Lavável a água"]
    }
  ],
  "DESMOLDANTES": [
    {
      "nome": "ARDESMOLD",
      "descricao": "Desmoldantes para diversas aplicações (refratário, alumínio, fibrocimento, etc).",
      "tipos": ["Spray", "Pasta", "Líquido"]
    },
    {
      "nome": "ARDESMOLD AR 15",
      "descricao": "Antirrespingo.",
      "aplicacao": "Proteção de moldes em fundição"
    }
  ],
  "ESPECIFICAÇÕES TÉCNICAS": {
    "normas": ["DIN 51.524", "DIN 51.502", "ISO 6743", "NSF H1"],
    "viscosidades": ["ISO VG 22", "ISO VG 46", "ISO VG 68", "ISO VG 100"],
    "certificacoes": ["ISO 9001", "ISO 14001", "Ecolabel"]
  }
};

function formatarBaseParaGPT() {
  let texto = "Catálogo Técnico Completo - Blasfen Lubrificantes Industriais\n\n";
  
  for (const [linha, categorias] of Object.entries(baseConhecimento)) {
    if (linha === "ESPECIFICAÇÕES TÉCNICAS") continue;
    
    texto += `🏷️ *${linha.toUpperCase()}*\n`;
    
    if (Array.isArray(categorias)) {
      categorias.forEach(produto => {
        texto += `\n🔹 *${produto.nome}*\n▸ ${produto.descricao}\n`;
        if (produto.aplicacao) texto += `▸ Aplicação: ${produto.aplicacao}\n`;
        if (produto.dosagem) texto += `▸ Dosagem: ${produto.dosagem}\n`;
        if (produto.caracteristicas) texto += `▸ Características: ${produto.caracteristicas.join(', ')}\n`;
      });
    } else {
      for (const [subcategoria, produtos] of Object.entries(categorias)) {
        texto += `\n▸ *${subcategoria}*\n`;
        produtos.forEach(produto => {
          texto += `\n🔸 *${produto.nome}*\n▸ ${produto.descricao}\n`;
          if (produto.aplicacao) texto += `▸ Aplicação: ${produto.aplicacao}\n`;
          if (produto.viscosidade) texto += `▸ Viscosidade: ${produto.viscosidade}\n`;
          if (produto.certificacoes) texto += `▸ Certificações: ${produto.certificacoes.join(', ')}\n`;
        });
      }
    }
    texto += "\n────────────────\n";
  }
  
  texto += "\n📜 *ESPECIFICAÇÕES TÉCNICAS*\n";
  const specs = baseConhecimento["ESPECIFICAÇÕES TÉCNICAS"];
  texto += `▸ Normas: ${specs.normas.join(', ')}\n`;
  texto += `▸ Viscosidades: ${specs.viscosidades.join(', ')}\n`;
  texto += `▸ Certificações: ${specs.certificacoes.join(', ')}`;
  
  return texto;
}

async function responderDuvidaTecnica(pergunta) {
  const contexto = `Você é um assistente técnico especializado em lubrificantes industriais.
  
  Base de conhecimento atualizada:
  
  ${formatarBaseParaGPT()}
  
  Diretrizes:
  - Seja preciso e técnico
  - Cite produtos específicos quando relevante
  - Limite respostas a 3 parágrafos
  - Em caso de dúvida, sugira contato com engenheiros técnicos
  
  Pergunta: ${pergunta}`;

  const resposta = await enviarParaChatGPT(contexto);
  return resposta;
}

async function enviarParaChatGPT(mensagem) {
    const conhecimentosLocais = Object.entries(conhecimentos)
        .map(([produto, info]) => `- ${produto}: ${info}`)
        .join('\n');

    const prompt = `Você é um atendente da Blasfen (lubrificantes industriais). Baseie suas respostas nestes dados:\n${conhecimentosLocais}\n\nPergunta: ${mensagem}\n\nResposta técnica breve:`;

    try {
        const resposta = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [{role: 'user', content: prompt}],
            temperature: 0.3,
            max_tokens: 500
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_KEY || '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`,'}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return resposta.data.choices[0].message.content.trim();
    } catch (error) {
        if (error.response?.status === 429) {
            console.error('⚠️ Limite de requisições excedido. Aguardando...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            return enviarParaChatGPT(mensagem); 
        }
        
        console.error('Erro na API OpenAI:', error.message);
        return '❌ Desculpe, estou com dificuldades técnicas. Por favor, tente novamente mais tarde.';
    }
}

client.on('message_create', async message => {
    if (message.fromMe) return;
    const agora = Date.now();
    const recebida = message.timestamp * 1000;

    if ((agora - recebida) > 1000 * 60 * 5) {
        return; 
    }

    const numero = message.from;
    const texto = message.body.toLowerCase().trim();

    if (atendimentosHumanos.has(numero)) {
        registrarAtendimento({
            numero: numero,
            mensagem: texto,
            resposta: '[Encaminhado para atendente humano]',
            horario: new Date().toISOString()
        });
        return;
    }

    if (!dentroDoHorarioComercial()) {
        return message.reply('⏰ Nosso atendimento é de segunda a sexta, das 8h às 18h. Deixe sua mensagem e responderemos assim que possível!');
    }

    if (saudacoesSimples.includes(texto)) {
        return message.reply(`Olá! 👋 Eu sou o assistente virtual da *Blasfen*.\n\nComo posso te ajudar hoje?\n\n1️⃣ Ver catálogo 📄\n2️⃣ Falar com um atendente humano 👤\n3️⃣ Dúvidas sobre um produto ❓\n\nDigite o número da opção desejada ou mande sua dúvida.`);
    }

    if (texto === '1') {
        await message.reply('📄 Aqui está o nosso catálogo:');
        const media = MessageMedia.fromFilePath('./catalogo.pdf');
        return client.sendMessage(message.from, media);
    }

    if (texto === '2') {
        atendimentosHumanos.set(numero, true);
        registrarAtendimento({
            numero: numero,
            mensagem: texto,
            resposta: 'Solicitou atendimento humano',
            horario: new Date().toISOString()
        });
        notificarAtendente(numero);
        return message.reply('👤 *Atendente humano acionado!*\n\nUm especialista entrará em contato em breve.\nEnquanto isso, descreva sua necessidade:');
    }

    const respostaCatalogo = buscarNoCatalogo(texto);
    if (respostaCatalogo) {
        return message.reply(respostaCatalogo);
    }

    if (texto.length < 3) {
        return message.reply('🤔 Poderia me dar mais detalhes para que eu possa ajudar melhor?');
    }

    try {
        const respostaIA = await enviarParaChatGPT(texto);
        await message.reply(respostaIA);

        const horarioResposta = new Date().toISOString();
        const usuarioId = 1; 
        const produto = buscarNoCatalogo(texto) ? texto : null;

        const query = 'INSERT INTO atendimentos (usuario_id, mensagem, produto, resposta, horario) VALUES (?, ?, ?, ?, ?)';
        
        db.query(query, [usuarioId, message.body, produto, respostaIA, horarioResposta], (err, results) => {
            if (err) {
                console.error('Erro ao registrar atendimento:', err);
            } else {
                console.log('Atendimento registrado com sucesso!');
            }
        });
    } catch (error) {
        console.error('Erro com ChatGPT:', error.message);
        await message.reply('❌ Desculpe, houve um erro ao tentar responder. Por favor, tente novamente mais tarde.');
    }
    reiniciarTimerDeInatividade();
});

client.initialize();
// Inicialização do bot -->  node bot02.js
