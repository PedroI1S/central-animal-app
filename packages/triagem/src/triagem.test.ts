import { describe, expect, it } from 'vitest'
import {
  aplicarVivo,
  capacidadesPara,
  necessidadesPara,
  citaMorte,
  classificar,
  corrigirCaso,
  detectarPessoaEmRisco,
  detectarSinais,
  montarSugestao,
  podarRespostas,
  proximaPergunta,
  validarRespostas,
} from './index'

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
    // O grupo do animal é a última pergunta de todo caso doméstico: muda quem remove a carcaça.
    const r = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'morto_via' }
    expect(proximaPergunta(r)?.id).toBe('grupo_domestico')
    expect(proximaPergunta({ ...r, grupo_domestico: 'cao' })).toBeNull()
  })

  it('o grupo é sempre a última pergunta — prioridade primeiro, quem atende depois', () => {
    const abandono = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono' }
    expect(proximaPergunta(abandono)?.id).toBe('abandono_filhotes')
    expect(proximaPergunta({ ...abandono, abandono_filhotes: 'sim' })?.id).toBe('grupo_domestico')

    const envenenamento = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'envenenamento', sinais: ['vomito'] }
    expect(proximaPergunta(envenenamento)?.id).toBe('outros_animais')
    expect(proximaPergunta({ ...envenenamento, outros_animais: 'nao' })?.id).toBe('grupo_domestico')
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
    // negação dupla e verbo negado: o sinal está presente
    ['ele não para de sangrar', ['sangramento']],
    ['não parou de tremer desde cedo', ['convulsao']],
    ['não para de vomitar', ['vomito']],
    ['meu cachorro não consegue respirar direito', ['respiracao']],
    ['o gato não está respirando', ['respiracao']],
    ['nem consegue respirar', ['respiracao']],
    ['cachorro caído sem conseguir respirar', ['respiracao']],
    ['parou de respirar agora', ['respiracao']],
    ['não sei se está respirando', ['respiracao']],
    ['nunca vi tanto sangue', ['sangramento']],
    // a negação não atravessa a frase
    ['Tentei ajudar mas não deu. Está sangrando muito', ['sangramento']],
    ['Não. Ele está sangrando muito', ['sangramento']],
    ['não, ele está sangrando', ['sangramento']],
    // jeitos de dizer que faltavam
    ['não para de tremer', ['convulsao']],
    ['o cachorro não se mexe', ['inconsciente']],
    ['não acorda de jeito nenhum', ['inconsciente']],
    ['está sem reação', ['inconsciente']],
    ['está arrastando as patas de trás', ['nao_levanta']],
    ['não está sangrando, só respira muito rápido', ['respiracao']],
    // negações legítimas e o que não é sinal
    ['não está sangrando', []],
    ['não tem nenhum sangramento', []],
    ['já parou de sangrar', []],
    ['foi atropelado mas ainda está respirando', []],
    ['respira normal, só está assustado', []],
    ['não tem falta de ar', []],
  ]
  for (const [texto, esperado] of casos) {
    it(texto, () => expect(detectarSinais(texto).sort()).toEqual([...esperado].sort()))
  }
})

describe('pessoa em risco citada no relato', () => {
  const casos: [string, boolean][] = [
    ['o cachorro do vizinho mordeu meu filho e fugiu', true],
    ['tem um cachorro bravo solto na rua atacando as pessoas', true],
    ['uma cobra picou a minha mãe', true],
    ['bati a moto num cachorro e me machuquei', true],
    ['o cachorro me mordeu', true],
    ['fui picada por uma aranha', true],
    ['a criança foi mordida pelo cachorro', true],
    ['tem uma cobra perto das crianças', true],
    // o dono do animal não é a vítima
    ['o cachorro do vizinho está ferido', false],
    ['o gato da minha mãe foi atropelado', false],
    ['o cachorro da vizinha está sangrando', false],
    ['o cachorro mordeu o gato', false],
    ['atropelaram um cachorro e o motorista fugiu', false],
    ['o homem está batendo no cachorro', false],
  ]
  for (const [texto, esperado] of casos) {
    it(`${esperado ? 'sim' : 'não'}: ${texto}`, () => expect(detectarPessoaEmRisco(texto)).toBe(esperado))
  }
})

