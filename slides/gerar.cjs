// Gera o deck do pitch: node gerar.cjs  →  Central-Animal-Pitch.pptx
const pptxgen = require('pptxgenjs')
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const fa = require('react-icons/fa6')
const gi = require('react-icons/gi')

// ---------- Paleta ----------
const C = {
  noite: '0B3B37', // fundo escuro dominante
  marca: '0F766E',
  marcaClara: '14B8A6',
  menta: 'CCFBF1',
  mentaSuave: '99F6E4',
  tinta: '0F172A',
  cinza: '475569',
  cinzaClaro: '94A3B8',
  borda: 'E2E8F0',
  fundoCard: 'F8FAFC',
  branco: 'FFFFFF',
  p1: 'DC2626',
  p2: 'EA580C',
  p3: 'CA8A04',
  p4: '16A34A',
}
const TITULO = 'Calibri'
const CORPO = 'Calibri'
const URL_FIXA = 'pedroi1s.github.io/central-animal'

// ---------- Ícones (react-icons → PNG) ----------
async function icone(Comp, cor, px = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { size: px })).replace(/currentColor/g, '#' + cor)
  const png = await sharp(Buffer.from(svg)).resize(px, px).png().toBuffer()
  return 'image/png;base64,' + png.toString('base64')
}
async function qr() {
  const svg = fs.readFileSync(path.join(__dirname, '../pages/qr-central-animal.svg'))
  const png = await sharp(svg, { density: 300 }).resize(1024, 1024).png().toBuffer()
  return 'image/png;base64,' + png.toString('base64')
}

// ---------- Helpers ----------
const texto = (slide, t, o) => slide.addText(t, { isTextBox: true, fontFace: CORPO, margin: 0, ...o })

function pontosPrioridade(slide, x, y, d = 0.28, gap = 0.16) {
  ;[C.p1, C.p2, C.p3, C.p4].forEach((cor, i) =>
    slide.addShape('ellipse', { x: x + i * (d + gap), y, w: d, h: d, fill: { color: cor }, line: { color: cor } }),
  )
}

function circuloIcone(slide, img, x, y, d, cor) {
  slide.addShape('ellipse', { x, y, w: d, h: d, fill: { color: cor }, line: { color: cor } })
  const m = d * 0.24
  slide.addImage({ data: img, x: x + m, y: y + m, w: d - 2 * m, h: d - 2 * m })
}

function titulo(slide, t, sub, escuro = false) {
  texto(slide, t, { x: 0.7, y: 0.5, w: 11.9, h: 0.8, fontFace: TITULO, fontSize: 36, bold: true, color: escuro ? C.branco : C.tinta })
  if (sub) texto(slide, sub, { x: 0.7, y: 1.3, w: 11.9, h: 0.5, fontSize: 18, color: escuro ? C.menta : C.cinza })
}

function card(slide, x, y, w, h, fill = C.fundoCard, borda = C.borda) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: borda, width: 1 } })
}

function sombra() {
  return { type: 'outer', color: '000000', opacity: 0.25, blur: 12, offset: 4, angle: 90 }
}

// Celular desenhado: moldura + tela
function celular(slide, x, y, w, h) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.35, fill: { color: '1E293B' }, line: { color: '1E293B' }, shadow: sombra() })
  const m = 0.12
  slide.addShape('roundRect', { x: x + m, y: y + m, w: w - 2 * m, h: h - 2 * m, rectRadius: 0.27, fill: { color: 'F1F5F9' }, line: { color: 'F1F5F9' } })
  return { x: x + m, y: y + m, w: w - 2 * m, h: h - 2 * m }
}

