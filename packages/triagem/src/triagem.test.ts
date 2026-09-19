import { describe, expect, it } from 'vitest'
import { classificar, podarRespostas, proximaPergunta } from './index'

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
