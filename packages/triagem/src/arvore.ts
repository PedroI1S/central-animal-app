import type { Pergunta, Respostas } from './tipos'

// Pré-triagem adaptativa: cada pergunta só aparece se as respostas anteriores a tornam relevante.

const SIM_NAO = [
  { valor: 'sim', rotulo: 'Sim' },
  { valor: 'nao', rotulo: 'Não' },
]

export const PERGUNTAS: Record<string, Pergunta> = {
  pessoa_risco: {
    id: 'pessoa_risco',
    texto: 'Alguma pessoa está ferida ou em risco agora?',
    tipo: 'unica',
    opcoes: [
      { valor: 'sim', rotulo: 'Sim, há pessoa em risco', emoji: '🚨' },
      { valor: 'nao', rotulo: 'Não', emoji: '👍' },
    ],
  },
  tipo_animal: {
    id: 'tipo_animal',
    texto: 'Que tipo de animal é?',
    tipo: 'unica',
    opcoes: [
      { valor: 'domestico', rotulo: 'Doméstico (cão, gato, cavalo...)', emoji: '🐕' },
      { valor: 'silvestre', rotulo: 'Silvestre (cobra, ave, gambá...)', emoji: '🐍' },
      { valor: 'nao_sei', rotulo: 'Não sei', emoji: '❓' },
    ],
  },
  situacao: {
    id: 'situacao',
    texto: 'O que está acontecendo?',
    tipo: 'unica',
    opcoes: [
      { valor: 'atropelamento', rotulo: 'Atropelamento ou acidente', emoji: '🚗' },
      { valor: 'ferido', rotulo: 'Animal ferido ou doente', emoji: '🩹' },
      { valor: 'envenenamento', rotulo: 'Suspeita de envenenamento', emoji: '☠️' },
      { valor: 'maus_tratos', rotulo: 'Maus-tratos', emoji: '⚠️' },
      { valor: 'abandono', rotulo: 'Abandonado ou perdido', emoji: '🏚️' },
      { valor: 'morto_via', rotulo: 'Animal morto na via', emoji: '🛣️' },
      { valor: 'outro', rotulo: 'Outra situação', emoji: '💬' },
    ],
  },
  situacao_silvestre: {
    id: 'situacao_silvestre',
    texto: 'Onde está o animal silvestre?',
    tipo: 'unica',
    opcoes: [
      { valor: 'ameaca', rotulo: 'Dentro de casa ou perto de pessoas', emoji: '🏠' },
      { valor: 'ferido', rotulo: 'Ferido ou atropelado', emoji: '🩹' },
      { valor: 'avistado', rotulo: 'Só avistei, sem risco', emoji: '👀' },
    ],
  },
  sinais: {
    id: 'sinais',
    texto: 'Você percebe algum destes sinais?',
    tipo: 'multipla',
    ajuda: 'Marque todos que se aplicam.',
    opcoes: [
      { valor: 'sangramento', rotulo: 'Sangramento intenso', emoji: '🩸' },
      { valor: 'respiracao', rotulo: 'Dificuldade para respirar', emoji: '😮‍💨' },
      { valor: 'inconsciente', rotulo: 'Inconsciente / não responde', emoji: '💤' },
      { valor: 'convulsao', rotulo: 'Convulsão ou tremores', emoji: '⚡' },
      { valor: 'nao_levanta', rotulo: 'Não consegue se levantar', emoji: '🦴' },
      { valor: 'vomito', rotulo: 'Vômito ou muita saliva', emoji: '🤢' },
      { valor: 'nenhum', rotulo: 'Nenhum destes', emoji: '➖' },
    ],
  },
  maus_tratos_agora: {
    id: 'maus_tratos_agora',
    texto: 'Os maus-tratos estão acontecendo agora?',
    tipo: 'unica',
    opcoes: SIM_NAO,
  },
  abandono_filhotes: {
    id: 'abandono_filhotes',
    texto: 'Há filhotes ou uma fêmea com filhotes?',
    tipo: 'unica',
    opcoes: SIM_NAO,
  },
  outros_animais: {
    id: 'outros_animais',
    texto: 'Outros animais da região também passaram mal?',
    tipo: 'unica',
    opcoes: [...SIM_NAO, { valor: 'nao_sei', rotulo: 'Não sei' }],
  },
}

const COM_SINAIS = ['atropelamento', 'ferido', 'envenenamento']

/** Ordem das perguntas + condição de relevância. */
const FLUXO: { id: string; quando: (r: Respostas) => boolean }[] = [
  { id: 'pessoa_risco', quando: () => true },
  { id: 'tipo_animal', quando: () => true },
  { id: 'situacao', quando: (r) => r.tipo_animal !== 'silvestre' },
  { id: 'situacao_silvestre', quando: (r) => r.tipo_animal === 'silvestre' },
  { id: 'sinais', quando: (r) => COM_SINAIS.includes(r.situacao as string) || r.situacao_silvestre === 'ferido' },
  { id: 'maus_tratos_agora', quando: (r) => r.situacao === 'maus_tratos' },
  { id: 'abandono_filhotes', quando: (r) => r.situacao === 'abandono' },
  { id: 'outros_animais', quando: (r) => r.situacao === 'envenenamento' },
]

/** Próxima pergunta ainda não respondida, ou null quando a triagem terminou. */
export function proximaPergunta(r: Respostas): Pergunta | null {
  const passo = FLUXO.find((p) => p.quando(r) && r[p.id] === undefined)
  return passo ? PERGUNTAS[passo.id] : null
}

/** Perguntas relevantes para as respostas atuais — usado para a barra de progresso. */
export function perguntasRelevantes(r: Respostas): Pergunta[] {
  return FLUXO.filter((p) => p.quando(r)).map((p) => PERGUNTAS[p.id])
}

/** Remove respostas que deixaram de ser relevantes (ex.: usuário voltou e mudou a situação). */
export function podarRespostas(r: Respostas): Respostas {
  const limpas: Respostas = {}
  for (const p of FLUXO) {
    if (p.quando(limpas) && r[p.id] !== undefined) limpas[p.id] = r[p.id]
  }
  return limpas
}
