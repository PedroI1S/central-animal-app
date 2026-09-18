import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

export function hashSenha(senha: string): string {
  const sal = randomBytes(16).toString('hex')
  return `${sal}:${scryptSync(senha, sal, 32).toString('hex')}`
}

export function conferirSenha(senha: string, hash: string): boolean {
  const [sal, esperado] = hash.split(':')
  return timingSafeEqual(scryptSync(senha, sal, 32), Buffer.from(esperado, 'hex'))
}

/** preHandler do painel: exige cookie de sessão assinado. */
export async function exigirServidor(req: FastifyRequest, reply: FastifyReply) {
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
