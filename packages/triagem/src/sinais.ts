// Detecção de sinais por palavra-chave — camada determinística que complementa a IA.
// A IA às vezes esquece um sinal citado com todas as letras ("sangrando"); aqui isso não acontece.
// O resultado final é a UNIÃO das duas camadas: na dúvida, a prioridade sobe.

// Sem o "no" espanhol: em português "no" é preposição ("no sol, ofegante"). Relato em espanhol negado erra
// para o lado seguro (sobe a prioridade).
const NEGACAO = /(^|\s)(n[ãa]o|nao|n|nem|sem|nunca)(?=\s|$)/

type Regra = { sinal: string; padroes: RegExp[]; ignoraNegacao?: boolean }

const REGRAS: Regra[] = [
  { sinal: 'sangramento', padroes: [/\bsangr\w*/, /\bsangue\b/, /\bhemorrag\w*/] },
  { sinal: 'respiracao', padroes: [/\brespir\w*/, /\bofeg\w*/, /\bfalta de ar\b/, /\bsufoc\w*/, /\bn[ãa]o respira\w*/, /\bno respira\w*/] },
  { sinal: 'inconsciente', padroes: [/\bdesmai\w*/, /\bdesacordad\w*/, /\binconscien\w*/, /\bn[ãa]o reage\b/, /\bn[ãa]o responde\b/, /\bdesmay\w*/] },
  { sinal: 'convulsao', padroes: [/\bconvuls\w*/, /\btrem(e|endo|ia|eu|or|ores|edeira)\b/, /\bespasm\w*/, /\bconvulsi\w*/] },
  { sinal: 'vomito', padroes: [/\bv[ôo]mit\w*/, /\bbab(a|ando|ou|eira)\b/, /\bsaliv\w*/, /\bespum\w*/] },
  // Já é uma negação por natureza ("não consegue levantar") — não aplicar o filtro de negação.
  {
    sinal: 'nao_levanta',
    ignoraNegacao: true,
    padroes: [
      /\b(n[ãa]o|nao|n)\s+(consegue|conseguia|t[áa]\s+conseguindo|est[áa]\s+conseguindo|pode)\s+(se\s+)?(levantar|andar|ficar\s+em\s+p[ée]|mexer\s+as\s+patas)(?=\s)/,
      /\b(n[ãa]o|nao|n)\s+(levanta|anda|para\s+em\s+p[ée]|fica\s+em\s+p[ée])(?=\s)/,
      /\bno\s+puede\s+(levantarse|caminar|pararse)(?=\s)/,
      /\bperna\s+quebrada\b/,
      /\bpata\s+quebrada\b/,
    ],
  },
]

function normalizar(texto: string) {
  return ' ' + texto.toLowerCase().replace(/[.,;!?()"]/g, ' ').replace(/\s+/g, ' ') + ' '
}

/** Sinais citados explicitamente no relato, respeitando negações ("não está sangrando"). */
export function detectarSinais(texto: string): string[] {
  const t = normalizar(texto)
  const achados = new Set<string>()
  for (const regra of REGRAS) {
    for (const padrao of regra.padroes) {
      const global = new RegExp(padrao.source, 'g')
      for (const m of t.matchAll(global)) {
        if (!regra.ignoraNegacao) {
          // Olha até 3 palavras antes: "não está sangrando", "sem sangue", "no está sangrando".
          const antes = t.slice(0, m.index).trim().split(' ').slice(-3).join(' ')
          if (NEGACAO.test(antes)) continue
        }
        achados.add(regra.sinal)
      }
    }
  }
  return [...achados]
}

// ---------- Correção determinística da categoria sugerida pela IA ----------

const ATROPELAMENTO = /\b(atropel\w*|atropell\w*|bat(i|eu|eram|emos)\s+(n[oa]|com\s+o\s+carro|com\s+a\s+moto)|(carro|moto|caminh[ãa]o|[ôo]nibus)\s+(pegou|passou\s+por\s+cima|bateu))/
const VENENO = /\b(envenen\w*|venen\w*|chumbinho|isca\s+envenenada)\b/
const DOMESTICO = /\b(c[ãa]o|c[ãa]es|cachorr\w*|cadel\w*|filhot\w+\s+de\s+(c[ãa]o|cachorro|gato)|gat[oa]s?|gatinh\w*|dog|perr[oa]s?|cavalo|[ée]gua|vaca|boi|galinha|porco|coelho)\b/
const SILVESTRE = /\b(cobra|serpente|jararaca|coral|cascavel|sucuri|passar\w*|p[áa]ssaro|ave|coruja|gavi[ãa]o|papagaio|tucano|gamb[áa]|capivara|macaco|bugio|sagui|tatu|lagarto|te[íi]u|ouri[çc]o|quati|veado|raposa|morcego|jacar[ée]|tartaruga|jabuti)\b/

/**
 * Ajusta o "caso" sugerido pela IA quando o próprio texto contradiz a sugestão.
 * Regras simples, explicáveis e testadas — a IA erra de forma inconsistente; isto não.
 */
export function corrigirCaso(caso: string, texto: string): string {
  const t = normalizar(texto)
  const silvestreNoTexto = SILVESTRE.test(t)
  // "gato na árvore" não é silvestre: bicho doméstico citado e nenhum silvestre no texto.
  if (caso.startsWith('silvestre_') && !silvestreNoTexto && DOMESTICO.test(t)) {
    caso = caso === 'silvestre_ferido' ? 'ferido' : 'outro'
  }
  if (!caso.startsWith('silvestre_')) {
    if (ATROPELAMENTO.test(t) && ['ferido', 'outro', 'abandono'].includes(caso)) return 'atropelamento'
    if (VENENO.test(t) && ['ferido', 'outro', 'maus_tratos'].includes(caso)) return 'envenenamento'
  }
  return caso
}
