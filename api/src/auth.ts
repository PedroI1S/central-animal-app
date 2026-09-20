import { asc } from 'drizzle-orm'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { db, schema } from './db/index.ts'

// Por enquanto o painel abre sem login: no protótipo ele atrapalhava mais do que protegia.
// Sem sessão, quem usa o painel age como o primeiro servidor cadastrado (Ana Souza no seed),
// para as providências continuarem com autor. Para voltar a exigir login, troque para false.
// Vale só no próprio notebook: pelo túnel a plateia inteira alcança /painel, e lá o login continua (ver acessoLocal).
export const PAINEL_SEM_LOGIN = true

/**
 * Pedido feito no próprio notebook, não pela internet. O túnel da Cloudflare também chega pelo localhost, mas
 * acrescenta cf-connecting-ip/cf-ray — cabeçalhos que quem está do lado de fora não consegue tirar.
 * Usa o endereço do socket, não req.ip: com trustProxy, req.ip viria do X-Forwarded-For, que o cliente escreve.
 */
export function acessoLocal(req: FastifyRequest): boolean {
  const ip = req.socket.remoteAddress ?? ''
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  return loopback && !req.headers['cf-connecting-ip'] && !req.headers['cf-ray'] && !req.headers['x-forwarded-for']
}

/** Este pedido pode usar o painel sem login? */
export const semLogin = (req: FastifyRequest) => PAINEL_SEM_LOGIN && acessoLocal(req)

export function hashSenha(senha: string): string {
  const sal = randomBytes(16).toString('hex')
  return `${sal}:${scryptSync(senha, sal, 32).toString('hex')}`
}

export function conferirSenha(senha: string, hash: string): boolean {
  const [sal, esperado] = hash.split(':')
  return timingSafeEqual(scryptSync(senha, sal, 32), Buffer.from(esperado, 'hex'))
}

/** preHandler do painel: exige cookie de sessão assinado (ou, com PAINEL_SEM_LOGIN no notebook, usa o servidor padrão). */
export async function exigirServidor(req: FastifyRequest, reply: FastifyReply) {
  if (semLogin(req)) {
    // Consulta a cada vez em vez de guardar o id: o demo:reset recria os servidores com ids novos.
    const [padrao] = await db.select({ id: schema.servidores.id }).from(schema.servidores).orderBy(asc(schema.servidores.nome)).limit(1)
    if (!padrao) return reply.code(503).send({ erro: 'Nenhum servidor cadastrado. Rode npm run db:seed.' })
    req.servidorId = padrao.id
    return
  }
  const bruto = req.cookies.sid
  const assinado = bruto ? req.unsignCookie(bruto) : null
  if (!assinado?.valid || !assinado.value) return reply.code(401).send({ erro: 'Não autenticado' })
  req.servidorId = assinado.value
}

declare module 'fastify' {
  interface FastifyRequest {
    servidorId?: string
  }
}
