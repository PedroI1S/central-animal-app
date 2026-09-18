import { CATEGORIAS, classificar, PRIORIDADES, type Respostas } from '@ca/triagem'
import { eq, sql } from 'drizzle-orm'
import { hashSenha } from '../auth.ts'
import { client, db, schema } from './index.ts'

// Dados FICTÍCIOS para demonstração. Coordenadas aproximadas de Pato Branco (PR).

const { ocorrencias, eventos, servidores, anexos } = schema
const CENTRO = { lat: -26.2295, lng: -52.6711 }

if (process.argv.includes('--reset')) {
  await db.execute(sql`truncate ${eventos}, ${anexos}, ${ocorrencias}, ${servidores} restart identity cascade`)
  await db.execute(sql`alter sequence protocolo_seq restart with 100`)
  console.log('Banco limpo.')
}

const equipe = await db
  .insert(servidores)
  .values([
    { nome: 'Ana Souza', setor: 'Secretaria de Meio Ambiente', email: 'ana@central.pb', senhaHash: hashSenha('central123') },
    { nome: 'Carlos Lima', setor: 'Vigilância Sanitária', email: 'carlos@central.pb', senhaHash: hashSenha('central123') },
    { nome: 'Juliana Reis', setor: 'Bem-Estar Animal', email: 'juliana@central.pb', senhaHash: hashSenha('central123') },
  ])
  .onConflictDoNothing()
  .returning()

const [ana, carlos, juliana] = equipe.length ? equipe : await db.select().from(servidores)

type Caso = {
  r: Respostas
  relato?: string
  resumo?: string
  bairro: string
  dLat: number
  dLng: number
  minutosAtras: number
  status?: string
  resp?: typeof ana
  providencias?: string[]
  desfecho?: string
}

const N = { pessoa_risco: 'nao', tipo_animal: 'domestico' } as const

const casos: Caso[] = [
  { r: { ...N, situacao: 'maus_tratos', maus_tratos_agora: 'nao' }, relato: 'Cachorro preso em corrente curta, sem água, há dias no quintal da casa ao lado.', resumo: 'Cão mantido em corrente curta sem água há vários dias em quintal residencial.', bairro: 'Bairro Alvorada', dLat: 0.0081, dLng: -0.0052, minutosAtras: 60 * 24 * 12, status: 'encerrada', resp: ana, providencias: ['Fiscalização realizada no local; tutor notificado.'], desfecho: 'Tutor notificado e orientado; retorno de fiscalização em 15 dias.' },
  { r: { ...N, situacao: 'maus_tratos', maus_tratos_agora: 'nao' }, relato: 'O mesmo cachorro continua preso sem água, agora parece mais magro.', resumo: 'Reincidência: cão preso sem água, aparentando perda de peso.', bairro: 'Bairro Alvorada', dLat: 0.0082, dLng: -0.0051, minutosAtras: 60 * 24 * 2, status: 'encaminhada', resp: ana, providencias: ['Nova vistoria agendada com apoio da fiscalização.'] },
  { r: { ...N, situacao: 'abandono', abandono_filhotes: 'sim' }, relato: 'Cadela com uns 5 filhotes embaixo da ponte faz 3 dias.', resumo: 'Cadela com cerca de 5 filhotes abrigada sob ponte há 3 dias.', bairro: 'Bairro Bortot', dLat: -0.0061, dLng: 0.0072, minutosAtras: 60 * 5, status: 'em_atendimento', resp: juliana, providencias: ['Equipe de bem-estar animal a caminho para avaliação.'] },
  { r: { ...N, situacao: 'abandono', abandono_filhotes: 'nao' }, relato: 'Cachorro caramelo de coleira vermelha andando perdido perto do mercado.', bairro: 'Centro', dLat: 0.0012, dLng: 0.0015, minutosAtras: 60 * 3 },
  { r: { ...N, situacao: 'envenenamento', sinais: ['vomito', 'convulsao'], outros_animais: 'sim' }, relato: 'Meu gato começou a babar e tremer, o cachorro da vizinha morreu ontem igual.', resumo: 'Gato com salivação e tremores; vizinha relata morte de cão com sintomas semelhantes — possível envenenamento em série.', bairro: 'Bairro La Salle', dLat: -0.0035, dLng: -0.0081, minutosAtras: 42, status: 'em_atendimento', resp: carlos, providencias: ['Tutor orientado a seguir para o plantão veterinário.', 'Vigilância Sanitária notificada sobre possível isca em via pública.'] },
  { r: { ...N, situacao: 'ferido', sinais: ['nao_levanta'] }, relato: 'Gato machucado na pata, não consegue andar direito, fica escondido embaixo do carro.', bairro: 'Bairro Fraron', dLat: 0.0105, dLng: 0.0031, minutosAtras: 95 },
  { r: { pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'avistado' }, relato: 'Tem um gambá andando no quintal todas as noites.', bairro: 'Bairro Planalto', dLat: -0.0122, dLng: -0.0023, minutosAtras: 60 * 7 },
  { r: { ...N, situacao: 'morto_via' }, relato: 'Cachorro morto na lateral da avenida, perto do semáforo.', bairro: 'Bairro São Cristóvão', dLat: 0.0048, dLng: 0.0112, minutosAtras: 60 * 2, status: 'encaminhada', resp: ana, providencias: ['Encaminhado para recolhimento pelos Serviços Urbanos.'] },
  { r: { ...N, situacao: 'atropelamento', sinais: ['sangramento', 'nao_levanta'] }, relato: 'Atropelaram um cachorro na frente da escola, ele está vivo mas sangrando.', resumo: 'Cão atropelado em frente a escola, vivo, com sangramento e sem conseguir levantar.', bairro: 'Bairro Bancários', dLat: -0.0088, dLng: 0.0041, minutosAtras: 60 * 26, status: 'encerrada', resp: juliana, providencias: ['Animal levado ao plantão veterinário conveniado.'], desfecho: 'Animal atendido, estabilizado e encaminhado para adoção após recuperação.' },
  { r: { ...N, situacao: 'abandono', abandono_filhotes: 'nao' }, bairro: 'Bairro Pinheirinho', dLat: 0.0142, dLng: -0.0094, minutosAtras: 60 * 20 },
  { r: { ...N, situacao: 'outro' }, relato: 'Muitos gatos na praça, as pessoas estão alimentando e está crescendo o número.', resumo: 'Colônia de gatos em crescimento em praça pública, alimentada por moradores.', bairro: 'Centro', dLat: -0.0009, dLng: -0.0021, minutosAtras: 60 * 30 },
]

