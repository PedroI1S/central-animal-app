import type { Servico } from './tipos'

// ⚠️ PLACEHOLDER — tabela de competência a pactuar com a Prefeitura de Pato Branco.
// Apenas 190/192/193 são números reais; os contatos municipais ficam null até a validação.

export const SERVICOS = {
  samu: { id: 'samu', nome: 'SAMU', orgao: 'Saúde', telefone: '192', emergencia: true },
  bombeiros: { id: 'bombeiros', nome: 'Corpo de Bombeiros', orgao: 'Estado do Paraná', telefone: '193', emergencia: true },
  pm: { id: 'pm', nome: 'Polícia Militar', orgao: 'Estado do Paraná', telefone: '190', emergencia: true },
  fauna: { id: 'fauna', nome: 'IAT / Polícia Ambiental', orgao: 'Estado do Paraná', telefone: null },
  meio_ambiente: { id: 'meio_ambiente', nome: 'Secretaria de Meio Ambiente', orgao: 'Prefeitura de Pato Branco', telefone: null },
  plantao_vet: { id: 'plantao_vet', nome: 'Plantão veterinário conveniado', orgao: 'Rede credenciada', telefone: null },
  vigilancia: { id: 'vigilancia', nome: 'Vigilância Sanitária', orgao: 'Prefeitura de Pato Branco', telefone: null },
  servicos_urbanos: { id: 'servicos_urbanos', nome: 'Serviços Urbanos', orgao: 'Prefeitura de Pato Branco', telefone: null },
} satisfies Record<string, Servico>

export type ServicoId = keyof typeof SERVICOS
