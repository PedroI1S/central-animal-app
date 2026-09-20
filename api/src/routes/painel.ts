import { classificar, necessidadesPara, PRIORIDADES, type Prioridade, type Respostas } from '@ca/triagem'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { conferirSenha, exigirServidor, semLogin } from '../auth.ts'
import { db, schema } from '../db/index.ts'
import { registrarEvento, relacionadas, rotuloPrioridade, servicosDe } from '../ocorrencias.ts'
import { porNecessidade, PRIORIDADE_MINIMA_PROFISSIONAL } from '../profissionais.ts'

const { ocorrencias, eventos, anexos, servidores } = schema
const ABERTAS = ['nova', 'em_atendimento', 'encaminhada']

const STATUS_ROTULO: Record<string, string> = {
  nova: 'Nova',
  em_atendimento: 'Em atendimento',
  encaminhada: 'Encaminhada',
  encerrada: 'Encerrada',
  improcedente: 'Improcedente',
}

export async function rotasPainel(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const { email, senha } = z.object({ email: z.string(), senha: z.string() }).parse(req.body)
    const [s] = await db.select().from(servidores).where(eq(servidores.email, email.toLowerCase().trim()))
    if (!s || !conferirSenha(senha, s.senhaHash)) return reply.code(401).send({ erro: 'E-mail ou senha inválidos' })
    reply.setCookie('sid', s.id, { signed: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })
    return { id: s.id, nome: s.nome, setor: s.setor }
  })

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('sid', { path: '/' })
    return { ok: true }
  })

  app.register(async (painel) => {
    painel.addHook('preHandler', exigirServidor)

    const servidorAtual = async (id: string) => (await db.select().from(servidores).where(eq(servidores.id, id)))[0]

    painel.get('/api/auth/eu', async (req, reply) => {
      const s = await servidorAtual(req.servidorId!)
      if (!s) return reply.code(401).send({ erro: 'Sessão inválida' })
      return { id: s.id, nome: s.nome, setor: s.setor, semLogin: semLogin(req) }
    })

    painel.get('/api/painel/servidores', async () =>
      db.select({ id: servidores.id, nome: servidores.nome, setor: servidores.setor }).from(servidores).orderBy(asc(servidores.nome)),
    )

    painel.get('/api/painel/ocorrencias', async (req) => {
      const { filtro } = z.object({ filtro: z.enum(['abertas', 'todas']).default('abertas') }).parse(req.query)
      return db
        .select({
          id: ocorrencias.id,
          protocolo: ocorrencias.protocolo,
          categoria: ocorrencias.categoria,
          prioridade: ocorrencias.prioridade,
          motivos: ocorrencias.motivos,
          rota: ocorrencias.rota,
          status: ocorrencias.status,
          endereco: ocorrencias.endereco,
          lat: ocorrencias.lat,
          lng: ocorrencias.lng,
          relato: ocorrencias.relato,
          resumoIa: ocorrencias.resumoIa,
          iaStatus: ocorrencias.iaStatus,
          criadoEm: ocorrencias.criadoEm,
          responsavel: servidores.nome,
          fotos: sql<number>`(select count(*)::int from ${anexos} where ${anexos.ocorrenciaId} = ${ocorrencias.id})`,
        })
        .from(ocorrencias)
        .leftJoin(servidores, eq(servidores.id, ocorrencias.responsavelId))
        .where(filtro === 'abertas' ? inArray(ocorrencias.status, ABERTAS) : undefined)
        .orderBy(asc(ocorrencias.prioridade), asc(ocorrencias.criadoEm))
    })

    painel.get('/api/painel/stats', async () => {
      const [s] = await db
        .select({
          criticasAbertas: sql<number>`count(*) filter (where ${ocorrencias.prioridade} = 1 and ${ocorrencias.status} in ('nova','em_atendimento','encaminhada'))::int`,
          semResponsavel: sql<number>`count(*) filter (where ${ocorrencias.responsavelId} is null and ${ocorrencias.status} in ('nova','em_atendimento','encaminhada'))::int`,
          hoje: sql<number>`count(*) filter (where ${ocorrencias.criadoEm} >= date_trunc('day', now()))::int`,
          encerradasHoje: sql<number>`count(*) filter (where ${ocorrencias.status} = 'encerrada' and ${ocorrencias.atualizadoEm} >= date_trunc('day', now()))::int`,
        })
        .from(ocorrencias)
      return s
    })

    painel.get('/api/painel/ocorrencias/:id', async (req, reply) => {
      const { id } = z.object({ id: z.uuid() }).parse(req.params)
      const [o] = await db
        .select({ o: ocorrencias, responsavel: servidores.nome })
        .from(ocorrencias)
        .leftJoin(servidores, eq(servidores.id, ocorrencias.responsavelId))
        .where(eq(ocorrencias.id, id))
      if (!o) return reply.code(404).send({ erro: 'Não encontrada' })

      // Quem pode atender: só vale a pena para caso urgente e com local conhecido.
      // A prioridade vem da linha (pode ter sido reclassificada à mão); a capacidade, das respostas.
      const temLocal = o.o.lat != null && o.o.lng != null
      const urgente = o.o.prioridade <= PRIORIDADE_MINIMA_PROFISSIONAL
      const respostas = o.o.respostas as Respostas

      const [linha, fotos, proximas, profissionais] = await Promise.all([
        db.select().from(eventos).where(eq(eventos.ocorrenciaId, id)).orderBy(asc(eventos.criadoEm)),
        db.select({ caminho: anexos.caminho }).from(anexos).where(eq(anexos.ocorrenciaId, id)),
        temLocal ? relacionadas(id, o.o.lat!, o.o.lng!) : Promise.resolve([]),
        temLocal && urgente
          ? porNecessidade(necessidadesPara(respostas, classificar(respostas)), o.o.lat!, o.o.lng!)
          : Promise.resolve([]),
      ])

      return {
        ...o.o,
        responsavel: o.responsavel,
        servicos: servicosDe(o.o.servicos),
        fotos: fotos.map((f) => `/uploads/${f.caminho}`),
        eventos: linha,
        relacionadas: proximas,
        frentes: profissionais,
      }
    })

    const Acao = z.discriminatedUnion('acao', [
      z.object({ acao: z.literal('atribuir'), responsavelId: z.uuid() }),
      z.object({ acao: z.literal('status'), status: z.enum(['em_atendimento', 'encaminhada']) }),
      z.object({ acao: z.literal('reclassificar'), prioridade: z.number().int().min(1).max(4), justificativa: z.string().min(3) }),
      z.object({ acao: z.literal('encerrar'), desfecho: z.string().min(3), improcedente: z.boolean().default(false) }),
    ])

    painel.patch('/api/painel/ocorrencias/:id', async (req, reply) => {
      const { id } = z.object({ id: z.uuid() }).parse(req.params)
      const a = Acao.parse(req.body)
      const eu = await servidorAtual(req.servidorId!)
      const [o] = await db.select().from(ocorrencias).where(eq(ocorrencias.id, id))
      if (!o || !eu) return reply.code(404).send({ erro: 'Não encontrada' })

      switch (a.acao) {
        case 'atribuir': {
          const [resp] = await db.select().from(servidores).where(eq(servidores.id, a.responsavelId))
          if (!resp) return reply.code(400).send({ erro: 'Responsável inválido' })
          await db
            .update(ocorrencias)
            .set({ responsavelId: resp.id, status: o.status === 'nova' ? 'em_atendimento' : o.status })
            .where(eq(ocorrencias.id, id))
          // Cidadão vê o setor, não o nome do servidor.
          await registrarEvento(id, 'atribuida', eu.nome, `Caso assumido pela equipe: ${resp.setor}.`)
          break
        }
        case 'status':
          await db.update(ocorrencias).set({ status: a.status }).where(eq(ocorrencias.id, id))
          await registrarEvento(id, 'status', eu.nome, `Status: ${STATUS_ROTULO[a.status]}.`)
          break
        case 'reclassificar':
          await db.update(ocorrencias).set({ prioridade: a.prioridade }).where(eq(ocorrencias.id, id))
          await registrarEvento(
            id,
            'reclassificada',
            eu.nome,
            `Prioridade alterada de ${rotuloPrioridade(o.prioridade)} para ${PRIORIDADES[a.prioridade as Prioridade].rotulo}: ${a.justificativa}`,
            false,
          )
          break
        case 'encerrar':
          await db
            .update(ocorrencias)
            .set({ status: a.improcedente ? 'improcedente' : 'encerrada', desfecho: a.desfecho })
            .where(eq(ocorrencias.id, id))
          await registrarEvento(id, 'encerrada', eu.nome, a.improcedente ? 'Ocorrência encerrada.' : `Ocorrência encerrada: ${a.desfecho}`, !a.improcedente)
          break
      }
      return { ok: true }
    })

    painel.post('/api/painel/ocorrencias/:id/eventos', async (req) => {
      const { id } = z.object({ id: z.uuid() }).parse(req.params)
      const { texto, visivelCidadao } = z.object({ texto: z.string().min(2).max(1000), visivelCidadao: z.boolean().default(true) }).parse(req.body)
      const eu = await servidorAtual(req.servidorId!)
      await registrarEvento(id, 'providencia', eu!.nome, texto, visivelCidadao)
      return { ok: true }
    })
  })
}