for (const c of casos) {
  const res = classificar(c.r)
  const criadoEm = new Date(Date.now() - c.minutosAtras * 60_000)
  const [o] = await db
    .insert(ocorrencias)
    .values({
      protocolo: sql`'CA-' || extract(year from now())::int || '-' || lpad(nextval('protocolo_seq')::text, 6, '0')`,
      categoria: res.categoria,
      prioridade: res.prioridade,
      motivos: res.motivos,
      rota: res.rota,
      servicos: res.servicos.map((s) => s.id),
      orientacoes: res.orientacoes,
      respostas: c.r,
      relato: c.relato ?? null,
      resumoIa: c.resumo ?? null,
      iaStatus: c.resumo ? 'ok' : null,
      lat: CENTRO.lat + c.dLat,
      lng: CENTRO.lng + c.dLng,
      endereco: c.bairro,
      status: c.status ?? 'nova',
      responsavelId: c.resp?.id ?? null,
      desfecho: c.desfecho ?? null,
      criadoEm,
      atualizadoEm: criadoEm,
    })
    .returning()

  const linha = [
    { tipo: 'criada', autor: 'Central Animal', texto: `Ocorrência registrada: ${CATEGORIAS[res.categoria]} — prioridade ${PRIORIDADES[res.prioridade].rotulo}.` },
    ...(c.resp ? [{ tipo: 'atribuida', autor: c.resp.nome, texto: `Caso assumido pela equipe: ${c.resp.setor}.` }] : []),
    ...(c.providencias ?? []).map((texto) => ({ tipo: 'providencia', autor: c.resp!.nome, texto })),
    ...(c.desfecho ? [{ tipo: 'encerrada', autor: c.resp!.nome, texto: `Ocorrência encerrada: ${c.desfecho}` }] : []),
  ]
  await db.insert(eventos).values(
    linha.map((e, i) => ({ ...e, ocorrenciaId: o.id, criadoEm: new Date(criadoEm.getTime() + i * 7 * 60_000) })),
  )
  if (c.status) await db.update(ocorrencias).set({ atualizadoEm: new Date(criadoEm.getTime() + linha.length * 7 * 60_000) }).where(eq(ocorrencias.id, o.id))
}

console.log(`Seed: ${casos.length} ocorrências, ${equipe.length} servidores. Login: ana@central.pb / central123`)
await client.end()