describe('morte citada', () => {
  it('reconhece morte e negação de morte', () => {
    expect(citaMorte('tem um gato morto na frente da escola')).toBe(true)
    expect(citaMorte('ele morreu ontem')).toBe(true)
    expect(citaMorte('não está morto, respira fraco')).toBe(false)
    expect(citaMorte('está morrendo')).toBe(false)
  })
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
    // "bateu no" sem veículo é agressão, não atropelamento
    ['ferido', 'o vizinho bateu no cachorro com um pau e ele está mancando', 'ferido'],
    ['maus_tratos', 'o homem bateu na cadela ontem', 'maus_tratos'],
    ['outro', 'os carros passaram por cima do cachorro', 'atropelamento'],
    ['ferido', 'um carro pegou o gato na esquina', 'atropelamento'],
    // "passaram" não é passarinho: gato → doméstico, e carro por cima → atropelamento
    ['silvestre_ferido', 'os carros passaram por cima do gato', 'atropelamento'],
    // só bicho silvestre no texto: não é "animal ferido"
    ['ferido', 'achei um escorpião no quarto do meu filho', 'silvestre_perto_de_pessoas'],
    ['outro', 'tem uma cobra na sala perto do meu bebê', 'silvestre_perto_de_pessoas'],
    ['outro', 'enxame de abelhas no telhado da escola', 'silvestre_perto_de_pessoas'],
    ['ferido', 'pombo machucado na calçada, com a asa quebrada', 'silvestre_ferido'],
    // passarinho no quintal não é emergência de Bombeiros
    ['ferido', 'um filhote de passarinho caiu do ninho no meu quintal', 'silvestre_ferido'],
    ['outro', 'tem um tatu andando no meu quintal', 'silvestre_avistado'],
  ]
  for (const [ia, texto, esperado] of casos) {
    it(`${ia} + "${texto}" → ${esperado}`, () => expect(corrigirCaso(ia, texto)).toBe(esperado))
  }
})

describe('sugestão da IA → respostas da árvore', () => {
  it('sinal não vital não some na poda: abandonado que não levanta vira ferido (P2, não P4)', () => {
    const s = montarSugestao('abandono', ['nao_levanta'], 'tem um cachorro abandonado na praça que não consegue levantar')
    expect(s.respostas).toEqual({ tipo_animal: 'domestico', situacao: 'ferido' })
    // Ainda não é crítico: a pergunta de sinais aparece, já marcada, para o cidadão acrescentar o que faltar.
    expect(s.sinaisEscritos).toEqual(['nao_levanta'])
    expect(classificar({ pessoa_risco: 'nao', ...s.respostas, sinais: s.sinaisEscritos }).prioridade).toBe(2)
  })

  it('sinal vital escrito com todas as letras vale direto, sem perguntar de novo', () => {
    const s = montarSugestao('atropelamento', ['sangramento'], 'bati num cachorro com o carro, ele está sangrando')
    expect(s.respostas.sinais).toEqual(['sangramento'])
    expect(s.sinaisEscritos).toEqual([])
  })

  it('sinal que só a IA viu é confirmado com o cidadão ("sarna" não é sangramento)', () => {
    const s = montarSugestao('maus_tratos', ['sangramento'], 'o cachorro da rua está muito magro e com sarna')
    expect(s.respostas.sinais).toBeUndefined()
    expect(s.sinaisEscritos).toEqual([])
    expect(s.sinaisDaIa).toEqual(['sangramento'])
  })

  it('silvestre avistado com sinal vira silvestre ferido', () => {
    expect(montarSugestao('silvestre_avistado', ['vomito'], 'tem um gambá babando no quintal').respostas.situacao_silvestre).toBe('ferido')
  })

  it('caso fora da lista vira "outro" em vez de derrubar a classificação', () => {
    expect(montarSugestao('atropelado', [], 'bla bla').respostas.situacao).toBe('outro')
  })

  it('sinais inventados fora da lista são descartados', () => {
    const s = montarSugestao('ferido', ['nenhum', 'dor'], 'meu gato está mancando')
    expect(s.respostas.sinais).toBeUndefined()
    expect(s.sinaisDaIa).toEqual([])
  })

  it('morto com sangue: sobe por segurança, mas marca para perguntar se está vivo', () => {
    const s = montarSugestao('morto_via', ['sangramento'], 'tem um cachorro morto na avenida, muito sangue no asfalto')
    expect(s.respostas.situacao).toBe('ferido')
    expect(s.vivoIncerto).toBe(true)
  })

  it('morto sem sinais: nada a perguntar', () => {
    const s = montarSugestao('morto_via', [], 'tem um gato morto na frente da escola faz dois dias')
    expect(s).toEqual({ respostas: { tipo_animal: 'domestico', situacao: 'morto_via' }, vivoIncerto: false, sinaisEscritos: [], sinaisDaIa: [] })
  })

  it('"parece morto" é dúvida: pergunta mesmo quando a IA disse morto', () => {
    expect(montarSugestao('morto_via', [], 'o cachorro parece morto na calçada').vivoIncerto).toBe(true)
  })

  it('envenenamento com o animal morto continua envenenamento, sem perguntar', () => {
    const s = montarSugestao('envenenamento', [], 'semana passada envenenaram meu cachorro, ele morreu')
    expect(s).toEqual({ respostas: { tipo_animal: 'domestico', situacao: 'envenenamento' }, vivoIncerto: false, sinaisEscritos: [], sinaisDaIa: [] })
  })

  it('perguntas da IA não entram na detecção: só o texto do cidadão', () => {
    expect(montarSugestao('ferido', [], 'sim').sinaisEscritos).toEqual([])
  })

  it('abelhas no telhado da escola não são "só avistei"', () => {
    expect(montarSugestao('silvestre_avistado', [], 'enxame de abelhas no telhado da escola').respostas.situacao_silvestre).toBe('ameaca')
    expect(montarSugestao('silvestre_avistado', [], 'tem um tatu andando no meu quintal').respostas.situacao_silvestre).toBe('avistado')
  })

  it('relato em inglês: sinais básicos por palavra-chave', () => {
    expect(detectarSinais('a dog was hit by a car and is bleeding a lot')).toEqual(['sangramento'])
    expect(detectarSinais('the cat is not bleeding')).toEqual([])
  })
})

