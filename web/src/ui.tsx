import { CATEGORIAS, PERGUNTAS, PRIORIDADES, type Categoria, type Prioridade, type Servico } from '@ca/triagem'
import { useEffect, useState, type ReactNode } from 'react'
import { Telefone } from './icones'

// Cor é da prioridade. O status fala pelo peso: cheio = ninguém pegou ainda, contorno = em andamento, sem caixa = fechado.
// `noite` é o painel (fundo escuro); `papel`, o celular do cidadão.
export const STATUS: Record<string, { rotulo: string; noite: string; papel: string }> = {
  nova: { rotulo: 'Nova', noite: 'bg-claro text-tinta', papel: 'bg-tinta text-white' },
  em_atendimento: { rotulo: 'Em atendimento', noite: 'ring-1 ring-nevoa ring-inset text-claro', papel: 'ring-1 ring-tinta ring-inset text-tinta' },
  encaminhada: { rotulo: 'Encaminhada', noite: 'ring-1 ring-nevoa ring-inset text-claro', papel: 'ring-1 ring-tinta ring-inset text-tinta' },
  encerrada: { rotulo: 'Encerrada', noite: 'text-nevoa', papel: 'text-suave' },
  improcedente: { rotulo: 'Improcedente', noite: 'text-nevoa', papel: 'text-suave' },
}

// Fundo + texto de cada prioridade. Com as cores do Plantão, tinta passa nas quatro (P1 5,7 · P2 5,9 · P3 11,1 · P4 5,5)
// e branco em nenhuma — então a regra é uma só.
export const CLASSE_PRIORIDADE: Record<Prioridade, string> = {
  1: 'bg-p1 text-tinta',
  2: 'bg-p2 text-tinta',
  3: 'bg-p3 text-tinta',
  4: 'bg-p4 text-tinta',
}

/**
 * autoFocus em celular abre o teclado na hora e empurra a conversa para fora da tela — e o cidadão
 * chega aqui para ler a pergunta, não para digitar de imediato. Só com ponteiro fino (mouse/trackpad).
 */
export const FOCO_AUTOMATICO = window.matchMedia('(pointer: fine)').matches

/** Aberto no próprio notebook (não pelo túnel): só aqui aparecem o atalho do painel e o login de teste. */
export const ACESSO_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname)

/** Pata do deck (Font Awesome Free 6, CC BY 4.0 — fontawesome.com/license/free). */
export function Pata({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M226.5 92.9c14.3 42.9-.3 86.2-32.6 96.8s-70.1-15.6-84.4-58.5s.3-86.2 32.6-96.8s70.1 15.6 84.4 58.5zM100.4 198.6c18.9 32.4 14.3 70.1-10.2 84.1s-59.7-.9-78.5-33.3S-2.7 179.3 21.8 165.3s59.7 .9 78.5 33.3zM69.2 401.2C121.6 259.9 214.7 224 256 224s134.4 35.9 186.8 177.2c3.6 9.7 5.2 20.1 5.2 30.5l0 1.6c0 25.8-20.9 46.7-46.7 46.7c-11.5 0-22.9-1.4-34-4.2l-88-22c-15.3-3.8-31.3-3.8-46.6 0l-88 22c-11.1 2.8-22.5 4.2-34 4.2C84.9 480 64 459.1 64 433.3l0-1.6c0-10.4 1.6-20.8 5.2-30.5zM421.8 282.7c-24.5-14-29.1-51.7-10.2-84.1s54-47.3 78.5-33.3s29.1 51.7 10.2 84.1s-54 47.3-78.5 33.3zM310.1 189.7c-32.3-10.6-46.9-53.9-32.6-96.8s52.1-69.1 84.4-58.5s46.9 53.9 32.6 96.8s-52.1 69.1-84.4 58.5z" />
    </svg>
  )
}

export const corPrioridade = (p: Prioridade) => PRIORIDADES[p].cor

