import { ORIENTACOES, ORIENTACAO_PESSOA_RISCO } from './orientacoes'
import { SERVICOS, type ServicoId } from './servicos'
import type { Categoria, Prioridade, Respostas, Resultado, Rota } from './tipos'

// Sinais que tornam o caso crítico sem exceção (regra que não pode ser anulada).
const SINAIS_VITAIS: Record<string, string> = {
  sangramento: 'Sangramento intenso',
  respiracao: 'Dificuldade respiratória',
  inconsciente: 'Inconsciente',
  convulsao: 'Convulsão',
}

const SINAIS_ALTOS: Record<string, string> = {
  nao_levanta: 'Não consegue se levantar',
  vomito: 'Vômito / salivação',
}

function lista(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

export function classificar(r: Respostas): Resultado {
  let prioridade: Prioridade = 4
  const motivos: string[] = []
  const servicos = new Set<ServicoId>()
  let rota: Rota = 'municipal'

  // Na dúvida o sistema sobe a prioridade, nunca desce.
  const subir = (p: Prioridade, motivo: string) => {
    if (p < prioridade) prioridade = p
    motivos.push(motivo)
  }

  const categoria: Categoria =
    r.tipo_animal === 'silvestre' ? 'silvestre' : ((r.situacao as Categoria) ?? 'outro')

  if (r.pessoa_risco === 'sim') {
    subir(1, 'Pessoa em risco')
    rota = 'humana'
    servicos.add('samu').add('bombeiros')
  }

  switch (categoria) {
    case 'atropelamento':
      subir(1, 'Atropelamento')
      servicos.add('plantao_vet').add('meio_ambiente')
      break
    case 'ferido':
      subir(2, 'Animal ferido')
      servicos.add('plantao_vet').add('meio_ambiente')
      break
    case 'envenenamento':
      subir(1, 'Suspeita de envenenamento')
      servicos.add('plantao_vet').add('vigilancia')
      if (r.outros_animais === 'sim') {
        motivos.push('Possível envenenamento em série')
        servicos.add('pm')
        if (rota === 'municipal') rota = 'policial'
      }
      break
    case 'maus_tratos':
      if (r.maus_tratos_agora === 'sim') {
        subir(1, 'Maus-tratos em andamento')
        servicos.add('pm')
        if (rota === 'municipal') rota = 'policial'
      } else {
        subir(2, 'Denúncia de maus-tratos')
      }
      servicos.add('meio_ambiente')
      break
    case 'abandono':
      if (r.abandono_filhotes === 'sim') subir(3, 'Abandono com filhotes')
      else subir(4, 'Animal abandonado')
      servicos.add('meio_ambiente')
      break
    case 'silvestre':
      if (rota === 'municipal') rota = 'fauna'
      if (r.situacao_silvestre === 'ameaca') {
        subir(1, 'Animal silvestre perto de pessoas')
        servicos.add('bombeiros')
      } else if (r.situacao_silvestre === 'ferido') {
        subir(2, 'Animal silvestre ferido')
      } else {
        subir(3, 'Animal silvestre avistado')
      }
      servicos.add('fauna')
      break
    case 'morto_via':
      subir(4, 'Animal morto na via')
      servicos.add('servicos_urbanos')
      break
    default:
      subir(3, 'Outra situação')
      servicos.add('meio_ambiente')
  }

  for (const s of lista(r.sinais)) {
    if (SINAIS_VITAIS[s]) subir(1, SINAIS_VITAIS[s])
    else if (SINAIS_ALTOS[s]) subir(2, SINAIS_ALTOS[s])
  }

  const orientacoes = [...ORIENTACOES[categoria]]
  if (r.pessoa_risco === 'sim') orientacoes.unshift(ORIENTACAO_PESSOA_RISCO)

  return {
    categoria,
    prioridade,
    motivos: [...new Set(motivos)],
    rota,
    servicos: [...servicos].map((id) => SERVICOS[id]),
    orientacoes,
  }
}

export const PRIORIDADES: Record<Prioridade, { rotulo: string; prazo: string; cor: string }> = {
  1: { rotulo: 'Crítica', prazo: 'Atendimento imediato', cor: '#dc2626' },
  2: { rotulo: 'Alta', prazo: 'Atendimento no mesmo dia', cor: '#ea580c' },
  3: { rotulo: 'Média', prazo: 'Atendimento em até 72 h', cor: '#ca8a04' },
  4: { rotulo: 'Baixa', prazo: 'Atendimento programado', cor: '#16a34a' },
}

export const CATEGORIAS: Record<Categoria, string> = {
  atropelamento: 'Atropelamento',
  ferido: 'Animal ferido',
  envenenamento: 'Envenenamento',
  maus_tratos: 'Maus-tratos',
  abandono: 'Abandono',
  silvestre: 'Animal silvestre',
  morto_via: 'Animal morto na via',
  outro: 'Outra situação',
}
