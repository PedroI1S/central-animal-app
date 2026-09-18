import { classificar, podarRespostas, proximaPergunta, CATEGORIAS } from '@ca/triagem'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, schema } from '../db/index.ts'
import { interpretarRelato } from '../llm.ts'
import { enriquecerComIa, registrarEvento, rotuloPrioridade, servicosDe } from '../ocorrencias.ts'

const { ocorrencias, eventos, anexos } = schema

export const PASTA_UPLOADS = join(import.meta.dirname, '../../uploads')

const Dados = z.object({
  respostas: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  sugestaoIa: z.record(z.string(), z.union([z.string(), z.array(z.string())])).nullish(),
  relato: z.string().max(2000).nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  endereco: z.string().max(300).nullish(),
  anonimo: z.boolean().default(true),
  contatoNome: z.string().max(120).nullish(),
  contatoTel: z.string().max(40).nullish(),
})

const EXTENSOES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export async function rotasPublicas(app: FastifyInstance) {
  // Limites por IP generosos: a plateia inteira no Wi-Fi do evento sai pelo mesmo IP público.
  app.post('/api/triagem/interpretar', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req) => {
    const { texto } = z.object({ texto: z.string().min(3).max(1000) }).parse(req.body)
    const sugestao = await interpretarRelato(texto)
    return { ok: sugestao !== null, sugestao }
  })

  app.post('/api/ocorrencias', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    let dadosBrutos: unknown
    let foto: { buffer: Buffer; mime: string } | null = null

    // multipart: campo "dados" (JSON) + "foto" opcional
    for await (const parte of req.parts()) {
      if (parte.type === 'file') {
        if (parte.fieldname === 'foto' && EXTENSOES[parte.mimetype]) foto = { buffer: await parte.toBuffer(), mime: parte.mimetype }
        else await parte.toBuffer()
      } else if (parte.fieldname === 'dados') {
        dadosBrutos = JSON.parse(String(parte.value))
      }
    }

    const dados = Dados.parse(dadosBrutos)
    const respostas = podarRespostas(dados.respostas)
    if (proximaPergunta(respostas)) return reply.code(400).send({ erro: 'Triagem incompleta' })

    // A prioridade é SEMPRE recalculada aqui — o cliente não define a própria prioridade.
    const r = classificar(respostas)

    const [criada] = await db
      .insert(ocorrencias)
      .values({
        protocolo: sql`'CA-' || extract(year from now())::int || '-' || lpad(nextval('protocolo_seq')::text, 6, '0')`,
        categoria: r.categoria,
        prioridade: r.prioridade,
        motivos: r.motivos,
        rota: r.rota,
        servicos: r.servicos.map((s) => s.id),
        orientacoes: r.orientacoes,
        respostas,
        sugestaoIa: dados.sugestaoIa ?? null,
        relato: dados.relato || null,
        lat: dados.lat ?? null,
        lng: dados.lng ?? null,
        endereco: dados.endereco || null,
        anonimo: dados.anonimo,
        contatoNome: dados.anonimo ? null : dados.contatoNome || null,
        contatoTel: dados.anonimo ? null : dados.contatoTel || null,
      })
      .returning({ id: ocorrencias.id, protocolo: ocorrencias.protocolo })

    let caminhoFoto: string | null = null
    if (foto) {
      const nome = `${randomUUID()}.${EXTENSOES[foto.mime]}`
      caminhoFoto = join(PASTA_UPLOADS, nome)
      await writeFile(caminhoFoto, foto.buffer)
      await db.insert(anexos).values({ ocorrenciaId: criada.id, caminho: nome, mime: foto.mime })
    }

    await registrarEvento(
      criada.id,
      'criada',
      'Central Animal',
      `Ocorrência registrada: ${CATEGORIAS[r.categoria]} — prioridade ${rotuloPrioridade(r.prioridade)}.`,
    )
    enriquecerComIa(criada.id, dados.relato || null, r.categoria, r.motivos, caminhoFoto)

    return { protocolo: criada.protocolo }
  })

  app.get('/api/ocorrencias/:protocolo', async (req, reply) => {
    const { protocolo } = req.params as { protocolo: string }
    const [o] = await db.select().from(ocorrencias).where(eq(ocorrencias.protocolo, protocolo.toUpperCase()))
    if (!o) return reply.code(404).send({ erro: 'Protocolo não encontrado' })

    const linha = await db
      .select({ tipo: eventos.tipo, texto: eventos.texto, criadoEm: eventos.criadoEm })
      .from(eventos)
      .where(and(eq(eventos.ocorrenciaId, o.id), eq(eventos.visivelCidadao, true)))
      .orderBy(asc(eventos.criadoEm))

    // Visão pública: sem contato, sem nome de servidor, sem dados da IA.
    return {
      protocolo: o.protocolo,
      categoria: o.categoria,
      prioridade: o.prioridade,
      motivos: o.motivos,
      rota: o.rota,
      servicos: servicosDe(o.servicos),
      orientacoes: o.orientacoes,
      status: o.status,
      criadoEm: o.criadoEm,
      eventos: linha,
    }
  })
}
