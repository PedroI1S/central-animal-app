import { CATEGORIAS, PRIORIDADES, SERVICOS, type Prioridade } from '@ca/triagem'
import { eq, sql } from 'drizzle-orm'
import { join } from 'node:path'
import { db, schema } from './db/index.ts'
import { analisarFoto, gerarResumo, textoSeguro } from './llm.ts'

const { ocorrencias, eventos, anexos } = schema

export const PASTA_UPLOADS = join(import.meta.dirname, '../uploads')

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

/**
 * Resumo + análise de foto em segundo plano; o painel mostra "IA analisando…" até terminar.
 * Nada aqui pode derrubar a API: no Node 24 uma promessa rejeitada sem tratamento encerra o processo.
 */
export function enriquecerComIa(
  id: string,
  relato: string | null,
  categoria: string,
  motivos: string[],
  foto: string | null,
  /** A foto é analisada com o caso em volta: sozinha ela não sabe que alguém foi picado. */
  pessoaFerida: boolean,
  log: (msg: string) => void = console.warn,
) {
  if (!relato && !foto) return
  void (async () => {
    await db.update(ocorrencias).set({ iaStatus: 'pendente' }).where(eq(ocorrencias.id, id))
    let erro = false
    const contexto = `${CATEGORIAS[categoria as keyof typeof CATEGORIAS] ?? categoria} — ${motivos.join(', ')}`
    if (relato) {
      try {
        // Se a IA trouxer algo impróprio (ou nada), o resumo vira o da própria classificação (regras, sem IA).
        const resumo = textoSeguro(await gerarResumo(relato, contexto)) ?? `${motivos.join(', ')}.`
        await db.update(ocorrencias).set({ resumoIa: resumo }).where(eq(ocorrencias.id, id))
      } catch (e) {
        log(`IA: resumo falhou — ${(e as Error).message}`)
        erro = true
      }
    }
    if (foto) {
      try {
        const analise = textoSeguro(await analisarFoto(foto, { relato, pessoaFerida })) ?? 'Foto recebida; descrição automática omitida.'
        await db.update(ocorrencias).set({ analiseFotoIa: analise }).where(eq(ocorrencias.id, id))
      } catch (e) {
        log(`IA: análise de foto falhou — ${(e as Error).message}`)
        erro = true
      }
    }
    await db.update(ocorrencias).set({ iaStatus: erro ? 'erro' : 'ok' }).where(eq(ocorrencias.id, id))
  })().catch((e) => log(`IA: enriquecimento abortado — ${(e as Error).message}`))
}

/**
 * Ao subir a API: análises que ficaram "pendente" (a API caiu ou foi reiniciada no meio) voltam para a fila.
 * Sem isso o painel mostraria "IA analisando…" para sempre.
 */
export async function retomarAnalisesPendentes(log: (msg: string) => void) {
  const pendentes = await db
    .select({
      id: ocorrencias.id,
      relato: ocorrencias.relato,
      categoria: ocorrencias.categoria,
      motivos: ocorrencias.motivos,
      rota: ocorrencias.rota,
      foto: anexos.caminho,
    })
    .from(ocorrencias)
    .leftJoin(anexos, eq(anexos.ocorrenciaId, ocorrencias.id))
    .where(eq(ocorrencias.iaStatus, 'pendente'))
  for (const p of pendentes) {
    enriquecerComIa(p.id, p.relato, p.categoria, p.motivos, p.foto ? join(PASTA_UPLOADS, p.foto) : null, p.rota === 'humana', log)
  }
  if (pendentes.length) log(`IA: ${pendentes.length} análise(s) pendente(s) retomada(s)`)
}
