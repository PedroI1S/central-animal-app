import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyError } from 'fastify'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ZodError } from 'zod'
import { aquecer } from './llm.ts'
import { rotasPainel } from './routes/painel.ts'
import { PASTA_UPLOADS, rotasPublicas } from './routes/publico.ts'

const app = Fastify({ logger: { level: 'info' }, trustProxy: true })

await app.register(cookie, { secret: process.env.COOKIE_SECRET! })
await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024, files: 1 } })
await app.register(rateLimit, { global: false })
await app.register(fastifyStatic, { root: PASTA_UPLOADS, prefix: '/uploads/' })

app.setErrorHandler((err: FastifyError, req, reply) => {
  if (err instanceof ZodError) return reply.code(400).send({ erro: 'Dados inválidos', detalhes: err.issues })
  if (err.statusCode === 429) return reply.code(429).send({ erro: 'Muitas tentativas. Aguarde um minuto.' })
  req.log.error(err)
  return reply.code(err.statusCode ?? 500).send({ erro: err.statusCode ? err.message : 'Erro interno' })
})

// CORS só aqui: a página do link fixo (GitHub Pages) precisa LER esta resposta para distinguir
// a nossa API de um túnel morto (que também responde, com o erro 530 da Cloudflare).
app.get('/api/health', async (_req, reply) => {
  reply.header('access-control-allow-origin', '*')
  return { ok: true }
})
await app.register(rotasPublicas)
await app.register(rotasPainel)

// Produção/demo: a API também serve o front, num único endereço para o túnel.
const DIST = join(import.meta.dirname, '../../web/dist')
if (existsSync(DIST)) {
  await app.register(fastifyStatic, { root: DIST, prefix: '/', decorateReply: false, wildcard: false })
  app.setNotFoundHandler((req, reply) =>
    req.url.startsWith('/api/') ? reply.code(404).send({ erro: 'Não encontrado' }) : reply.sendFile('index.html', DIST),
  )
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
void aquecer((m) => app.log.info(m))
