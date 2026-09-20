import { boolean, doublePrecision, jsonb, pgSequence, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const protocoloSeq = pgSequence('protocolo_seq', { startWith: 100 })

export const servidores = pgTable('servidores', {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  setor: text().notNull(),
  email: text().notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
})

/**
 * ⚠️ PLACEHOLDER — cadastro fictício, a pactuar com a Prefeitura (mesmo estado de `servicos.ts`).
 * Separado de `servidores`: ali são logins do painel, aqui é quem atende em campo e em geral
 * nem usa o app. `atende24h` + `observacao` são a simplificação de escala para o protótipo.
 */
export const profissionais = pgTable('profissionais', {
  id: uuid().primaryKey().defaultRandom(),
  nome: text().notNull(),
  orgao: text().notNull(),
  telefone: text(), // null = contato ainda a pactuar
  lat: doublePrecision().notNull(),
  lng: doublePrecision().notNull(),
  capacidades: text().array().notNull(),
  atende24h: boolean('atende_24h').notNull().default(false),
  observacao: text(),
  ativo: boolean().notNull().default(true),
})

export const ocorrencias = pgTable('ocorrencias', {
  id: uuid().primaryKey().defaultRandom(),
  protocolo: text().notNull().unique(),
  categoria: text().notNull(),
  prioridade: smallint().notNull(),
  motivos: text().array().notNull(),
  rota: text().notNull(),
  servicos: text().array().notNull(),
  orientacoes: text().array().notNull(),
  status: text().notNull().default('nova'), // nova | em_atendimento | encaminhada | encerrada | improcedente
  respostas: jsonb().notNull(),
  relato: text(), // texto livre do cidadão
  sugestaoIa: jsonb('sugestao_ia'), // o que o Qwen extraiu — para auditar contra o que foi confirmado
  resumoIa: text('resumo_ia'),
  analiseFotoIa: text('analise_foto_ia'),
  iaStatus: text('ia_status'), // null | pendente | ok | erro
  lat: doublePrecision(),
  lng: doublePrecision(),
  endereco: text(),
  anonimo: boolean().notNull().default(true),
  contatoNome: text('contato_nome'),
  contatoTel: text('contato_tel'),
  responsavelId: uuid('responsavel_id').references(() => servidores.id),
  desfecho: text(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
})

export const anexos = pgTable('anexos', {
  id: uuid().primaryKey().defaultRandom(),
  ocorrenciaId: uuid('ocorrencia_id').notNull().references(() => ocorrencias.id, { onDelete: 'cascade' }),
  caminho: text().notNull(),
  mime: text().notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})

export const eventos = pgTable('eventos', {
  id: uuid().primaryKey().defaultRandom(),
  ocorrenciaId: uuid('ocorrencia_id').notNull().references(() => ocorrencias.id, { onDelete: 'cascade' }),
  tipo: text().notNull(), // criada | atribuida | providencia | status | reclassificada | encerrada
  autor: text().notNull(),
  texto: text().notNull(),
  visivelCidadao: boolean('visivel_cidadao').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
})
