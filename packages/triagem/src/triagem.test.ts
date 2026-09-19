import { describe, expect, it } from 'vitest'
import { classificar, corrigirCaso, detectarSinais, podarRespostas, proximaPergunta } from './index'

// As quatro jornadas do board (Jornadas - Hoje vs Ideal) como casos de teste.

describe('jornadas', () => {
  it('atropelamento com sangramento → P1 com plantão veterinário', () => {
    const r = classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelamento', sinais: ['sangramento'] })
    expect(r.prioridade).toBe(1)
    expect(r.motivos).toContain('Sangramento intenso')
    expect(r.servicos.map((s) => s.id)).toContain('plantao_vet')
  })

  it('cobra dentro de casa → P1, rota fauna, Bombeiros', () => {
    const r = classificar({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca' })
    expect(r.prioridade).toBe(1)
    expect(r.rota).toBe('fauna')
    expect(r.servicos.map((s) => s.id)).toEqual(expect.arrayContaining(['bombeiros', 'fauna']))
  })

  it('picada em pessoa → rota humana com SAMU', () => {
    const r = classificar({ pessoa_risco: 'sim', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca' })
    expect(r.rota).toBe('humana')
    expect(r.servicos[0].id).toBe('samu')
    expect(r.orientacoes[0]).toMatch(/192/)
  })

  it('abandono sem filhotes → P4; com filhotes → P3', () => {
    expect(classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono', abandono_filhotes: 'nao' }).prioridade).toBe(4)
    expect(classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono', abandono_filhotes: 'sim' }).prioridade).toBe(3)
  })

  it('envenenamento em série → P1 e polícia acionada', () => {
    const r = classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'envenenamento', sinais: ['vomito'], outros_animais: 'sim' })
    expect(r.prioridade).toBe(1)
    expect(r.rota).toBe('policial')
    expect(r.motivos).toContain('Possível envenenamento em série')
  })
})

describe('regras de segurança', () => {
  it('silvestre atropelado com convulsão → P1 na rota de fauna (caso da capivara)', () => {
    expect(proximaPergunta({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ferido' })?.id).toBe('sinais')
    const r = classificar({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ferido', sinais: ['convulsao'] })
    expect(r.prioridade).toBe(1)
    expect(r.rota).toBe('fauna')
    expect(r.servicos.map((s) => s.id)).toContain('fauna')
  })

  it('sinal vital sempre eleva a P1, mesmo em categoria de baixa prioridade', () => {
    expect(classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'ferido', sinais: ['convulsao'] }).prioridade).toBe(1)
  })

  it('maus-tratos em flagrante → P1 com PM', () => {
    const r = classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'maus_tratos', maus_tratos_agora: 'sim' })
    expect(r.prioridade).toBe(1)
    expect(r.servicos.map((s) => s.id)).toContain('pm')
  })
})

describe('pré-triagem adaptativa', () => {
  it('maus-tratos com sangramento → P1 (sinais também valem para maus-tratos)', () => {
    expect(proximaPergunta({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'maus_tratos' })?.id).toBe('sinais')
    expect(classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'maus_tratos', sinais: ['sangramento'], maus_tratos_agora: 'nao' }).prioridade).toBe(1)
  })

  it('atropelamento pergunta sinais; abandono não', () => {
    expect(proximaPergunta({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelamento' })?.id).toBe('sinais')
    expect(proximaPergunta({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono' })?.id).toBe('abandono_filhotes')
  })

  it('termina quando não há mais perguntas relevantes', () => {
    expect(proximaPergunta({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'morto_via' })).toBeNull()
  })

  it('poda respostas que deixaram de ser relevantes', () => {
    const r = podarRespostas({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao: 'abandono', abandono_filhotes: 'sim', situacao_silvestre: 'avistado' })
    expect(r).toEqual({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'avistado' })
  })
})

describe('detecção de sinais por palavra-chave', () => {
  const casos: [string, string[]][] = [
    ['bati num cachorro, ele tá vivo mas sangrando e não consegue levantar', ['sangramento', 'nao_levanta']],
    ['atropelaro um dog na br, ta mt mal, n levanta e ta saindo sangue', ['sangramento', 'nao_levanta']],
    ['ele não está sangrando, mas não consegue andar', ['nao_levanta']],
    ['está sem sangue nenhum, parece bem', []],
    ['cachorro trancado no carro no sol, ofegante', ['respiracao']],
    ['meu cachorro desmaiou e está respirando com dificuldade', ['inconsciente', 'respiracao']],
    ['meu gato está babando e tremendo muito', ['vomito', 'convulsao']],
    ['hay un perro atropellado, está sangrando mucho y no puede levantarse', ['sangramento', 'nao_levanta']],
    ['meu gato subiu na árvore e não consegue descer', []],
    ['não para em pé e está vomitando', ['nao_levanta', 'vomito']],
  ]
  for (const [texto, esperado] of casos) {
    it(texto, () => expect(detectarSinais(texto).sort()).toEqual([...esperado].sort()))
  }
})

describe('correção determinística da categoria', () => {
  const casos: [string, string, string][] = [
    ['ferido', 'atropelaram um gato aqui, ele não está sangrando', 'atropelamento'],
    ['ferido', 'atropelaro um dog na br', 'atropelamento'],
    ['outro', 'bati com o carro num cachorro', 'atropelamento'],
    ['maus_tratos', 'o vizinho envenenou meu gato', 'envenenamento'],
    ['silvestre_perto_de_pessoas', 'meu gato subiu na árvore e não desce', 'outro'],
    ['silvestre_ferido', 'meu cachorro está ferido no quintal', 'ferido'],
    ['silvestre_ferido', 'atropelaram minha capivara', 'silvestre_ferido'],
    ['silvestre_perto_de_pessoas', 'uma cobra entrou na casa do meu cachorro', 'silvestre_perto_de_pessoas'],
    ['maus_tratos', 'o vizinho está batendo no cachorro', 'maus_tratos'],
    ['abandono', 'cachorro abandonado na praça', 'abandono'],
  ]
  for (const [ia, texto, esperado] of casos) {
    it(`${ia} + "${texto}" → ${esperado}`, () => expect(corrigirCaso(ia, texto)).toBe(esperado))
  }
})
