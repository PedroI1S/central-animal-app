import type { Categoria } from './tipos'

// ⚠️ PLACEHOLDER — orientações genéricas para o protótipo.
// Precisam ser revisadas por médico-veterinário antes de qualquer uso real.

export const ORIENTACOES_VALIDADAS = false

export const ORIENTACOES: Record<Categoria, string[]> = {
  atropelamento: [
    'Garanta primeiro a sua segurança no trânsito — sinalize o local.',
    'Evite movimentar a coluna do animal; se precisar transportar, use uma manta ou papelão como maca.',
    'Aproxime-se com calma: animais com dor podem morder.',
  ],
  ferido: [
    'Mantenha o animal em local calmo e protegido.',
    'Se houver sangramento, pressione levemente com um pano limpo.',
    'Não ofereça comida nem medicamentos humanos.',
  ],
  envenenamento: [
    'Não provoque vômito e não ofereça leite, água ou alimentos.',
    'Se possível, fotografe e guarde a substância ou isca suspeita em um saco plástico.',
    'Procure atendimento veterinário imediatamente.',
  ],
  maus_tratos: [
    'Não se coloque em risco nem confronte o agressor.',
    'Se for seguro, registre fotos ou vídeos à distância.',
    'Sua identidade é protegida: o denunciado não terá acesso a ela.',
  ],
  abandono: [
    'Se for seguro, ofereça água e um abrigo improvisado.',
    'Evite separar filhotes da mãe.',
    'Observe se o animal tem coleira ou identificação.',
  ],
  silvestre: [
    'Afaste-se e mantenha crianças e animais domésticos longe.',
    'Não tente capturar nem manusear o animal.',
    'Se alguém foi picado ou mordido, ligue 192 imediatamente.',
  ],
  morto_via: [
    'Não manuseie o animal sem luvas.',
    'Se possível, sinalize o local para evitar novos acidentes.',
  ],
  outro: [
    'Descreva a situação com o máximo de detalhes na próxima etapa.',
    'Se houver risco a pessoas, ligue 190 ou 192.',
  ],
}

export const ORIENTACAO_PESSOA_RISCO = 'Há pessoa em risco: ligue 192 (SAMU) ou 193 (Bombeiros) agora. O registro do animal continua em paralelo.'
