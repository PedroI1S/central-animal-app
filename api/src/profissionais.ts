import type { Capacidade, Necessidade } from '@ca/triagem'
import { sql } from 'drizzle-orm'
import { db } from './db/index.ts'
import { profissionais } from './db/schema.ts'

/** Abaixo disso o caso não é urgente o bastante para ocupar alguém: a lista de serviços já basta. */
export const PRIORIDADE_MINIMA_PROFISSIONAL = 2

export interface ProfissionalProximo {
  id: string
  nome: string
  orgao: string
  telefone: string | null
  /** Metros em linha reta — aproximação de tempo de resposta, não rota real. */
  distancia: number
  atende24h: boolean
  observacao: string | null
  /** Só as capacidades exigidas pelo caso que este profissional cobre. */
  atendidas: Capacidade[]
  /** Cobre todas as capacidades exigidas (e não só parte delas). */
  cobreTudo: boolean
}

/** Uma frente do caso com as opções encontradas para ela. */
export interface FrenteAtendimento {
  id: string
  rotulo: string
  capacidades: Capacidade[]
  opcoes: ProfissionalProximo[]
}

/**
 * Quem pode atender cada frente do caso, separadamente.
 *
 * Buscar por frente, e não por uma lista única de capacidades, é o que impede o caso da picada de
 * cobra: com lista única o hospital cobria 1 de 3 capacidades e ficava atrás dos Bombeiros, que
 * cobriam 2 — a tela recomendava três lugares que pegam a cobra e nenhum para a pessoa picada.
 *
 * Dentro de cada frente: quem cobre tudo primeiro, depois o mais perto. Mesma fórmula de haversine
 * de `relacionadas()`.
 */
export async function porNecessidade(
  necessidades: Necessidade[],
  lat: number,
  lng: number,
  porFrente = 2,
): Promise<FrenteAtendimento[]> {
  const frentes = await Promise.all(
    necessidades.map(async (n) => ({ ...n, opcoes: await maisProximos(n.capacidades, lat, lng, porFrente) })),
  )
  return frentes.filter((f) => f.opcoes.length > 0)
}

/**
 * Quem cobre estas capacidades, do mais completo e mais perto para o menos.
 *
 * Ordena por cobertura antes de distância: uma clínica a 300 m não serve para uma cobra, por mais
 * perto que esteja. Com o limite por frente, quem cobre só parte some quando há opção completa.
 */
async function maisProximos(caps: Capacidade[], lat: number, lng: number, limite: number): Promise<ProfissionalProximo[]> {
  if (caps.length === 0) return []

  const distancia = sql<number>`6371000 * acos(least(1, cos(radians(${lat})) * cos(radians(${profissionais.lat}))
    * cos(radians(${profissionais.lng}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${profissionais.lat}))))`

  const linhas = await db
    .select({
      id: profissionais.id,
      nome: profissionais.nome,
      orgao: profissionais.orgao,
      telefone: profissionais.telefone,
      capacidades: profissionais.capacidades,
      atende24h: profissionais.atende24h,
      observacao: profissionais.observacao,
      distancia,
    })
    .from(profissionais)
    // `&&` = os arrays têm ao menos um elemento em comum; quem não cobre nada não entra na lista.
    .where(sql`${profissionais.ativo} and ${profissionais.capacidades} && ${sql.param(caps)}::text[]`)
    .orderBy(distancia)
    .limit(20)

  const exigidas = new Set<string>(caps)
  return linhas
    .map((p) => {
      const atendidas = p.capacidades.filter((c) => exigidas.has(c)) as Capacidade[]
      return {
        id: p.id,
        nome: p.nome,
        orgao: p.orgao,
        telefone: p.telefone,
        distancia: p.distancia,
        atende24h: p.atende24h,
        observacao: p.observacao,
        atendidas,
        cobreTudo: atendidas.length === caps.length,
      }
    })
    .sort((a, b) => Number(b.cobreTudo) - Number(a.cobreTudo) || a.distancia - b.distancia)
    .slice(0, limite)
}
