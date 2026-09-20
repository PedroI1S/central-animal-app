export type Categoria =
  | 'atropelamento'
  | 'ferido'
  | 'envenenamento'
  | 'maus_tratos'
  | 'abandono'
  | 'silvestre'
  | 'morto_via'
  | 'outro'

/** 1 = crítica, 2 = alta, 3 = média, 4 = baixa */
export type Prioridade = 1 | 2 | 3 | 4

export type Rota = 'humana' | 'fauna' | 'policial' | 'municipal'

export interface Opcao {
  valor: string
  rotulo: string
  emoji?: string
}

export interface Pergunta {
  id: string
  texto: string
  tipo: 'unica' | 'multipla'
  opcoes: Opcao[]
  ajuda?: string
}

export type Respostas = Record<string, string | string[]>

/** Competência exigida de quem atende — ver `capacidades.ts`. */
export type Capacidade =
  | 'emergencia_humana'
  | 'clinica_veterinaria'
  | 'grande_porte'
  | 'resgate_fauna'
  | 'serpentes'
  | 'aves'
  | 'remocao'

export interface Servico {
  id: string
  nome: string
  orgao: string
  /** null = contato ainda a pactuar com a Prefeitura */
  telefone: string | null
  emergencia?: boolean
}

export interface Resultado {
  categoria: Categoria
  prioridade: Prioridade
  motivos: string[]
  rota: Rota
  servicos: Servico[]
  orientacoes: string[]
}
