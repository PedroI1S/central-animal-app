import type { Categoria, Prioridade, Servico } from '@ca/triagem'

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
}

export interface Servidor {
  id: string
  nome: string
  setor: string
}

export interface Stats {
  criticasAbertas: number
  semResponsavel: number
  hoje: number
  encerradasHoje: number
}
