import { CATEGORIAS, PRIORIDADES, SERVICOS, type Prioridade } from '@ca/triagem'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from './db/index.ts'
import { analisarFoto, gerarResumo } from './llm.ts'

const { ocorrencias, eventos } = schema

export const servicosDe = (ids: string[]) => ids.map((id) => SERVICOS[id as keyof typeof SERVICOS]).filter(Boolean)

export function rotuloPrioridade(p: number) {
  return PRIORIDADES[p as Prioridade]?.rotulo ?? String(p)
}

export async function registrarEvento(
  ocorrenciaId: string,
  tipo: string,
  autor: string,
  texto: string,
  visivelCidadao = true,
) {
  await db.insert(eventos).values({ ocorrenciaId, tipo, autor, texto, visivelCidadao })
  await db.update(ocorrencias).set({ atualizadoEm: new Date() }).where(eq(ocorrencias.id, ocorrenciaId))
}

/** Ocorrências a menos de `raio` metros nos últimos 90 dias — a rastreabilidade pedida pela Prefeitura. */
export async function relacionadas(id: string, lat: number, lng: number, raio = 200) {
  const distancia = sql<number>`6371000 * acos(least(1, cos(radians(${lat})) * cos(radians(${ocorrencias.lat}))
    * cos(radians(${ocorrencias.lng}) - radians(${lng})) + sin(radians(${lat})) * sin(radians(${ocorrencias.lat}))))`
  return db
    .select({
      id: ocorrencias.id,
      protocolo: ocorrencias.protocolo,
      categoria: ocorrencias.categoria,
      prioridade: ocorrencias.prioridade,
      status: ocorrencias.status,
      criadoEm: ocorrencias.criadoEm,
      distancia,
    })
    .from(ocorrencias)
    .where(
      sql`${ocorrencias.id} <> ${id} and ${ocorrencias.lat} is not null
        and ${ocorrencias.criadoEm} > now() - interval '90 days' and ${distancia} < ${raio}`,
    )
    .orderBy(sql`${ocorrencias.criadoEm} desc`)
    .limit(10)
}

/** Resumo + análise de foto em segundo plano; o painel mostra "IA analisando…" até terminar. */
export function enriquecerComIa(id: string, relato: string | null, categoria: string, motivos: string[], foto: string | null) {
  if (!relato && !foto) return
  void (async () => {
    await db.update(ocorrencias).set({ iaStatus: 'pendente' }).where(eq(ocorrencias.id, id))
    let erro = false
    const contexto = `${CATEGORIAS[categoria as keyof typeof CATEGORIAS] ?? categoria} — ${motivos.join(', ')}`
    if (relato) {
      try {
        await db.update(ocorrencias).set({ resumoIa: await gerarResumo(relato, contexto) }).where(eq(ocorrencias.id, id))
      } catch {
        erro = true
      }
    }
    if (foto) {
      try {
        await db.update(ocorrencias).set({ analiseFotoIa: await analisarFoto(foto) }).where(eq(ocorrencias.id, id))
      } catch {
        erro = true
      }
    }
    await db.update(ocorrencias).set({ iaStatus: erro ? 'erro' : 'ok' }).where(eq(ocorrencias.id, id))
  })()
}
