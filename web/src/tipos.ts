import type { Capacidade, Categoria, Prioridade, Servico } from '@ca/triagem'

export interface EventoPublico {
  tipo: string
  texto: string
  criadoEm: string
}

export interface OcorrenciaPublica {
  protocolo: string
  categoria: Categoria
  prioridade: Prioridade
  motivos: string[]
  rota: string
  servicos: Servico[]
  orientacoes: string[]
  status: string
  criadoEm: string
  eventos: EventoPublico[]
}

export interface ItemFila {
  id: string
  protocolo: string
  categoria: Categoria
  prioridade: Prioridade
  motivos: string[]
  rota: string
  status: string
  endereco: string | null
  lat: number | null
  lng: number | null
  relato: string | null
  resumoIa: string | null
  iaStatus: string | null
  criadoEm: string
  responsavel: string | null
  fotos: number
}

export interface Evento {
  id: string
  tipo: string
  autor: string
  texto: string
  visivelCidadao: boolean
  criadoEm: string
}

export interface Relacionada {
  id: string
  protocolo: string
  categoria: Categoria
  prioridade: Prioridade
  status: string
  criadoEm: string
  distancia: number
}

/** Uma frente do caso (a pessoa, o animal) com quem pode atendê-la. */
export interface Frente {
  id: string
  rotulo: string
  capacidades: Capacidade[]
  opcoes: Profissional[]
}

/** Quem pode atender este caso — só vem em ocorrência urgente e com local conhecido. */
export interface Profissional {
  id: string
  nome: string
  orgao: string
  telefone: string | null
  /** Metros em linha reta. */
  distancia: number
  atende24h: boolean
  observacao: string | null
  atendidas: Capacidade[]
  cobreTudo: boolean
}

export interface OcorrenciaDetalhe extends Omit<ItemFila, 'fotos'> {
  respostas: Record<string, string | string[]>
  sugestaoIa: Record<string, string | string[]> | null
  analiseFotoIa: string | null
  servicos: Servico[]
  orientacoes: string[]
  anonimo: boolean
  contatoNome: string | null
  contatoTel: string | null
  desfecho: string | null
  responsavelId: string | null
  fotos: string[]
  eventos: Evento[]
  relacionadas: Relacionada[]
  frentes: Frente[]
}

export interface Servidor {
  id: string
  nome: string
  setor: string
  /** API com PAINEL_SEM_LOGIN: não há sessão para encerrar. */
  semLogin?: boolean
}

export interface Stats {
  criticasAbertas: number
  semResponsavel: number
  hoje: number
  encerradasHoje: number
}
