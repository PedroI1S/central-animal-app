import { CATEGORIAS, PERGUNTAS, PRIORIDADES, type Categoria, type Prioridade, type Servico } from '@ca/triagem'
import { useEffect, useState, type ReactNode } from 'react'

// Cor é da prioridade. O status fala pelo peso: cheio = ninguém pegou ainda, contorno = em andamento, apagado = fechado.
export const STATUS: Record<string, { rotulo: string; classe: string }> = {
  nova: { rotulo: 'Nova', classe: 'bg-slate-900 text-white' },
  em_atendimento: { rotulo: 'Em atendimento', classe: 'bg-white text-slate-800 ring-1 ring-slate-300 ring-inset' },
  encaminhada: { rotulo: 'Encaminhada', classe: 'bg-white text-slate-800 ring-1 ring-slate-300 ring-inset' },
  encerrada: { rotulo: 'Encerrada', classe: 'bg-slate-100 text-slate-600' },
  improcedente: { rotulo: 'Improcedente', classe: 'bg-slate-100 text-slate-600' },
}

// Fundo + texto de cada prioridade. Branco só passa de 4,5:1 no P1; nas outras cores o texto escuro é o que se lê.
export const CLASSE_PRIORIDADE: Record<Prioridade, string> = {
  1: 'bg-p1 text-white',
  2: 'bg-p2 text-slate-900',
  3: 'bg-p3 text-slate-900',
  4: 'bg-p4 text-slate-900',
}

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

export const EMOJI_CATEGORIA: Record<Categoria, string> = {
  atropelamento: '🚗',
  ferido: '🩹',
  envenenamento: '☠️',
  maus_tratos: '⚠️',
  abandono: '🏚️',
  silvestre: '🐍',
  morto_via: '🛣️',
  outro: '💬',
}

export const corPrioridade = (p: Prioridade) => PRIORIDADES[p].cor

export function SeloPrioridade({ p, grande = false }: { p: Prioridade; grande?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${CLASSE_PRIORIDADE[p]} ${grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
    >
      P{p} · {PRIORIDADES[p].rotulo}
    </span>
  )
}

export function SeloStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? { rotulo: status, classe: 'bg-slate-100 text-slate-700' }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.classe}`}>{s.rotulo}</span>
}

export const rotuloCategoria = (c: Categoria) => `${EMOJI_CATEGORIA[c]} ${CATEGORIAS[c]}`

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

export const horario = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

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

export function BotaoLigar({ servico }: { servico: Servico }) {
  const [aviso, setAviso] = useState(false)
  if (!servico.telefone) {
    return <span className="text-xs text-slate-500">Contato a confirmar com a Prefeitura</span>
  }
  const classe = `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold ${
    servico.emergencia ? 'bg-p1 text-white' : 'bg-marca-600 text-white'
  }`
  if (LIGACOES_REAIS) {
    return (
      <a href={`tel:${servico.telefone}`} className={classe}>
        📞 Ligar {servico.telefone}
      </a>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => setAviso(true)} className={classe}>
        📞 Ligar {servico.telefone}
      </button>
      {aviso && <span className="max-w-48 text-right text-[11px] text-slate-500">Demonstração: na versão real, este botão liga para {servico.telefone}.</span>}
    </div>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-slate-500">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600" />
      {texto}
    </div>
  )
}

export function Cartao({ titulo, children, className = '' }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      {titulo && <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{titulo}</h3>}
      {children}
    </section>
  )
}