describe('resposta "o animal ainda está vivo?"', () => {
  const ferido = { tipo_animal: 'domestico', situacao: 'ferido', sinais: ['sangramento'] }
  it('não → animal morto, sem sinais (P4)', () => {
    const r = aplicarVivo(ferido, 'nao')
    expect(r).toEqual({ tipo_animal: 'domestico', situacao: 'morto_via' })
    expect(classificar({ pessoa_risco: 'nao', ...r }).prioridade).toBe(4)
  })
  it('sim ou não sei → segue ferido; "morto" com dúvida sobe para ferido', () => {
    expect(aplicarVivo(ferido, 'sim')).toEqual(ferido)
    expect(aplicarVivo({ tipo_animal: 'domestico', situacao: 'morto_via' }, 'nao_sei').situacao).toBe('ferido')
  })
  it('silvestre morto dentro de casa deixa de ser ameaça', () => {
    expect(aplicarVivo({ tipo_animal: 'silvestre', situacao_silvestre: 'ameaca' }, 'nao').situacao_silvestre).toBe('avistado')
  })
})

describe('validação das respostas recebidas', () => {
  it('descarta pergunta desconhecida, valor inventado e chave de protótipo', () => {
    const r = validarRespostas({
      pessoa_risco: 'nao',
      tipo_animal: 'domestico',
      situacao: 'atropelado',
      sinais: ['sangramento', 'dor'],
      constructor: 'x',
      qualquer: 'coisa',
    })
    expect(r).toEqual({ pessoa_risco: 'nao', tipo_animal: 'domestico', sinais: ['sangramento'] })
    expect(proximaPergunta(podarRespostas(r))?.id).toBe('situacao')
  })

  it('classificar não quebra com categoria fora da lista', () => {
    expect(classificar({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelado' }).categoria).toBe('outro')
  })
})

describe('capacidades — quem consegue atender', () => {
  const caps = (r: Record<string, string | string[]>) => capacidadesPara(r, classificar(r))

  // O caso que prova o conceito: mesma gravidade, mesma rua, profissionais diferentes.
  it('cão atropelado pede clínica; cobra em casa pede manejo de serpente', () => {
    const cao = caps({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelamento', sinais: ['sangramento'] })
    const cobra = caps({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca', grupo_silvestre: 'serpente' })

    expect(cao).toEqual(['clinica_veterinaria'])
    expect(cobra).toEqual(['resgate_fauna', 'serpentes'])
    expect(cao.some((c) => cobra.includes(c))).toBe(false)
  })

  it('ave silvestre ferida separa de serpente', () => {
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ferido', grupo_silvestre: 'ave' })).toEqual([
      'resgate_fauna',
      'aves',
    ])
  })

  it('silvestre sem grupo informado ainda pede resgate de fauna', () => {
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'avistado' })).toEqual(['resgate_fauna'])
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca', grupo_silvestre: 'outro' })).toEqual([
      'resgate_fauna',
    ])
  })

  it('animal morto na via é remoção, não clínica', () => {
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'morto_via' })).toEqual(['remocao'])
  })

  it('maus-tratos pedem veterinário — a denúncia precisa de laudo', () => {
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'maus_tratos', maus_tratos_agora: 'sim' })).toEqual([
      'clinica_veterinaria',
    ])
  })

  it('abandono sem ferimento não exige competência específica', () => {
    expect(caps({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono', abandono_filhotes: 'nao' })).toEqual([])
  })

  it('a árvore pergunta o grupo só quando o animal é silvestre', () => {
    const silvestre = podarRespostas({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca' })
    expect(proximaPergunta(silvestre)?.id).toBe('grupo_silvestre')

    const domestico = podarRespostas({ pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'abandono' })
    expect(proximaPergunta(domestico)?.id).not.toBe('grupo_silvestre')
  })

  it('trocar silvestre por doméstico descarta o grupo', () => {
    const r = podarRespostas({ pessoa_risco: 'nao', tipo_animal: 'domestico', grupo_silvestre: 'serpente', situacao: 'abandono' })
    expect(r.grupo_silvestre).toBeUndefined()
  })
})

describe('frentes de atendimento — pessoa antes do animal', () => {
  const nec = (r: Record<string, string | string[]>) => necessidadesPara(r, classificar(r))

  // Regressão do CA-2026-000213: "meu amigo pisou em uma cobra, ela picou ele".
  // A recomendação listava três lugares que capturam serpente e nenhum para a pessoa picada.
  it('picada de cobra recomenda atendimento humano ANTES do manejo do animal', () => {
    const f = nec({ pessoa_risco: 'sim', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca', grupo_silvestre: 'serpente' })

    expect(f.map((x) => x.id)).toEqual(['pessoa', 'animal'])
    expect(f[0].capacidades).toEqual(['emergencia_humana'])
    expect(f[1].capacidades).toEqual(['resgate_fauna', 'serpentes'])
  })

  it('sem pessoa em risco só há a frente do animal', () => {
    const f = nec({ pessoa_risco: 'nao', tipo_animal: 'silvestre', situacao_silvestre: 'ameaca', grupo_silvestre: 'serpente' })
    expect(f.map((x) => x.id)).toEqual(['animal'])
  })

  it('pessoa em risco num caso doméstico também abre a frente humana primeiro', () => {
    const f = nec({ pessoa_risco: 'sim', tipo_animal: 'domestico', situacao: 'atropelamento', sinais: ['sangramento'] })
    expect(f.map((x) => x.id)).toEqual(['pessoa', 'animal'])
  })

  it('a frente do animal continua sendo a capacidade de antes', () => {
    const r = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelamento', sinais: ['sangramento'] }
    expect(nec(r)[0].capacidades).toEqual(capacidadesPara(r, classificar(r)))
  })
})

describe('grupo do animal doméstico', () => {
  const caps = (r: Record<string, string | string[]>) => capacidadesPara(r, classificar(r))

  it('cavalo atropelado exige clínica de grande porte; cão não', () => {
    const base = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'atropelamento', sinais: ['sangramento'] }
    expect(caps({ ...base, grupo_domestico: 'grande_porte' })).toEqual(['clinica_veterinaria', 'grande_porte'])
    expect(caps({ ...base, grupo_domestico: 'cao' })).toEqual(['clinica_veterinaria'])
  })

  it('carcaça de grande porte exige remoção com capacidade para grande porte', () => {
    const base = { pessoa_risco: 'nao', tipo_animal: 'domestico', situacao: 'morto_via' }
    expect(caps({ ...base, grupo_domestico: 'grande_porte' })).toEqual(['remocao', 'grande_porte'])
    expect(caps({ ...base, grupo_domestico: 'gato' })).toEqual(['remocao'])
  })

  it('trocar para silvestre descarta o grupo doméstico', () => {
    const r = podarRespostas({ pessoa_risco: 'nao', tipo_animal: 'silvestre', grupo_domestico: 'cao', situacao_silvestre: 'avistado' })
    expect(r.grupo_domestico).toBeUndefined()
  })
})
