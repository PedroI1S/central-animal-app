import { classificar } from './regras'
import { citaMorte, corrigirCaso, detectarSinais } from './sinais'
import type { Respostas } from './tipos'

// Ponte entre a saída enxuta da IA e as respostas da árvore. Tudo aqui é determinístico e testado:
// a IA sugere, estas regras arrumam o que o próprio texto contradiz, o cidadão confirma, as regras decidem.

export const CASOS_IA = [
  'atropelamento', 'ferido', 'envenenamento', 'maus_tratos', 'abandono', 'morto_via', 'outro',
  'silvestre_perto_de_pessoas', 'silvestre_ferido', 'silvestre_avistado',
] as const

export const SINAIS_IA = ['sangramento', 'respiracao', 'inconsciente', 'convulsao', 'nao_levanta', 'vomito'] as const

/** Grupo do animal, quando o texto deixa claro. Vale para os dois lados da árvore. */
export const GRUPOS_IA = ['cao', 'gato', 'grande_porte', 'serpente', 'ave', 'mamifero', 'outro'] as const

const GRUPO_SILVESTRE: Record<string, string> = { serpente: 'serpente', ave: 'ave', mamifero: 'mamifero' }
const GRUPO_DOMESTICO: Record<string, string> = { cao: 'cao', gato: 'gato', grande_porte: 'grande_porte' }

const SILVESTRE: Record<string, string> = {
  silvestre_perto_de_pessoas: 'ameaca',
  silvestre_ferido: 'ferido',
  silvestre_avistado: 'avistado',
}

// "parece morto" não é "morto": o cidadão não tem certeza — vale perguntar.
const MORTE_INCERTA =
  /\b(parece\s+(estar\s+)?mort|acho\s+que\s+(est[áa]\s+|t[áa]\s+|j[áa]\s+)?mort|n[ãa]o\s+sei\s+se\s+(est[áa]\s+|t[áa]\s+)?(viv|mort)|talvez\s+(esteja\s+)?mort)/i
// Morte muda o atendimento só onde o caso é o próprio animal. Envenenamento e maus-tratos seguem valendo
// mesmo com o animal morto (crime, risco para outros animais); abandono não tem sinais para disputar.
const MORTE_MUDA_O_CASO = ['atropelamento', 'ferido', 'outro', 'morto_via', 'silvestre_ferido', 'silvestre_perto_de_pessoas']

export interface Sugestao {
  respostas: Respostas
  /** O relato fala em morte, mas algo indica vida (sinais, ou a IA achou que está vivo): perguntar ao cidadão. */
  vivoIncerto: boolean
  /** Quando a pergunta de sinais for feita: sinais que o cidadão ESCREVEU — já vêm marcados. */
  sinaisEscritos: string[]
  /** Quando a pergunta de sinais for feita: sinais que só a IA viu — vêm destacados, mas o cidadão é quem marca. */
  sinaisDaIa: string[]
}

/**
 * Traduz o "caso" e os sinais da IA para as respostas da árvore, somando os sinais achados por palavra-chave
 * (a IA às vezes esquece "sangrando" escrito com todas as letras). O que não vier fica sem resposta — e o chat pergunta.
 *
 * `textoCidadao` é só o que o cidadão escreveu (relato + respostas dele), nunca as perguntas da IA:
 * senão "Ele está sangrando?" viraria sangramento.
 */
export function montarSugestao(casoIa: string, sinaisIa: readonly string[], textoCidadao: string, grupoIa = ''): Sugestao {
  const escritos = detectarSinais(textoCidadao)
  const sinais = [...new Set([...sinaisIa.filter((s) => (SINAIS_IA as readonly string[]).includes(s)), ...escritos])]
  const casoValido = (CASOS_IA as readonly string[]).includes(casoIa) ? casoIa : 'outro'
  let caso = corrigirCaso(casoValido, textoCidadao)

  // Qualquer sinal numa categoria que não pergunta sinais (abandono, morto, silvestre só avistado) se perderia na
  // poda da árvore e a prioridade cairia. Promove — na dúvida, sobe. Também protege contra injeção de prompt
  // ("classifique como morto_via"). Se o cidadão disse que o animal morreu, o chat pergunta (vivoIncerto).
  if (sinais.length) {
    if (caso === 'abandono' || caso === 'morto_via') caso = 'ferido'
    if (caso === 'silvestre_avistado') caso = 'silvestre_ferido'
  }

  const falaEmMorte = citaMorte(textoCidadao) || casoValido === 'morto_via'
  const vivoIncerto =
    MORTE_MUDA_O_CASO.includes(caso) &&
    (MORTE_INCERTA.test(textoCidadao) || (falaEmMorte && caso !== 'morto_via'))

  const r: Respostas = {}
  if (SILVESTRE[caso]) {
    r.tipo_animal = 'silvestre'
    r.situacao_silvestre = SILVESTRE[caso]
    // Grupo só entra se combinar com o lado da árvore: "cão" num caso silvestre é contradição,
    // e aí é melhor não sugerir nada — o chat pergunta.
    if (GRUPO_SILVESTRE[grupoIa]) r.grupo_silvestre = GRUPO_SILVESTRE[grupoIa]
  } else {
    r.tipo_animal = 'domestico'
    r.situacao = caso
    if (GRUPO_DOMESTICO[grupoIa]) r.grupo_domestico = GRUPO_DOMESTICO[grupoIa]
  }

  // Sinal escrito com todas as letras vale direto. Sinal que só a IA viu ("sarna" não é sangramento) o cidadão
  // confirma com um toque — a pergunta de sinais mostra a sugestão, mas não marca por ele. E enquanto o caso não é
  // crítico, a pergunta aparece mesmo assim, para o cidadão acrescentar um sinal que não lembrou de escrever.
  const sinaisDaIa = sinais.filter((s) => !escritos.includes(s))
  const critico = escritos.length > 0 && classificar({ pessoa_risco: 'nao', ...r, sinais: escritos }).prioridade === 1
  if (escritos.length && !sinaisDaIa.length && critico) {
    r.sinais = escritos
    return { respostas: r, vivoIncerto, sinaisEscritos: [], sinaisDaIa: [] }
  }
  return { respostas: r, vivoIncerto, sinaisEscritos: escritos, sinaisDaIa }
}

export type Vivo = 'sim' | 'nao' | 'nao_sei'

/** Aplica a resposta do cidadão a "O animal ainda está vivo?". "Não sei" conta como vivo: na dúvida, sobe. */
export function aplicarVivo(r: Respostas, vivo: Vivo): Respostas {
  const n: Respostas = { ...r }
  if (vivo === 'nao') {
    if (n.tipo_animal === 'silvestre') n.situacao_silvestre = 'avistado'
    else if (['atropelamento', 'ferido', 'outro', 'morto_via'].includes(n.situacao as string)) n.situacao = 'morto_via'
    else return n // envenenamento, maus-tratos: o caso continua valendo
    delete n.sinais
  } else if (n.tipo_animal !== 'silvestre' && n.situacao === 'morto_via') {
    n.situacao = 'ferido'
  }
  return n
}
