// Detecção de sinais por palavra-chave — camada determinística que complementa a IA.
// A IA às vezes esquece um sinal citado com todas as letras ("sangrando"); aqui isso não acontece.
// O resultado final é a UNIÃO das duas camadas: na dúvida, a prioridade sobe.

// Sem o "no" espanhol: em português "no" é preposição ("no sol, ofegante"). Relato em espanhol negado erra
// para o lado seguro (sobe a prioridade).
const NEGACAO = /(^|\s)(n[ãa]o|nao|n|ñ|nem|sem|nunca|jamais|not|isn'?t|wasn'?t|doesn'?t)(?=\s|$)/
// Negação dupla: "não para de sangrar", "não parou de tremer" — o sinal está presente, e forte.
const CONTINUA = /(^|\s)(n[ãa]o|nao|n|nem)\s+(para|p[áa]ra|parou|parava|deixa|deixou)\s+de$/
// "parou de sangrar", "deixou de vomitar" — o sinal passou.
const PAROU = /(^|\s)(parou|parava|deixou|para|p[áa]ra)\s+de$/
// "nunca vi tanto sangue" — a negação é do "ver", não do sangue.
const ENFASE = /(^|\s)(tanto|tanta|tamanho|tamanha)(\s|$)/

/**
 * negavel: "não está sangrando" apaga o sinal (padrão).
 * fixo: o próprio padrão já traz a negação ("não reage", "sem reação").
 * agrava: só conta quando negado — "não respira", "não consegue respirar", "parou de respirar" são o sinal;
 *         "ainda está respirando" não é.
 */
type Padrao = { re: RegExp; modo?: 'negavel' | 'fixo' | 'agrava' }
type Regra = { sinal: string; padroes: Padrao[] }

const fixo = (re: RegExp): Padrao => ({ re, modo: 'fixo' })

const REGRAS: Regra[] = [
  // Português primeiro; inglês e espanhol básicos para visitante (o resto fica com a IA).
  {
    sinal: 'sangramento',
    padroes: [{ re: /\bsangr\w*/ }, { re: /\bsangue\b/ }, { re: /\bhemorrag\w*/ }, { re: /\b(bleed\w*|blood\w*)/ }, { re: /🩸/ }],
  },
  {
    sinal: 'respiracao',
    padroes: [
      { re: /\bofeg\w*/ },
      { re: /\bfalta\s+de\s+ar\b/ },
      { re: /\bsufoc\w*/ },
      { re: /\barfa(ndo|nte)\b/ },
      { re: /\bengasg\w*/ },
      { re: /\brespir\w*\s+(muito\s+|bem\s+|super\s+|meio\s+)?(com\s+(muita\s+|bastante\s+)?dificuldade|mal|fraco|fraquinho|r[áa]pido|acelerad\w*|pesad\w*|estranho|ofegante)/ },
      { re: /\bdificuldades?\s+(para|pra|de|em)\s+respirar\b/ },
      { re: /\brespira[çc][ãa]o\s+(fraca|dif[íi]cil|pesada|acelerada|ofegante|r[áa]pida|curta|estranha)/ },
      fixo(/\bmal\s+respira\w*/),
      fixo(/\bn[ãa]o\s+sei\s+se\s+(est[áa]|t[áa]|ainda)\s+respira\w*/),
      fixo(/\bno\s+respira\w*/),
      fixo(/\b(not\s+breathing|can'?t\s+breathe|trouble\s+breathing|struggling\s+to\s+breathe)\b/),
      // Verbo negado: "não respira", "não está respirando", "não consegue respirar", "parou de respirar".
      { re: /\brespir\w*/, modo: 'agrava' },
    ],
  },
  {
    sinal: 'inconsciente',
    padroes: [
      { re: /\bdesmai\w*/ },
      { re: /\bdesacordad\w*/ },
      { re: /\binconscien\w*/ },
      { re: /\bdesfalec\w*/ },
      { re: /\bdesmay\w*/ },
      fixo(/\bn[ãa]o\s+(reage|responde|acorda\w*)\b/),
      fixo(/\bn[ãa]o\s+(se\s+)?(mexe|move|movimenta)\b/),
      fixo(/\bsem\s+(rea[çc][ãa]o|reagir|se\s+mexer|se\s+mover)\b/),
      fixo(/\bn[ãa]o\s+(tem|teve)\s+rea[çc][ãa]o\b/),
      { re: /\b(unconscious|passed\s+out|fainted)\b/ },
    ],
  },
  {
    sinal: 'convulsao',
    padroes: [
      { re: /\bconvuls\w*/ },
      { re: /\bconvulsi\w*/ },
      { re: /\btrem(e|er|endo|ia|eu|em|iam|or|ores|edeira|elique\w*)\b/ },
      { re: /\bespasm\w*/ },
      { re: /\bepil[ée]p\w*/ },
      { re: /\b(seiz\w*|shaking|trembling)\b/ },
    ],
  },
  {
    sinal: 'vomito',
    padroes: [{ re: /\bv[ôo]mit\w*/ }, { re: /\bbab(a|ando|ou|eira)\b/ }, { re: /\bsaliv\w*/ }, { re: /\bespum\w*/ }, { re: /\b(vomit\w*|drool\w*|foam\w*)/ }],
  },
  // Já é uma negação por natureza ("não consegue levantar") — não aplicar o filtro de negação.
  {
    sinal: 'nao_levanta',
    padroes: [
      fixo(/\b(n[ãa]o|nao|n)\s+(consegue|conseguia|t[áa]\s+conseguindo|est[áa]\s+conseguindo|pode)\s+(se\s+)?(levantar|andar|ficar\s+em\s+p[ée]|mexer\s+as\s+patas)(?=\s)/),
      fixo(/\b(n[ãa]o|nao|n)\s+(levanta|anda|para\s+em\s+p[ée]|fica\s+em\s+p[ée])(?=\s)/),
      fixo(/\bsem\s+conseguir\s+(se\s+)?(levantar|andar|ficar\s+em\s+p[ée])(?=\s)/),
      fixo(/\bno\s+puede\s+(levantarse|caminar|pararse)(?=\s)/),
      fixo(/\barrast\w*\s+(as\s+)?(patas|pernas)\b/),
      fixo(/\b(pata|patas|perna|pernas)\s+(traseiras?\s+)?(quebrad\w*|fraturad\w*|paralisad\w*)\b/),
      fixo(/\bparalisad[oa]s?\b/),
      fixo(/\bcan'?t\s+(stand|walk|get\s+up)\b/),
    ],
  },
]

/** Minúsculas, e fim de oração vira fronteira "|": a negação de uma frase não vale para a seguinte. */
function normalizar(texto: string) {
  return (
    ' ' +
    texto
      .toLowerCase()
      .replace(/[.;!?,\n]+/g, ' | ')
      .replace(/[()"“”]/g, ' ')
      .replace(/\s+/g, ' ') +
    ' '
  )
}

/** Até 3 palavras antes do achado, sem atravessar a fronteira de oração. */
function janela(t: string, indice: number): string {
  const antes = t.slice(0, indice)
  return antes
    .slice(antes.lastIndexOf('|') + 1)
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(-3)
    .join(' ')
}

function presente(p: Padrao, j: string): boolean {
  const modo = p.modo ?? 'negavel'
  if (modo === 'fixo') return true
  const negado = NEGACAO.test(j) || PAROU.test(j)
  if (modo === 'agrava') return negado
  if (CONTINUA.test(j) || ENFASE.test(j)) return true
  return !negado
}

/** Sinais citados explicitamente no relato, respeitando negações ("não está sangrando"). */
export function detectarSinais(texto: string): string[] {
  const t = normalizar(texto)
  const achados = new Set<string>()
  for (const regra of REGRAS) {
    for (const padrao of regra.padroes) {
      for (const m of t.matchAll(new RegExp(padrao.re.source, 'g'))) {
        if (presente(padrao, janela(t, m.index))) {
          achados.add(regra.sinal)
          break
        }
      }
    }
  }
  return [...achados]
}

// ---------- Pessoa em risco citada no relato ----------

const PESSOA =
  '(pessoas?|gente|crian[çc]as?|beb[êe]s?|menin[oa]s?|filh[oa]s?|m[ãa]e|pai|av[óô]s?|v[óô]|irm[ãa]o?s?|marido|esposa|mulher|homem|senhor[a]?|idos[oa]s?|vizinh[oa]s?|mo[çc][oa]|morador(es)?|algu[ée]m|motorista|motoqueiro|ciclista|pedestre)'
// Pessoa como sujeito, não como dona do animal: "o cachorro DO VIZINHO está ferido" fala do cachorro.
const PESSOA_SUJEITO = `(?<!\\b(d[aeo]s?|de)\\s+((minha|meu|minhas|meus|sua|seu|nossa|nosso)\\s+)?)${PESSOA}`
const ATAQUE = '(mordeu|morderam|mordendo|morde|picou|picaram|atacou|atacaram|atacando|ataca|avan[çc]ou|avan[çc]ando|arranhou|feriu|machucou)'
const PALAVRAS = (n: number) => `([^\\s|]+\\s+){0,${n}}` // sem atravessar a fronteira de oração
const RISCO_PESSOA: RegExp[] = [
  // "mordeu meu filho", "atacando as pessoas", "picou a minha mãe", "mordeu a mão do filho"
  new RegExp(`\\b${ATAQUE}\\s+${PALAVRAS(3)}${PESSOA}\\b`),
  // "me mordeu", "me picou", "fui mordido", "me machuquei"
  /\bme\s+(mordeu|picou|atacou|arranhou|machucou|feriu)\b/,
  /\bfui\s+(mordid|picad|atacad|ferid)[oa]\b/,
  /\bme\s+machuquei\b|\b(estou|t[ôo]|to)\s+(machucad|ferid)[oa]\b/,
  // "a criança foi mordida", "o motorista ficou ferido"
  new RegExp(`\\b${PESSOA_SUJEITO}\\s+${PALAVRAS(2)}(ferid|machucad|mordid|picad|atropelad|atacad)[oa]s?\\b`),
  new RegExp(`\\b${PESSOA_SUJEITO}\\s+${PALAVRAS(1)}(em\\s+(perigo|risco)|sangrando|desmaiad[oa]|se\\s+machucou)\\b`),
  // Bicho perto de criança/bebê/pessoas
  /\bperto\s+(d[aeo]s?|de)\s+(minha\s+|meu\s+|meus\s+|minhas\s+)?(crian[çc]as?|beb[êe]s?|pessoas|gente|filh[oa]s?)\b/,
]

/**
 * O relato diz que alguma pessoa foi mordida, picada, atacada, ferida ou está em perigo?
 * Não decide nada sozinho: o chat volta a PERGUNTAR ao cidadão (a resposta "pessoa em risco" é sempre dele).
 */
export function detectarPessoaEmRisco(texto: string): boolean {
  const t = normalizar(texto)
  return RISCO_PESSOA.some((re) => re.test(t))
}

// ---------- Animal dado como morto ----------

const MORTE = /\b(mort[oa]s?|morreu|morreram|sem\s+vida|falecid[oa]|carca[çc]a)\b/
const MORTE_NEGADA = /\b(n[ãa]o|nem)\s+(est[áa]\s+|t[áa]\s+)?(mort[oa]|morreu)\b/

/** O cidadão disse que o animal está morto (e não "não está morto")? */
export function citaMorte(texto: string): boolean {
  const t = normalizar(texto)
  return MORTE.test(t) && !MORTE_NEGADA.test(t)
}

// ---------- Correção determinística da categoria sugerida pela IA ----------

const ATROPELOU = /\b(atropel\w*|atropell\w*)/
const VEICULO = /\b(carros?|motos?|motocicletas?|caminh[ãa]o|caminh[õo]es|[ôo]nibus|vans?|bicicletas?|bikes?|ve[íi]culos?|caminhonetes?|tratores?|motoristas?|pneus?)\b/
// "bati no cachorro" só é atropelamento se houver veículo no texto — "o vizinho bateu no cachorro" é agressão.
const BATIDA = /\b(bat(i|eu|eram|emos|ido)\s+(n[oa]|num|numa|em|com))|\b(passou|passaram|passando)\s+(por\s+)?cima\b/
const VEICULO_AGIU = /\b(carros?|motos?|caminh[ãa]o|[ôo]nibus|ve[íi]culos?)\s+(pegou|pegaram|acertou|atingiu|bateu|passou|passaram)/
const VENENO = /\b(envenen\w*|venen\w*|chumbinho|isca\s+envenenada)\b/
const DOMESTICO = /\b(c[ãa]o|c[ãa]es|cachorr\w*|cadel\w*|filhot\w+\s+de\s+(c[ãa]o|cachorro|gato)|gat[oa]s?|gatinh\w*|dog|perr[oa]s?|cavalos?|[ée]guas?|vacas?|bois?|galinhas?|porcos?|coelhos?|cabras?|ovelhas?)\b/
const SILVESTRE = /\b(cobras?|serpentes?|jararacas?|coral|cascavel|sucuri|p[áa]ssar(o|os|inho|inhos)|aves?|corujas?|gavi[ãa]o|papagaios?|tucanos?|pombos?|gamb[áa]s?|capivaras?|macacos?|bugios?|saguis?|tatus?|lagartos?|te[íi]us?|ouri[çc]os?|quatis?|veados?|raposas?|morcegos?|jacar[ée]s?|tartarugas?|jabutis?|escorpi[ãa]o|escorpi[õo]es|aranhas?|caranguejeiras?|abelhas?|enxames?|vespas?|marimbondos?)\b/

// Só bicho que oferece risco vira "perto de pessoas" (P1, Bombeiros): passarinho no quintal não é emergência.
const SILVESTRE_PERIGOSO = /\b(cobras?|serpentes?|jararacas?|coral|cascavel|sucuri|escorpi[ãa]o|escorpi[õo]es|aranhas?|caranguejeiras?|abelhas?|enxames?|vespas?|marimbondos?|morcegos?|jacar[ée]s?|macacos?|bugios?)\b/
const PERTO_DE_PESSOAS = /\b(casa|sala|cozinha|quarto|banheiro|quintal|garagem|varanda|telhado|forro|escola|creche|dentro|apartamento|pr[ée]dio)\b|\bperto\s+(d[aeo]s?|de)\s+(\w+\s+)?(pessoas|crian[çc]as?|beb[êe]s?|gente)\b/
const SILVESTRE_FERIDO = /\b(ferid[oa]|machucad[oa]|atropel\w*|ca[íi]d[oa]|caiu|quebrad[oa]|sangr\w*|mancando|preso|presa|n[ãa]o\s+(voa|anda|consegue))\b/

/** Silvestre sem subtipo decidido pela IA: perto de pessoas pesa mais que ferido, que pesa mais que avistado. */
function silvestrePorTexto(t: string): string {
  if (SILVESTRE_PERIGOSO.test(t) && PERTO_DE_PESSOAS.test(t)) return 'silvestre_perto_de_pessoas'
  if (SILVESTRE_FERIDO.test(t)) return 'silvestre_ferido'
  return 'silvestre_avistado'
}

/**
 * Ajusta o "caso" sugerido pela IA quando o próprio texto contradiz a sugestão.
 * Regras simples, explicáveis e testadas — a IA erra de forma inconsistente; isto não.
 */
export function corrigirCaso(caso: string, texto: string): string {
  const t = normalizar(texto)
  const silvestreNoTexto = SILVESTRE.test(t)
  const domesticoNoTexto = DOMESTICO.test(t)
  // "gato na árvore" não é silvestre: bicho doméstico citado e nenhum silvestre no texto.
  if (caso.startsWith('silvestre_') && !silvestreNoTexto && domesticoNoTexto) {
    caso = caso === 'silvestre_ferido' ? 'ferido' : 'outro'
  }
  // "enxame de abelhas no telhado da escola" não é "só avistei": bicho que fere, perto de gente — na dúvida, sobe.
  if (caso === 'silvestre_avistado' && SILVESTRE_PERIGOSO.test(t) && PERTO_DE_PESSOAS.test(t)) {
    return 'silvestre_perto_de_pessoas'
  }
  // "escorpião no quarto" não é "animal ferido": só bicho silvestre citado, nenhum doméstico.
  if (['outro', 'ferido', 'abandono'].includes(caso) && silvestreNoTexto && !domesticoNoTexto) {
    return silvestrePorTexto(t)
  }
  if (!caso.startsWith('silvestre_')) {
    const atropelado = ATROPELOU.test(t) || VEICULO_AGIU.test(t) || (BATIDA.test(t) && VEICULO.test(t))
    if (atropelado && ['ferido', 'outro', 'abandono'].includes(caso)) return 'atropelamento'
    if (VENENO.test(t) && ['ferido', 'outro', 'maus_tratos'].includes(caso)) return 'envenenamento'
  }
  return caso
}