async function main() {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5
  pres.title = 'Central Animal — Ideathon GovTech Pato Branco 2026'
  pres.company = 'Ideathon GovTech Pato Branco 2026'

  const I = {
    pata: await icone(fa.FaPaw, C.branco),
    pataFundo: await icone(fa.FaPaw, '115E59', 512),
    carroFundo: await icone(fa.FaCarBurst, '134E4A', 512),
    carro: await icone(fa.FaCarBurst, C.branco),
    cobra: await icone(gi.GiSnake, C.branco),
    veneno: await icone(gi.GiPoisonBottle, C.branco),
    casa: await icone(fa.FaHouseCircleExclamation, C.branco),
    porta: await icone(fa.FaDoorOpen, C.branco),
    ramos: await icone(fa.FaCodeBranch, C.branco),
    velocimetro: await icone(fa.FaGaugeHigh, C.branco),
    rota: await icone(fa.FaRoute, C.branco),
    historico: await icone(fa.FaClockRotateLeft, C.branco),
    ia: await icone(fa.FaWandMagicSparkles, C.branco),
    usuario: await icone(fa.FaUserCheck, C.branco),
    balanca: await icone(fa.FaScaleBalanced, C.branco),
    check: await icone(fa.FaCircleCheck, C.p4),
    relogio: await icone(fa.FaStopwatch, C.branco),
    alvo: await icone(fa.FaFlagCheckered, C.branco),
    setas: await icone(fa.FaShuffle, C.branco),
    predio: await icone(fa.FaBuildingColumns, C.marca),
    maos: await icone(fa.FaHandshake, C.marca),
    chip: await icone(fa.FaMicrochip, C.marca),
    escudo: await icone(fa.FaUserShield, C.marca),
    celular: await icone(fa.FaMobileScreen, C.branco),
    servidor: await icone(fa.FaServer, C.branco),
    banco: await icone(fa.FaDatabase, C.branco),
    monitor: await icone(fa.FaDesktop, C.branco),
    nuvem: await icone(fa.FaCloud, C.branco),
    cerebro: await icone(fa.FaBrain, C.branco),
    qr: await qr(),
  }

  // ============ 1. CAPA ============
  {
    const s = pres.addSlide()
    s.background = { color: C.noite }
    s.addImage({ data: I.pataFundo, x: 8.4, y: 1.2, w: 4.6, h: 4.6 })
    circuloIcone(s, I.pata, 0.8, 0.8, 0.9, C.marca)
    texto(s, 'Central Animal', { x: 0.8, y: 2.3, w: 9, h: 1.2, fontFace: TITULO, fontSize: 64, bold: true, color: C.branco })
    texto(s, 'Uma porta única para quem quer ajudar um animal em risco.', { x: 0.8, y: 3.55, w: 8.5, h: 0.9, fontSize: 24, color: C.menta })
    pontosPrioridade(s, 0.8, 4.75)
    texto(s, 'Ideathon GovTech Pato Branco 2026  ·  Desafio GT-04 — Causa animal, comunidade e saúde coletiva', {
      x: 0.8, y: 6.55, w: 11.5, h: 0.4, fontSize: 14, color: C.mentaSuave,
    })
    s.addNotes('Não apresentar a equipe aqui. Ir direto para a cena (próximo slide). Ter o painel já aberto em outra área de trabalho, em modo demo.')
  }

  // ============ 2. A CENA ============
  {
    const s = pres.addSlide()
    s.background = { color: C.noite }
    s.addImage({ data: I.carroFundo, x: 9.0, y: 2.6, w: 3.8, h: 3.8 })
    texto(s, 'Uma noite qualquer em Pato Branco.', { x: 1.0, y: 1.3, w: 10, h: 0.5, fontSize: 18, color: C.mentaSuave, italic: true })
    texto(s, 'Você acabou de atropelar um cachorro.\nEle está vivo.', { x: 1.0, y: 2.0, w: 9.5, h: 2.0, fontFace: TITULO, fontSize: 44, color: C.branco })
    texto(s, 'Para quem você liga?', { x: 1.0, y: 4.5, w: 9.5, h: 1.1, fontFace: TITULO, fontSize: 56, bold: true, color: 'FCA5A5' })
    s.addNotes(
      '[0:00–0:25]\nVocê acabou de atropelar um cachorro. Ele está vivo. Para quem você liga?\n(pausa de 2 segundos)\nA maioria de nós não sabe. E a maioria das pessoas, nessa hora, vai embora — não por maldade, mas porque não sabe o que fazer, nem para onde levar, nem quem vai pagar.',
    )
  }

  // ============ 3. QUATRO DESTINOS ============
  {
    const s = pres.addSlide()
    s.background = { color: C.branco }
    titulo(s, 'Quatro ocorrências. Quatro destinos diferentes.', 'E o cidadão precisaria saber disso — em pânico, em 30 segundos.')
    const itens = [
      [I.carro, C.p1, 'Atropelamento', 'Município', 'Plantão veterinário + Secretaria de Meio Ambiente'],
      [I.cobra, C.p2, 'Cobra dentro de casa', 'Estado', 'Corpo de Bombeiros (193) e IAT — fauna silvestre'],
      [I.veneno, C.p3, 'Envenenamento', 'Veterinário + Polícia', 'Pode ser crime — e isca em via pública atinge crianças'],
      [I.casa, C.p4, 'Animal abandonado', 'Bem-estar animal', 'Sem urgência clínica, mas vira oito animais em poucos meses'],
    ]
    itens.forEach(([img, cor, nome, destino, detalhe], i) => {
      const x = 0.7 + (i % 2) * 6.1
      const y = 2.15 + Math.floor(i / 2) * 2.45
      card(s, x, y, 5.85, 2.15)
      circuloIcone(s, img, x + 0.35, y + 0.4, 1.0, cor)
      texto(s, nome, { x: x + 1.65, y: y + 0.35, w: 4.0, h: 0.5, fontSize: 22, bold: true, color: C.tinta })
      texto(s, '→ ' + destino, { x: x + 1.65, y: y + 0.88, w: 4.0, h: 0.45, fontSize: 19, bold: true, color: C.marca })
      texto(s, detalhe, { x: x + 1.65, y: y + 1.35, w: 4.0, h: 0.65, fontSize: 14, color: C.cinza, valign: 'top' })
    })
    s.addNotes(
      '[0:25–0:40]\nE o problema é mais fundo do que parece. Um atropelamento é com o município. Uma cobra, com os Bombeiros ou o IAT. Um envenenamento pode ser crime — é caso de polícia. Um abandono é com o bem-estar animal. O cidadão teria que conhecer toda a estrutura do poder público. Em pânico. Em trinta segundos.',
    )
  }

  // ============ 4. A PREFEITURA PEDIU ============
  {
    const s = pres.addSlide()
    s.background = { color: C.branco }
    titulo(s, 'A própria Prefeitura nos disse o que precisa.', 'Não é hipótese nossa: é a demanda de quem opera o serviço.')
    const req = [
      [I.porta, 'Entrada única', 'O cidadão não precisa decidir antes se procura Prefeitura, PM, Bombeiros ou IAT.'],
      [I.ramos, 'Pré-triagem adaptativa', 'Em vez de um formulário enorme, as perguntas mudam conforme as respostas.'],
      [I.velocimetro, 'Classificação de prioridade', 'Sangramento, dificuldade respiratória, convulsão e risco a pessoas sobem o caso.'],
      [I.rota, 'Encaminhamento', 'A ferramenta indica o serviço certo e envia os dados já coletados.'],
      [I.historico, 'Rastreabilidade', 'Protocolo e histórico: o plantonista vê denúncias anteriores no mesmo endereço.'],
    ]
    req.forEach(([img, nome, desc], i) => {
      const y = 2.05 + i * 0.98
      circuloIcone(s, img, 0.7, y, 0.72, C.marca)
      texto(s, nome, { x: 1.65, y: y + 0.02, w: 3.6, h: 0.68, fontSize: 21, bold: true, color: C.tinta, valign: 'middle' })
      texto(s, desc, { x: 5.3, y: y + 0.02, w: 7.3, h: 0.68, fontSize: 16, color: C.cinza, valign: 'middle' })
    })
    texto(s, 'Fonte: resposta oficial da Prefeitura de Pato Branco ao desafio GT-04.', { x: 0.7, y: 6.95, w: 11.9, h: 0.3, fontSize: 11, color: C.cinzaClaro, italic: true })
    s.addNotes(
      '[0:40–0:55]\nE isso não é uma suposição nossa. Quando perguntamos, a própria Prefeitura nos disse o que precisava: uma entrada única, uma triagem que se adapta, prioridade clara, encaminhamento certo e histórico de cada caso.',
    )
  }

  // ============ 5. SOLUÇÃO + QR ============
  {
    const s = pres.addSlide()
    s.background = { color: C.noite }
    circuloIcone(s, I.pata, 0.8, 0.75, 0.7, C.marca)
    texto(s, 'Central Animal', { x: 1.7, y: 0.78, w: 6, h: 0.65, fontFace: TITULO, fontSize: 32, bold: true, color: C.branco })
    texto(s, 'Uma porta única que entende a urgência, diz o que fazer agora e entrega o caso ao serviço certo.', {
      x: 0.8, y: 1.85, w: 6.6, h: 1.5, fontFace: TITULO, fontSize: 28, color: C.branco,
    })
    const passos = [
      ['1', 'Relate', 'Com suas palavras ou com botões. Sem cadastro, sem instalar nada.'],
      ['2', 'Entenda a urgência', 'Prioridade na hora, com o motivo e o que fazer agora.'],
      ['3', 'Acompanhe', 'Protocolo e retorno até o desfecho do caso.'],
    ]
    passos.forEach(([n, t, d], i) => {
      const y = 3.75 + i * 1.02
      s.addShape('ellipse', { x: 0.8, y, w: 0.6, h: 0.6, fill: { color: C.marcaClara }, line: { color: C.marcaClara } })
      texto(s, n, { x: 0.8, y, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: C.noite, align: 'center', valign: 'middle' })
      texto(s, t, { x: 1.65, y: y - 0.06, w: 5.6, h: 0.4, fontSize: 20, bold: true, color: C.branco })
      texto(s, d, { x: 1.65, y: y + 0.34, w: 5.8, h: 0.4, fontSize: 14, color: C.menta })
    })
    // QR
    s.addShape('roundRect', { x: 7.9, y: 0.75, w: 4.75, h: 6.0, rectRadius: 0.25, fill: { color: C.branco }, line: { color: C.branco }, shadow: sombra() })
    s.addImage({ data: I.qr, x: 8.3, y: 1.0, w: 3.95, h: 3.95 })
    texto(s, 'Aponte a câmera e relate um caso', { x: 8.1, y: 5.05, w: 4.35, h: 0.5, fontSize: 20, bold: true, color: C.tinta, align: 'center' })
    texto(s, URL_FIXA, { x: 8.1, y: 5.6, w: 4.35, h: 0.4, fontSize: 15, color: C.marca, align: 'center', bold: true })
    pontosPrioridade(s, 9.6, 6.15, 0.22, 0.14)
    s.addNotes(
      '[0:55–1:15]\nPor isso criamos a Central Animal. Uma porta única que entende a urgência, diz ao cidadão o que fazer agora e entrega o caso ao serviço certo.\nE vocês vão testar agora. APONTEM A CÂMERA DO CELULAR PARA ESSE QR CODE e relatem uma ocorrência.\n\n(Operador: já trocar para o painel no fim desta fala.)',
    )
  }

  // ============ 6. DEMO ============
  {
    const s = pres.addSlide()
    s.background = { color: C.noite }
    s.addShape('roundRect', { x: 0.8, y: 0.8, w: 1.6, h: 0.5, rectRadius: 0.25, fill: { color: C.p1 }, line: { color: C.p1 } })
    texto(s, '● AO VIVO', { x: 0.8, y: 0.8, w: 1.6, h: 0.5, fontSize: 14, bold: true, color: C.branco, align: 'center', valign: 'middle' })
    texto(s, 'Demonstração', { x: 0.8, y: 1.6, w: 5.2, h: 1.0, fontFace: TITULO, fontSize: 48, bold: true, color: C.branco })
    texto(s, 'Do relato no celular de vocês ao painel do servidor — e de volta.', { x: 0.8, y: 2.65, w: 5.0, h: 1.0, fontSize: 20, color: C.menta })
    s.addShape('roundRect', { x: 0.8, y: 4.3, w: 2.2, h: 2.2, rectRadius: 0.15, fill: { color: C.branco }, line: { color: C.branco } })
    s.addImage({ data: I.qr, x: 0.92, y: 4.42, w: 1.96, h: 1.96 })
    texto(s, 'Ainda dá tempo:\nescaneie e relate.', { x: 3.2, y: 4.8, w: 2.8, h: 1.0, fontSize: 16, color: C.menta })
    // Mockup do painel (fila)
    const px = 6.5, py = 0.8, pw = 6.1, ph = 5.9
    s.addShape('roundRect', { x: px, y: py, w: pw, h: ph, rectRadius: 0.12, fill: { color: 'F1F5F9' }, line: { color: 'F1F5F9' }, shadow: sombra() })
    s.addShape('rect', { x: px, y: py + 0.1, w: pw, h: 0.6, fill: { color: C.tinta }, line: { color: C.tinta } })
    texto(s, 'Central Animal · Painel do servidor', { x: px + 0.3, y: py + 0.1, w: 4, h: 0.6, fontSize: 13, bold: true, color: C.branco, valign: 'middle' })
    const fila = [
      [1, 'Atropelamento', 'Atropelamento · Sangramento intenso', 'Av. Tupi · agora', true],
      [1, 'Envenenamento', 'Possível envenenamento em série', 'La Salle · há 42 min', false],
      [2, 'Maus-tratos', 'Denúncia · 1 ocorrência a 15 m', 'Alvorada · há 2 dias', false],
      [3, 'Abandono', 'Abandono com filhotes', 'Bortot · há 5 h', false],
      [4, 'Animal morto na via', 'Encaminhado a Serviços Urbanos', 'São Cristóvão · há 2 h', false],
    ]
    const cores = { 1: C.p1, 2: C.p2, 3: C.p3, 4: C.p4 }
    const rot = { 1: 'P1 · Crítica', 2: 'P2 · Alta', 3: 'P3 · Média', 4: 'P4 · Baixa' }
    fila.forEach(([p, cat, motivo, onde, novo], i) => {
      const y = py + 0.95 + i * 0.97
      s.addShape('roundRect', { x: px + 0.25, y, w: pw - 0.5, h: 0.82, rectRadius: 0.08, fill: { color: C.branco }, line: { color: novo ? C.marcaClara : C.borda, width: novo ? 2 : 1 } })
      s.addShape('ellipse', { x: px + 0.45, y: y + 0.29, w: 0.24, h: 0.24, fill: { color: cores[p] }, line: { color: cores[p] } })
      texto(s, rot[p], { x: px + 0.8, y: y + 0.08, w: 1.4, h: 0.32, fontSize: 11, bold: true, color: cores[p] })
      texto(s, cat, { x: px + 2.1, y: y + 0.08, w: 2.3, h: 0.32, fontSize: 12, bold: true, color: C.tinta })
      if (novo) {
        s.addShape('roundRect', { x: px + pw - 1.05, y: y + 0.1, w: 0.62, h: 0.26, rectRadius: 0.05, fill: { color: C.marca }, line: { color: C.marca } })
        texto(s, 'NOVO', { x: px + pw - 1.05, y: y + 0.1, w: 0.62, h: 0.26, fontSize: 9, bold: true, color: C.branco, align: 'center', valign: 'middle' })
      }
      texto(s, motivo, { x: px + 0.8, y: y + 0.44, w: 3.3, h: 0.3, fontSize: 11, color: C.cinza })
      texto(s, onde, { x: px + 4.0, y: y + 0.44, w: 1.8, h: 0.3, fontSize: 10, color: C.cinzaClaro, align: 'right' })
    })
    s.addNotes(
      '[1:15–2:45] DEMO AO VIVO — operador troca para o painel (/painel?modo=demo).\n' +
        'Reparem: sem cadastro, sem instalar nada. Vocês podem escrever com as próprias palavras — a IA entende e pede confirmação. Quem escolheu atropelamento não vê pergunta de abandono.\n' +
        'Este é o painel do servidor. Olhem os casos de vocês chegando — e o sistema já colocou no topo o que é mais grave.\n' +
        '(abre um P1) Este aqui é crítico. E o sistema mostra o porquê. E vejam este alerta: já houve outra ocorrência a menos de 200 metros deste endereço. O plantonista da madrugada não precisa lembrar — o sistema lembra.\n' +
        '(atribui e registra providência) Quem enviou este caso: OLHE O SEU CELULAR AGORA.\n\n' +
        'PLANO B: se ninguém enviar em 30 s, o apoio envia o caso plantado. Se a demo falhar, usar o vídeo de backup e o mockup deste slide.',
    )
  }

  // ============ 7. POR QUE FUNCIONA ============
  {
    const s = pres.addSlide()
    s.background = { color: C.branco }
    titulo(s, 'A IA sugere. O cidadão confirma. As regras decidem.', null)
    // Celular com a confirmação da IA
    const t = celular(s, 0.7, 1.65, 3.3, 5.1)
    s.addShape('rect', { x: t.x, y: t.y + 0.25, w: t.w, h: 0.55, fill: { color: C.marca }, line: { color: C.marca } })
    texto(s, 'Central Animal', { x: t.x + 0.25, y: t.y + 0.25, w: 2.5, h: 0.55, fontSize: 12, bold: true, color: C.branco, valign: 'middle' })
    s.addShape('roundRect', { x: t.x + 0.9, y: t.y + 1.0, w: t.w - 1.05, h: 1.05, rectRadius: 0.12, fill: { color: C.marca }, line: { color: C.marca } })
    texto(s, 'bati num cachorro com o carro, ele tá vivo mas sangrando e não consegue levantar', {
      x: t.x + 1.0, y: t.y + 1.05, w: t.w - 1.25, h: 0.95, fontSize: 10, color: C.branco, valign: 'middle',
    })
    s.addShape('roundRect', { x: t.x + 0.15, y: t.y + 2.3, w: t.w - 0.3, h: 1.4, rectRadius: 0.1, fill: { color: 'F0FDFA' }, line: { color: C.menta } })
    texto(s, 'Interpretado pela IA', { x: t.x + 0.3, y: t.y + 2.4, w: 2.5, h: 0.3, fontSize: 10, bold: true, color: C.marca })
    texto(
      s,
      [
        { text: 'Situação  ', options: { color: C.cinza } },
        { text: 'Atropelamento', options: { bold: true, color: C.tinta, breakLine: true } },
        { text: 'Sinais  ', options: { color: C.cinza } },
        { text: 'Sangramento intenso, Não consegue se levantar', options: { bold: true, color: C.tinta } },
      ],
      { x: t.x + 0.3, y: t.y + 2.75, w: t.w - 0.6, h: 0.9, fontSize: 10.5, valign: 'top', paraSpaceAfter: 4 },
    )
    s.addShape('roundRect', { x: t.x + 0.15, y: t.y + 3.95, w: (t.w - 0.4) / 2, h: 0.5, rectRadius: 0.1, fill: { color: C.branco }, line: { color: C.cinzaClaro } })
    texto(s, 'Corrigir', { x: t.x + 0.15, y: t.y + 3.95, w: (t.w - 0.4) / 2, h: 0.5, fontSize: 11, color: C.tinta, align: 'center', valign: 'middle' })
    s.addShape('roundRect', { x: t.x + 0.25 + (t.w - 0.4) / 2, y: t.y + 3.95, w: (t.w - 0.4) / 2, h: 0.5, rectRadius: 0.1, fill: { color: C.marca }, line: { color: C.marca } })
    texto(s, '✓ Está certo', { x: t.x + 0.25 + (t.w - 0.4) / 2, y: t.y + 3.95, w: (t.w - 0.4) / 2, h: 0.5, fontSize: 11, bold: true, color: C.branco, align: 'center', valign: 'middle' })

    // Fluxo em 3 passos
    const fluxo = [
      [I.ia, C.marca, 'A IA sugere', 'Qwen rodando no próprio servidor entende o relato livre em ~4 s.'],
      [I.usuario, C.p2, 'O cidadão confirma', 'Um toque para confirmar ou corrigir. "Pessoa em risco" é sempre pergunta direta.'],
      [I.balanca, C.p1, 'As regras decidem', 'Sinal vital = Crítica, sem exceção. Todo caso mostra o motivo da prioridade.'],
    ]
    fluxo.forEach(([img, cor, t1, d], i) => {
      const y = 1.6 + i * 1.85
      circuloIcone(s, img, 4.55, y, 0.85, cor)
      texto(s, t1, { x: 5.6, y: y - 0.02, w: 3.3, h: 0.45, fontSize: 20, bold: true, color: C.tinta })
      texto(s, d, { x: 5.6, y: y + 0.45, w: 3.2, h: 1.0, fontSize: 13.5, color: C.cinza, valign: 'top' })
    })
    // 5 requisitos
    card(s, 9.2, 1.45, 3.45, 5.75)
    texto(s, 'O que a Prefeitura pediu', { x: 9.45, y: 1.65, w: 3.0, h: 0.4, fontSize: 15, bold: true, color: C.tinta })
    ;['Entrada única', 'Pré-triagem adaptativa', 'Classificação de prioridade', 'Encaminhamento', 'Rastreabilidade'].forEach((r, i) => {
      const y = 2.35 + i * 0.88
      s.addImage({ data: I.check, x: 9.45, y: y + 0.05, w: 0.38, h: 0.38 })
      texto(s, r, { x: 9.95, y, w: 2.6, h: 0.5, fontSize: 15, color: C.tinta, valign: 'middle' })
    })
    s.addNotes(
      '[2:45–3:15]\nA classificação não é uma caixa-preta. A IA entende o que a pessoa escreveu, mas quem decide a prioridade são regras claras, que a equipe técnica da Prefeitura pode revisar — e todo caso mostra o motivo da sua prioridade. Os cinco pontos que a Prefeitura pediu: atendidos.',
    )
  }

  // ============ 8. IMPACTO E VIABILIDADE ============
  {
    const s = pres.addSlide()
    s.background = { color: C.branco }
    titulo(s, 'O que muda — e como vamos medir.', 'Hoje nenhum desses números existe. Com a Central Animal, cada caso gera o dado.')
    const metricas = [
      [I.relogio, C.p1, 'Tempo até a primeira resposta', 'O problema central: medido em cada ocorrência.'],
      [I.alvo, C.p4, 'Casos com desfecho registrado', 'Meta proposta para o piloto: acima de 90%.'],
      [I.setas, C.p2, 'Encaminhamentos errados', 'A fragmentação vira número — e tende a zero.'],
    ]
    metricas.forEach(([img, cor, nome, desc], i) => {
      const x = 0.7 + i * 4.1
      card(s, x, 2.1, 3.85, 2.55)
      circuloIcone(s, img, x + 0.35, 2.4, 0.8, cor)
      texto(s, nome, { x: x + 0.35, y: 3.35, w: 3.2, h: 0.75, fontSize: 19, bold: true, color: C.tinta, valign: 'top' })
      texto(s, desc, { x: x + 0.35, y: 4.05, w: 3.25, h: 0.55, fontSize: 13, color: C.cinza, valign: 'top' })
    })
    texto(s, 'É viável', { x: 0.7, y: 5.05, w: 5, h: 0.45, fontSize: 20, bold: true, color: C.tinta })
    const viab = [
      [I.predio, 'Não cria órgão nem cargo'],
      [I.maos, 'Organiza o que já existe: o acordo "quem atende o quê"'],
      [I.chip, 'IA local: os dados não saem da Prefeitura'],
      [I.escudo, 'Denunciante protegido (LGPD)'],
    ]
    viab.forEach(([img, t1], i) => {
      const x = 0.7 + i * 3.08
      s.addShape('roundRect', { x, y: 5.65, w: 2.9, h: 1.25, rectRadius: 0.1, fill: { color: 'F0FDFA' }, line: { color: C.menta } })
      s.addImage({ data: img, x: x + 0.22, y: 5.95, w: 0.55, h: 0.55 })
      texto(s, t1, { x: x + 0.95, y: 5.7, w: 1.85, h: 1.15, fontSize: 13, bold: true, color: C.noite, valign: 'middle' })
    })
    s.addNotes(
      '[3:15–3:40]\nMedimos o que importa: quanto tempo até a primeira resposta, quantos casos chegam ao fim, quantos são encaminhados para o lugar errado.\nE é viável: não cria órgão nem cargo. Organiza o que já existe. A peça mais importante é um acordo sobre quem atende o quê — e o sistema torna esse acordo operacional. A IA roda no servidor da Prefeitura, e quem denuncia maus-tratos tem a identidade protegida.',
    )
  }

  // ============ 9. PILOTO + FECHAMENTO ============
  {
    const s = pres.addSlide()
    s.background = { color: C.noite }
    titulo(s, 'Próximo passo: piloto de 90 dias', 'Com a Secretaria de Meio Ambiente, medindo tudo antes e depois.', true)
    const fases = [
      ['Semanas 1–2', 'Pactuar', 'Quem atende o quê, em quanto tempo. Regras revisadas por veterinário.'],
      ['Semanas 3–4', 'Implantar', 'Painel no setor. QR Codes em clínicas, escolas e pontos de ônibus.'],
      ['Semanas 5–12', 'Operar', 'Operação real, com medição semanal.'],
      ['Semana 13', 'Avaliar', 'Comparar com a linha de base e decidir ampliar.'],
    ]
    const cores = [C.p4, C.p3, C.p2, C.p1]
    s.addShape('line', { x: 1.125, y: 2.625, w: 9.15, h: 0, line: { color: '2DD4BF', width: 2 } })
    fases.forEach(([quando, nome, desc], i) => {
      const x = 0.8 + i * 3.05
      s.addShape('ellipse', { x: x + 0.1, y: 2.4, w: 0.45, h: 0.45, fill: { color: cores[i] }, line: { color: C.noite, width: 3 } })
      texto(s, quando, { x, y: 3.05, w: 2.8, h: 0.35, fontSize: 13, color: C.mentaSuave })
      texto(s, nome, { x, y: 3.4, w: 2.8, h: 0.5, fontSize: 22, bold: true, color: C.branco })
      texto(s, desc, { x, y: 3.95, w: 2.75, h: 0.9, fontSize: 13.5, color: C.menta, valign: 'top' })
    })
    texto(s, 'Ninguém precisa saber para quem ligar.\nSó precisa querer ajudar.', {
      x: 0.8, y: 5.25, w: 8.6, h: 1.4, fontFace: TITULO, fontSize: 32, bold: true, color: C.branco, valign: 'middle',
    })
    s.addShape('roundRect', { x: 10.45, y: 5.05, w: 1.9, h: 1.9, rectRadius: 0.12, fill: { color: C.branco }, line: { color: C.branco } })
    s.addImage({ data: I.qr, x: 10.55, y: 5.15, w: 1.7, h: 1.7 })
    texto(s, 'Obrigado!', { x: 10.2, y: 7.0, w: 2.4, h: 0.35, fontSize: 14, bold: true, color: C.mentaSuave, align: 'center' })
    s.addNotes(
      '[3:40–4:00]\nPropomos um piloto de 90 dias com a Secretaria de Meio Ambiente, medindo tudo antes e depois.\nHoje, quem quer ajudar um animal precisa descobrir sozinho o que fazer. Com a Central Animal, ninguém mais precisa saber para quem ligar — só precisa querer ajudar.\n\n(Dizer a última frase inteira, mesmo com o tempo apertado.)',
    )
  }

  // ============ APOIO ============
  function apoio(t1) {
    const s = pres.addSlide()
    s.background = { color: C.branco }
    texto(s, 'APOIO · PERGUNTAS DA BANCA', { x: 0.7, y: 0.35, w: 8, h: 0.3, fontSize: 12, bold: true, color: C.marca, charSpacing: 2 })
    texto(s, t1, { x: 0.7, y: 0.7, w: 11.9, h: 0.8, fontFace: TITULO, fontSize: 32, bold: true, color: C.tinta })
    return s
  }

  // B1 Arquitetura
  {
    const s = apoio('Como funciona por dentro')
    const caixas = [
      [I.celular, 'Celular do cidadão', 'QR Code ou link · sem instalar nada', 0.7, 2.2],
      [I.nuvem, 'Túnel HTTPS', 'Link fixo · endereço público', 3.85, 2.2],
      [I.servidor, 'API', 'Triagem recalculada no servidor · histórico por proximidade', 7.0, 2.2],
      [I.banco, 'PostgreSQL', 'Ocorrências, linha do tempo, auditoria da IA', 7.0, 4.55],
      [I.cerebro, 'IA local (Qwen)', 'Interpreta relato, resume, descreve foto', 10.15, 2.2],
      [I.monitor, 'Painel do servidor', 'Fila por prioridade, ações, mapa', 3.85, 4.55],
    ]
    caixas.forEach(([img, t1, d, x, y]) => {
      card(s, x, y, 2.5, 1.85)
      circuloIcone(s, img, x + 0.25, y + 0.25, 0.65, C.marca)
      texto(s, t1, { x: x + 1.05, y: y + 0.28, w: 1.4, h: 0.6, fontSize: 15, bold: true, color: C.tinta, valign: 'middle' })
      texto(s, d, { x: x + 0.25, y: y + 1.0, w: 2.1, h: 0.75, fontSize: 11.5, color: C.cinza, valign: 'top' })
    })
    const seta = (x, y, w, h) => s.addShape('line', { x, y, w, h, line: { color: C.cinzaClaro, width: 2, endArrowType: 'triangle' } })
    seta(3.3, 3.12, 0.45, 0)
    seta(6.45, 3.12, 0.45, 0)
    seta(9.6, 3.12, 0.45, 0)
    seta(8.25, 4.15, 0, 0.3)
    seta(6.45, 5.47, 0.45, 0)
    texto(s, 'Stack aberta, sem licenças: React · Fastify · PostgreSQL · Ollama. Roda em um computador comum; a IA não envia dados para fora.', {
      x: 0.7, y: 6.7, w: 11.9, h: 0.4, fontSize: 13, color: C.cinza, italic: true,
    })
    s.addNotes('Se perguntarem custo: tecnologia aberta, sem licença. Um servidor comum. O maior custo é organizacional — pactuar o fluxo entre os órgãos.')
  }

  // B2 Prioridades
  {
    const s = apoio('Níveis de prioridade e rotas especiais')
    const cab = { bold: true, color: C.branco, fill: { color: C.noite }, fontSize: 13 }
    const linha = (cor, n, crit, prazo) => [
      { text: n, options: { bold: true, color: C.branco, fill: { color: cor }, fontSize: 13 } },
      { text: crit, options: { fontSize: 12, color: C.tinta } },
      { text: prazo, options: { fontSize: 12, color: C.tinta } },
    ]
    s.addTable(
      [
        [{ text: 'Nível', options: cab }, { text: 'Critério', options: cab }, { text: 'Resposta*', options: cab }],
        linha(C.p1, 'P1 · Crítica', 'Qualquer sinal vital (sangramento, respiração, inconsciência, convulsão), atropelamento, envenenamento, maus-tratos em flagrante, risco a pessoas', 'Imediata'),
        linha(C.p2, 'P2 · Alta', 'Ferido sem sinal vital, maus-tratos sem flagrante, silvestre ferido', 'Mesmo dia'),
        linha(C.p3, 'P3 · Média', 'Abandono com filhotes, silvestre avistado, outras situações', 'Até 72 h'),
        linha(C.p4, 'P4 · Baixa', 'Abandono sem risco, animal morto na via', 'Programada'),
      ],
      { x: 0.7, y: 1.75, w: 7.6, colW: [1.5, 4.7, 1.4], border: { type: 'solid', color: C.borda, pt: 1 }, fontFace: CORPO, valign: 'middle', rowH: 0.62 },
    )
    texto(s, '* Prazos propostos, a pactuar com a Prefeitura.', { x: 0.7, y: 5.1, w: 7.6, h: 0.3, fontSize: 11, color: C.cinzaClaro, italic: true })
    card(s, 8.7, 1.75, 3.95, 4.9)
    texto(s, 'Regras de segurança', { x: 8.95, y: 1.95, w: 3.5, h: 0.4, fontSize: 16, bold: true, color: C.tinta })
    texto(
      s,
      [
        { text: 'Sinal vital = P1, sem exceção.', options: { bullet: true, breakLine: true } },
        { text: 'Na dúvida, a prioridade sobe — nunca desce.', options: { bullet: true, breakLine: true } },
        { text: '"Pessoa em risco" nunca vem da IA: é sempre a primeira pergunta.', options: { bullet: true, breakLine: true } },
        { text: 'Servidor pode reclassificar, com justificativa registrada.', options: { bullet: true, breakLine: true } },
        { text: 'Rotas especiais: SAMU/Bombeiros (pessoa), fauna silvestre (IAT/Bombeiros) e polícia (crime).', options: { bullet: true } },
      ],
      { x: 8.95, y: 2.45, w: 3.5, h: 4.0, fontSize: 13, color: C.cinza, valign: 'top', paraSpaceAfter: 8 },
    )
  }

  // B3 Competência
  {
    const s = apoio('Quem atende o quê (proposta a pactuar)')
    const cab = { bold: true, color: C.branco, fill: { color: C.noite }, fontSize: 13 }
    const dados = [
      ['Pessoa em risco', 'SAMU 192 / Bombeiros 193'],
      ['Animal silvestre com risco (ex.: cobra em casa)', 'Corpo de Bombeiros 193'],
      ['Animal silvestre sem risco imediato / ferido', 'IAT / Polícia Ambiental'],
      ['Maus-tratos em flagrante', 'Polícia Militar 190 + Secretaria de Meio Ambiente'],
      ['Maus-tratos (denúncia)', 'Secretaria de Meio Ambiente'],
      ['Suspeita de envenenamento', 'Plantão veterinário + Vigilância Sanitária'],
      ['Atropelado / ferido', 'Plantão veterinário conveniado + Meio Ambiente'],
      ['Abandono', 'Bem-estar animal + rede de protetores'],
      ['Animal morto na via', 'Serviços Urbanos'],
    ]
    s.addTable(
      [[{ text: 'Situação', options: cab }, { text: 'Serviço acionado', options: cab }], ...dados.map(([a, b]) => [{ text: a, options: { fontSize: 13, color: C.tinta, bold: true } }, { text: b, options: { fontSize: 13, color: C.cinza } }])],
      { x: 0.7, y: 1.7, w: 11.9, colW: [5.4, 6.5], border: { type: 'solid', color: C.borda, pt: 1 }, fontFace: CORPO, valign: 'middle', rowH: 0.48 },
    )
    texto(s, 'O valor do produto está em pactuar esta tabela: o software torna o acordo operacional.', { x: 0.7, y: 6.75, w: 11.9, h: 0.35, fontSize: 13, color: C.marca, italic: true })
  }

  // B4 LGPD e riscos
  {
    const s = apoio('LGPD, riscos e como mitigamos')
    const cols = [
      [
        'Dados e LGPD',
        [
          'Relato anônimo permitido; contato só para retorno',
          'Denunciante de maus-tratos nunca é exposto ao denunciado',
          'Dados mínimos: o quê, onde, quando',
          'Base legal: execução de política pública (art. 7º, III)',
          'IA local: nenhum dado vai para serviços externos',
        ],
      ],
      [
        'Riscos e mitigação',
        [
          'Sem plantão, a triagem entrega o caso a uma porta fechada → pactuar plantão ou rede credenciada',
          'IA erra → cidadão confirma e regras decidem; IA lenta → chat segue por botões',
          'Trotes → limite por dispositivo e marcação como improcedente',
          'Orientações clínicas → validação por médico-veterinário antes do piloto',
        ],
      ],
    ]
    cols.forEach(([t1, itens], i) => {
      const x = 0.7 + i * 6.1
      card(s, x, 1.75, 5.85, 3.9)
      texto(s, t1, { x: x + 0.35, y: 1.95, w: 5.2, h: 0.45, fontSize: 20, bold: true, color: C.tinta })
      texto(
        s,
        itens.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < itens.length - 1 } })),
        { x: x + 0.35, y: 2.55, w: 5.2, h: 2.95, fontSize: 15, color: C.cinza, valign: 'top', paraSpaceAfter: 10 },
      )
    })
  }

  // B5 Como a IA decide — a árvore que o Qwen preenche (api/src/llm.ts + packages/triagem)
  {
    const s = apoio('Como a IA decide — e quando ela pergunta de volta')
    const seta = (x, y, w, h, o = {}) =>
      s.addShape('line', { x, y, w, h, flipH: o.flipH, flipV: o.flipV, line: { color: C.cinza, width: 1.75, endArrowType: o.sem ? undefined : 'triangle' } })
    const fio = (x, y, w, h) => s.addShape('line', { x, y, w, h, line: { color: C.cinzaClaro, width: 1.25 } })

    // --- Fluxo: relato → Qwen → tem certeza? → cidadão confirma ---
    const Y = 1.7
    const H = 1.15
    const meio = Y + H / 2
    const passo = (img, cor, t1, d, x, w) => {
      card(s, x, Y, w, H)
      circuloIcone(s, img, x + 0.2, Y + 0.18, 0.5, cor)
      texto(s, t1, { x: x + 0.82, y: Y + 0.18, w: w - 0.95, h: 0.5, fontSize: 15, bold: true, color: C.tinta, valign: 'middle' })
      texto(s, d, { x: x + 0.2, y: Y + 0.74, w: w - 0.35, h: 0.36, fontSize: 11, color: C.cinza, valign: 'top' })
    }
    passo(I.celular, C.marca, 'Relato livre', '“tem um bicho estranho no quintal”', 0.7, 2.45)
    seta(3.15, meio, 0.33, 0)
    passo(I.cerebro, C.marca, 'IA local (Qwen)', 'escolhe um dos 10 casos da árvore e os sinais citados', 3.5, 2.85)
    seta(6.35, meio, 0.33, 0)
    // Losango: a certeza é medida (probabilidade do caso escolhido), não a opinião do modelo
    s.addShape('diamond', { x: 6.7, y: Y - 0.03, w: 2.2, h: H + 0.06, fill: { color: C.noite }, line: { color: C.noite } })
    texto(s, [
      { text: 'Tem certeza?', options: { fontSize: 14, bold: true, color: C.branco, breakLine: true } },
      { text: '≥ 80%', options: { fontSize: 11, color: C.mentaSuave } },
    ], { x: 6.9, y: Y + 0.2, w: 1.8, h: 0.75, align: 'center', valign: 'middle' })
    seta(8.9, meio, 0.28, 0)
    texto(s, 'sim', { x: 8.86, y: meio - 0.34, w: 0.4, h: 0.26, fontSize: 11, bold: true, color: C.p4, align: 'center' })
    passo(I.usuario, C.marca, 'Cidadão confirma', '“Entendi assim. Está certo?” · Corrigir volta à IA', 9.18, 3.45)

    // "não" → pergunta de volta, e a resposta volta para o Qwen
    seta(7.8, Y + H + 0.03, 0, 0.3)
    texto(s, [
      { text: 'não', options: { bold: true, color: C.p2 } },
      { text: ' — e a dúvida muda a prioridade', options: { color: C.cinza } },
    ], { x: 7.9, y: Y + H + 0.02, w: 2.6, h: 0.26, fontSize: 10.5 })
    const P = { x: 6.55, y: 3.2, w: 2.5, h: 0.8 }
    s.addShape('roundRect', { ...P, rectRadius: 0.1, fill: { color: 'F0FDFA' }, line: { color: C.marcaClara, width: 1.25 } })
    texto(s, [
      { text: 'Pergunta de volta', options: { fontSize: 12.5, bold: true, color: C.marca, breakLine: true } },
      { text: '“É um animal silvestre ou precisa de resgate?”', options: { fontSize: 10, italic: true, color: C.tinta } },
    ], { x: P.x + 0.15, y: P.y + 0.08, w: P.w - 0.3, h: P.h - 0.16, valign: 'middle' })
    const xQwen = 3.5 + 2.85 / 2
    seta(xQwen, P.y + P.h / 2, P.x - xQwen, 0, { sem: true })
    seta(xQwen, Y + H, 0, P.y + P.h / 2 - (Y + H), { flipV: true })
    texto(s, 'a resposta volta para a IA\n(até 2 rodadas)', { x: xQwen + 0.12, y: P.y + P.h / 2 + 0.04, w: 2.0, h: 0.4, fontSize: 10, color: C.cinza })
    // Perguntas que não dependem da certeza da IA
    texto(s, [
      { text: 'Pergunta sempre, mesmo com certeza:', options: { bold: true, color: C.tinta, breakLine: true } },
      { text: 'citou pessoa ferida → “Alguém está em risco agora?”', options: { breakLine: true } },
      { text: '“morto”, mas com sinal de vida → “Ainda está vivo?”' },
    ], { x: 0.7, y: 3.12, w: 3.35, h: 0.85, fontSize: 10.5, color: C.cinza, valign: 'top' })

    // --- Árvore: os 10 casos que o Qwen pode escolher, com a prioridade que as regras dão ---
    const folhas = [
      ['Atropelado', 1, 'veículo envolvido'],
      ['Ferido ou doente', 2, 'sem veículo'],
      ['Envenenado', 1, 'veneno ou isca'],
      ['Maus-tratos', 2, 'flagrante → P1 + PM'],
      ['Abandonado', 4, 'com filhotes → P3'],
      ['Morto na via', 4, 'Serviços Urbanos'],
      ['Outra situação', 3, 'resgate, animal bravo'],
      ['Perto de pessoas', 1, 'Bombeiros + IAT'],
      ['Ferido', 2, 'IAT / Pol. Ambiental'],
      ['Só avistado', 3, 'sem risco'],
    ]
    const COR = { 1: C.p1, 2: C.p2, 3: C.p3, 4: C.p4 }
    const NIVEL = { 1: 'Crítica', 2: 'Alta', 3: 'Média', 4: 'Baixa' }
    const L = 1.083
    const xFolha = (i) => 0.7 + i * (L + 0.1) + (i >= 7 ? 0.2 : 0)
    const centro = (i) => xFolha(i) + L / 2
    const grupos = [
      ['Animal doméstico', 0, 6],
      ['Animal silvestre', 7, 9],
    ]
    const yBarra = 4.25
    const yGrupo = 4.4
    const yPente = 4.86
    const yFolha = 4.98
    const xDom = (xFolha(0) + xFolha(6) + L) / 2
    const xSil = (xFolha(7) + xFolha(9) + L) / 2
    // O caso confirmado desce do cartão do cidadão e se divide entre doméstico e silvestre
    seta(xSil, Y + H, 0, yBarra - (Y + H), { sem: true })
    texto(s, 'as regras decidem\na prioridade', { x: xSil - 2.05, y: 3.35, w: 1.9, h: 0.5, fontSize: 11.5, bold: true, color: C.noite, align: 'right' })
    fio(xDom, yBarra, xSil - xDom, 0)
    s.addShape('ellipse', { x: xSil - 0.06, y: yBarra - 0.06, w: 0.12, h: 0.12, fill: { color: C.cinza }, line: { color: C.cinza } })
    fio(xDom, yBarra, 0, yGrupo - yBarra)
    fio(xSil, yBarra, 0, yGrupo - yBarra)
    for (const [nome, a, b] of grupos) {
      const x = xFolha(a)
      const w = xFolha(b) + L - x
      s.addShape('roundRect', { x, y: yGrupo, w, h: 0.32, rectRadius: 0.16, fill: { color: C.noite }, line: { color: C.noite } })
      texto(s, nome, { x, y: yGrupo, w, h: 0.32, fontSize: 12, bold: true, color: C.branco, align: 'center', valign: 'middle' })
      fio(x + w / 2, yGrupo + 0.32, 0, yPente - yGrupo - 0.32)
      fio(centro(a), yPente, centro(b) - centro(a), 0)
      for (let i = a; i <= b; i++) fio(centro(i), yPente, 0, yFolha - yPente)
    }
    folhas.forEach(([nome, p, nota], i) => {
      const x = xFolha(i)
      card(s, x, yFolha, L, 1.15, C.branco)
      s.addShape('rect', { x, y: yFolha, w: L, h: 0.3, fill: { color: COR[p] }, line: { color: COR[p] } })
      texto(s, `P${p} · ${NIVEL[p]}`, { x, y: yFolha, w: L, h: 0.3, fontSize: 9.5, bold: true, color: p === 1 ? C.branco : C.tinta, align: 'center', valign: 'middle' })
      texto(s, nome, { x: x + 0.06, y: yFolha + 0.34, w: L - 0.12, h: 0.42, fontSize: 11, bold: true, color: C.tinta, align: 'center', valign: 'middle' })
      texto(s, nota, { x: x + 0.06, y: yFolha + 0.76, w: L - 0.12, h: 0.36, fontSize: 9, color: C.cinza, align: 'center', valign: 'top' })
    })

    // --- Regras que valem para qualquer folha ---
    card(s, 0.7, 6.27, 11.93, 0.5)
    texto(s, [
      { text: 'Sinal vital citado — sangramento, falta de ar, inconsciência ou convulsão — leva qualquer caso a ' },
      { text: 'P1', options: { bold: true, color: C.p1 } },
      { text: '.  Não levanta ou vômito: no mínimo ' },
      { text: 'P2', options: { bold: true, color: C.p2 } },
      { text: '.  Sinal que só a IA deduziu, o cidadão confirma com um toque.' },
    ], { x: 0.9, y: 6.27, w: 11.55, h: 0.5, fontSize: 11.5, color: C.tinta, valign: 'middle' })
    texto(s, 'Nunca vêm da IA: pessoa em risco, flagrante e filhotes. IA lenta ou fora do ar → a mesma árvore, em botões.', {
      x: 0.7, y: 6.88, w: 11.93, h: 0.32, fontSize: 11.5, color: C.cinza, italic: true,
    })
    s.addNotes(
      'Se perguntarem como a IA funciona:\n' +
        'A IA não inventa categorias: ela só escolhe um destes 10 casos e os sinais que a pessoa citou. E ela mede a própria dúvida — não é a opinião do modelo, é a probabilidade que ele deu à resposta. Abaixo de 80%, e só se a dúvida mudar a prioridade, ela pergunta de volta, no máximo duas vezes. ' +
        'O cidadão confirma, e as cores vêm das regras, não da IA. Testamos com 63 relatos difíceis — gíria, negação, inglês, emoji, tentativa de enganar a IA: 63 de 63.',
    )
  }

  const saida = path.join(__dirname, 'Central-Animal-Pitch.pptx')
  await pres.writeFile({ fileName: saida })
  console.log('Gerado:', saida)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
