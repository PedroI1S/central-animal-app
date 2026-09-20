import type { Capacidade, Respostas, Resultado } from './tipos'

/**
 * Que competência o caso exige de quem vai atender — não qual órgão é responsável (isso é `SERVICOS`).
 * Sai sempre de resposta confirmada pelo cidadão, nunca de texto livre: a IA sugere, as regras decidem.
 */
export const CAPACIDADES: Record<Capacidade, string> = {
  emergencia_humana: 'Emergência humana',
  clinica_veterinaria: 'Clínica veterinária',
  grande_porte: 'Animais de grande porte',
  resgate_fauna: 'Resgate de fauna silvestre',
  serpentes: 'Manejo de serpentes',
  aves: 'Manejo de aves',
  remocao: 'Remoção de carcaça',
}

/**
 * Uma frente de atendimento do caso. Um caso pode ter mais de uma ao mesmo tempo, e elas NÃO
 * competem entre si: numa picada de cobra é preciso socorrer a pessoa **e** lidar com o animal,
 * e recomendar só quem captura serpente é o mesmo que não recomendar ninguém para quem foi picado.
 */
export interface Necessidade {
  id: 'pessoa' | 'animal'
  rotulo: string
  /** Quem atende esta frente precisa cobrir todas estas capacidades. */
  capacidades: Capacidade[]
}

/** Competência para lidar com o animal em si. */
export function capacidadesPara(r: Respostas, res: Resultado): Capacidade[] {
  // Silvestre manda na competência, qualquer que seja a situação: quem tira uma cobra da cozinha
  // não é quem atende um cão atropelado, mesmo os dois sendo "animal ferido".
  if (res.categoria === 'silvestre' || r.tipo_animal === 'silvestre') {
    const grupo = r.grupo_silvestre
    if (grupo === 'serpente') return ['resgate_fauna', 'serpentes']
    if (grupo === 'ave') return ['resgate_fauna', 'aves']
    return ['resgate_fauna']
  }

  if (res.categoria === 'morto_via') return ['remocao']

  // Maus-tratos entram aqui porque a denúncia precisa de exame e laudo veterinário para seguir.
  if (['atropelamento', 'ferido', 'envenenamento', 'maus_tratos'].includes(res.categoria)) {
    return ['clinica_veterinaria']
  }

  return []
}

/**
 * As frentes do caso, na ordem em que importam. **Pessoa sempre primeiro**: quando há gente ferida,
 * nenhuma recomendação sobre o animal pode aparecer antes de quem socorre a pessoa.
 */
export function necessidadesPara(r: Respostas, res: Resultado): Necessidade[] {
  const necessidades: Necessidade[] = []

  if (res.rota === 'humana' || r.pessoa_risco === 'sim') {
    necessidades.push({ id: 'pessoa', rotulo: 'Atender a pessoa', capacidades: ['emergencia_humana'] })
  }

  const animal = capacidadesPara(r, res)
  if (animal.length) necessidades.push({ id: 'animal', rotulo: 'Lidar com o animal', capacidades: animal })

  return necessidades
}
