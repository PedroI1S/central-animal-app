import { CATEGORIAS, PERGUNTAS, PRIORIDADES, type Categoria, type Prioridade, type Servico } from '@ca/triagem'
import { useEffect, useState, type ReactNode } from 'react'

export const STATUS: Record<string, { rotulo: string; classe: string }> = {
  nova: { rotulo: 'Nova', classe: 'bg-sky-100 text-sky-800' },
  em_atendimento: { rotulo: 'Em atendimento', classe: 'bg-violet-100 text-violet-800' },
  encaminhada: { rotulo: 'Encaminhada', classe: 'bg-amber-100 text-amber-800' },
  encerrada: { rotulo: 'Encerrada', classe: 'bg-emerald-100 text-emerald-800' },
  improcedente: { rotulo: 'Improcedente', classe: 'bg-slate-200 text-slate-600' },
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
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-white ${grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: corPrioridade(p) }}
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