export function SeloPrioridade({ p, grande = false }: { p: Prioridade; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] font-display font-extrabold tracking-wide uppercase ${CLASSE_PRIORIDADE[p]} ${grande ? 'px-3 py-1 text-xl leading-none' : 'px-2 py-0.5 text-[15px] leading-tight'}`}
    >
      P{p} · {PRIORIDADES[p].rotulo}
    </span>
  )
}

/**
 * A etiqueta de triagem do deck: cartão vertical com o furo do barbante no alto. Na fila é o que se lê primeiro,
 * da cor da prioridade, com o número em tinta.
 */
export function EtiquetaTriagem({ p, className = 'h-20 w-[42px] text-[22px]', furo = 'bg-noite-1' }: { p: Prioridade; className?: string; furo?: string }) {
  return (
    <span
      className={`flex shrink-0 flex-col items-center justify-between rounded-[3px] pt-2 pb-1.5 font-display leading-none font-extrabold ${CLASSE_PRIORIDADE[p]} ${className}`}
    >
      <span aria-hidden="true" className={`size-[7px] rounded-full ${furo}`} />
      <span>
        <span className="sr-only">Prioridade </span>P{p}
      </span>
    </span>
  )
}

export function SeloStatus({ status, noite = false }: { status: string; noite?: boolean }) {
  const s = STATUS[status]
  const classe = s ? (noite ? s.noite : s.papel) : noite ? 'text-nevoa' : 'text-suave'
  return (
    <span className={`rounded-[2px] px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.08em] whitespace-nowrap uppercase ${classe}`}>
      {s?.rotulo ?? status}
    </span>
  )
}

/** Rótulo pronto da categoria. Sem emoji: o ícone decorativo saiu com o redesenho. */
export const rotuloCategoria = (c: Categoria) => CATEGORIAS[c]

/** Espécie a partir das respostas da triagem: "Gato", "Serpente"… (nada quando o cidadão não disse). */
export function especieDe(respostas: Record<string, string | string[]>): string | null {
  const grupo = (respostas.grupo_domestico ?? respostas.grupo_silvestre) as string | undefined
  if (!grupo || grupo === 'outro') return null
  return rotuloResposta(respostas.grupo_domestico ? 'grupo_domestico' : 'grupo_silvestre', grupo)
}

/** "sangramento" → "Sangramento intenso", usando os rótulos da própria árvore de perguntas. */
export function rotuloResposta(pergunta: string, valor: string | string[]): string {
  const opcoes = PERGUNTAS[pergunta]?.opcoes ?? []
  const um = (v: string) => opcoes.find((o) => o.valor === v)?.rotulo ?? v
  return Array.isArray(valor) ? valor.map(um).join(', ') : um(valor)
}

const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

export function tempoRelativo(iso: string, agora = Date.now()): string {
  const seg = Math.round((new Date(iso).getTime() - agora) / 1000)
  const abs = Math.abs(seg)
  if (abs < 45) return 'agora'
  if (abs < 3600) return rtf.format(Math.round(seg / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seg / 3600), 'hour')
  return rtf.format(Math.round(seg / 86400), 'day')
}

/** Tempo na fila, curto e em caixa-alta para a coluna mono: "18 MIN", "1 H 35", "2 DIAS". */
export function tempoNaFila(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'AGORA'
  if (min < 60) return `${min} MIN`
  if (min < 24 * 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} H ${String(m).padStart(2, '0')}` : `${h} H`
  }
  const d = Math.floor(min / (24 * 60))
  return d === 1 ? '1 DIA' : `${d} DIAS`
}

export const horario = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Re-renderiza a cada `ms` — para "há 3 min" continuar correto sem nova consulta. */
export function useAgora(ms = 30_000) {
  const [agora, setAgora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}

// Na demo com a plateia, um toque em "Ligar 192" NÃO pode discar de verdade.
const LIGACOES_REAIS = import.meta.env.VITE_LIGACOES_REAIS === 'true'

export function BotaoLigar({ servico, noite = false }: { servico: Servico; noite?: boolean }) {
  const [aviso, setAviso] = useState(false)
  if (!servico.telefone) {
    return <span className={`text-[13px] ${noite ? 'text-nevoa' : 'text-suave'}`}>Contato a confirmar com a Prefeitura</span>
  }
  // Emergência é P1 (tinta sobre vermelho); o resto é a ação comum do chão onde está.
  const classe = `inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-semibold ${
    servico.emergencia ? 'bg-p1 text-tinta' : noite ? 'bg-claro text-tinta' : 'bg-tinta text-white'
  }`
  const conteudo = (
    <>
      <Telefone className="size-4" /> Ligar {servico.telefone}
    </>
  )
  if (LIGACOES_REAIS) {
    return (
      <a href={`tel:${servico.telefone}`} className={classe}>
        {conteudo}
      </a>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setAviso(true)} className={classe}>
        {conteudo}
      </button>
      {aviso && (
        <span role="status" className={`max-w-48 text-right text-[11px] ${noite ? 'text-nevoa' : 'text-suave'}`}>
          Demonstração: na versão real, este botão liga para {servico.telefone}.
        </span>
      )}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…', noite = false }: { texto?: string; noite?: boolean }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2 p-8 ${noite ? 'text-nevoa' : 'text-suave'}`}>
      <span className={`size-4 animate-spin rounded-full border-2 ${noite ? 'border-noite-borda border-t-claro' : 'border-regra border-t-tinta'}`} />
      {texto}
    </div>
  )
}

/** Rótulo de seção em mono, caixa-alta — o jeito do sistema nomear blocos. */
export function Rotulo({ children, className = 'text-nevoa', como: Tag = 'h3', id }: { children: ReactNode; className?: string; como?: 'h2' | 'h3' | 'span' | 'p'; id?: string }) {
  return (
    <Tag id={id} className={`flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${className}`}>
      {children}
    </Tag>
  )
}

/** Cartão do painel (noite). */
export function Cartao({ titulo, children, className = '', tom = 'border-noite-3' }: { titulo?: ReactNode; children: ReactNode; className?: string; tom?: string }) {
  return (
    <section className={`rounded-md border bg-noite-1 p-5 ${tom} ${className}`}>
      {titulo && <Rotulo className="mb-3 text-nevoa">{titulo}</Rotulo>}
      {children}
    </section>
  )
}
