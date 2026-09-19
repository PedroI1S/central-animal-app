import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { api, enviarJson, ErroApi } from '../api'
import type { ItemFila, Servidor, Stats } from '../tipos'
import { Carregando, Pata, rotuloCategoria, SeloPrioridade, SeloStatus, corPrioridade, tempoRelativo, useAgora } from '../ui'
import Detalhe from './Detalhe'
import Login from './Login'
import MapaGeral from './MapaGeral'

const URL_PUBLICA = import.meta.env.VITE_PUBLIC_URL || window.location.origin

// Mesmo corte do `lg` do Tailwind (64rem). Abaixo dele (celular, tablet em pé) o painel mostra uma coisa
// por vez — fila, mapa ou caso — em vez de espremer as duas colunas.
const TELA_LARGA = '(min-width: 64rem)'
function useTelaLarga() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(TELA_LARGA)
      consulta.addEventListener('change', avisar)
      return () => consulta.removeEventListener('change', avisar)
    },
    () => window.matchMedia(TELA_LARGA).matches,
  )
}

function bip() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.15, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.35)
  } catch {
    /* sem áudio */
  }
}

export default function Painel() {
  const qc = useQueryClient()
  const eu = useQuery({ queryKey: ['eu'], queryFn: () => api<Servidor>('/api/auth/eu'), retry: false })

  if (eu.isLoading) return <Carregando />
  if (eu.error instanceof ErroApi && eu.error.status === 401) return <Login onEntrar={() => qc.invalidateQueries({ queryKey: ['eu'] })} />
  if (!eu.data) return <Carregando texto="Conectando…" />
  return <Area eu={eu.data} />
}

function Area({ eu }: { eu: Servidor }) {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const larga = useTelaLarga()
  const demo = params.get('modo') === 'demo'
  const vista = params.get('vista') === 'mapa' ? 'mapa' : 'fila'
  const selecionado = params.get('caso')
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas')
  const agora = useAgora(15_000)

  /** Muda parâmetros da URL de uma vez (null apaga). */
  const mudar = (mudancas: Record<string, string | null>) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null) n.delete(chave)
        else n.set(chave, valor)
      }
      return n
    })
  const abrir = (id: string) => mudar({ caso: id, vista: null })

  const fila = useQuery({
    queryKey: ['fila', filtro],
    queryFn: () => api<ItemFila[]>(`/api/painel/ocorrencias?filtro=${filtro}`),
    refetchInterval: 3000,
  })
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api<Stats>('/api/painel/stats'), refetchInterval: 3000 })

  // Detecta casos que chegaram desde a última consulta: destaque visual + bip.
  const conhecidos = useRef<Set<string> | null>(null)
  const [novos, setNovos] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!fila.data) return
    const ids = fila.data.map((o) => o.id)
    if (conhecidos.current) {
      const chegaram = ids.filter((id) => !conhecidos.current!.has(id))
      if (chegaram.length) {
        bip()
        setNovos((n) => new Set([...n, ...chegaram]))
        setTimeout(() => setNovos((n) => new Set([...n].filter((id) => !chegaram.includes(id)))), 12_000)
      }
    }
    conhecidos.current = new Set([...(conhecidos.current ?? []), ...ids])
  }, [fila.data])

  async function sair() {
    await enviarJson('/api/auth/logout', {})
    qc.clear()
    window.location.reload()
  }

  const itens = fila.data ?? []

  const listaFila = (
    <>
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-semibold text-slate-600">
          {itens.length} {filtro === 'abertas' ? 'abertas' : 'no total'}
        </span>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'abertas' | 'todas')} className="rounded border border-slate-300 bg-white px-2 py-1">
          <option value="abertas">Abertas</option>
          <option value="todas">Todas</option>
        </select>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {fila.isLoading && <Carregando />}
        {itens.map((o) => (
          <li key={o.id}>
            <CartaoFila o={o} ativo={o.id === selecionado} novo={novos.has(o.id)} demo={demo} agora={agora} onClick={() => abrir(o.id)} />
          </li>
        ))}
      </ul>
    </>
  )
  const detalhe = selecionado && <Detalhe key={selecionado} id={selecionado} demo={demo} onFechar={() => mudar({ caso: null })} onAbrir={abrir} />
  const mapa = <MapaGeral itens={itens} demo={demo} onSelecionar={abrir} />

  return (
    <div className="flex h-full flex-col">
      <header className="bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 lg:gap-4 lg:px-5 lg:py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Pata className="size-7 text-marca-500" />
            <div className="leading-tight whitespace-nowrap">
              <div className="font-bold">Central Animal</div>
              <div className="hidden text-xs text-slate-400 sm:block">Painel do servidor</div>
            </div>
          </div>

          {larga && <Indicadores stats={stats.data} />}

          <div className="ml-auto flex items-center gap-2 text-sm whitespace-nowrap">
            {!larga && (
              <div className="flex overflow-hidden rounded-lg border border-slate-700">
                {(['fila', 'mapa'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => mudar({ vista: v === 'fila' ? null : v, caso: null })}
                    className={`px-3 py-2 ${!selecionado && vista === v ? 'bg-slate-700' : ''}`}
                  >
                    {v === 'fila' ? 'Fila' : 'Mapa'}
                  </button>
                ))}
              </div>
            )}
            {larga && (
              <button
                onClick={() => mudar({ modo: demo ? null : 'demo' })}
                className={`rounded-lg border px-3 py-1.5 ${demo ? 'border-marca-500 bg-marca-600' : 'border-slate-700'}`}
                title="Modo apresentação: esconde textos livres e mostra o QR Code"
              >
                {demo ? '● Modo demo' : 'Modo demo'}
              </button>
            )}
            <span className="hidden text-slate-400 xl:inline">{eu.nome}</span>
            <button onClick={sair} className="px-1 py-2 text-slate-400 hover:text-white">
              Sair
            </button>
          </div>
        </div>
        {!larga && <Indicadores stats={stats.data} compacto />}
      </header>

      {larga ? (
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[380px] shrink-0 flex-col border-r border-slate-200 bg-slate-50 xl:w-[440px]">{listaFila}</aside>
          {/* Sem caso aberto, o espaço é do mapa ao vivo; no modo demo, com o QR por cima. */}
          <section className="@container relative min-w-0 flex-1 overflow-y-auto">
            {detalhe || (
              <>
                {mapa}
                {demo && <CartaoQr />}
              </>
            )}
          </section>
        </div>
      ) : detalhe ? (
        <section className="@container min-h-0 flex-1 overflow-y-auto">{detalhe}</section>
      ) : vista === 'mapa' ? (
        <section className="min-h-0 flex-1">{mapa}</section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col bg-slate-50">{listaFila}</section>
      )}
    </div>
  )
}

function Indicadores({ stats, compacto = false }: { stats?: Stats; compacto?: boolean }) {
  const itens = [
    { valor: stats?.criticasAbertas, rotulo: 'críticas abertas', cor: 'bg-p1' },
    { valor: stats?.semResponsavel, rotulo: 'sem responsável', cor: 'bg-white/10' },
    { valor: stats?.hoje, rotulo: 'hoje', cor: 'bg-white/10' },
    { valor: stats?.encerradasHoje, rotulo: 'encerradas hoje', cor: 'bg-white/10' },
  ]
  // No celular os quatro viram uma grade embaixo do cabeçalho: número em cima, rótulo embaixo.
  if (compacto)
    return (
      <div className="grid grid-cols-4 gap-2 px-3 pb-3 sm:px-4">
        {itens.map((i) => (
          <div key={i.rotulo} className={`rounded-lg px-1 py-1.5 text-center ${i.cor}`}>
            <div className="text-lg leading-none font-bold tabular-nums">{i.valor ?? '–'}</div>
            <div className="mt-1 text-[11px] leading-tight opacity-80">{i.rotulo}</div>
          </div>
        ))}
      </div>
    )
  return (
    <div className="ml-2 flex gap-2">
      {itens.map((i) => (
        <div key={i.rotulo} className={`rounded-lg px-3 py-1 whitespace-nowrap ${i.cor}`}>
          <span className="text-lg font-bold tabular-nums">{i.valor ?? '–'}</span> <span className="text-xs opacity-80">{i.rotulo}</span>
        </div>
      ))}
    </div>
  )
}

/** Modo demo: QR grande sobre o mapa, para ler do fundo da sala. Fica fora da fila, que ganha a altura toda. */
function CartaoQr() {
  return (
    <div className="absolute top-4 right-4 z-[1100] flex items-center gap-4 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
      <QRCodeSVG value={URL_PUBLICA} size={168} marginSize={1} />
      <div className="max-w-44">
        <p className="text-xl leading-tight font-bold">Relate uma ocorrência</p>
        <p className="mt-1 text-sm text-slate-500">Aponte a câmera do celular</p>
        <p className="mt-2 font-mono text-xs break-all text-marca-700">{URL_PUBLICA.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  )
}

function CartaoFila({ o, ativo, novo, demo, agora, onClick }: { o: ItemFila; ativo: boolean; novo: boolean; demo: boolean; agora: number; onClick: () => void }) {
  // No modo demo nada escrito pela plateia vai para o telão: nem o relato, nem o resumo que a IA faz dele, nem o endereço.
  const texto = demo ? null : (o.resumoIa ?? o.relato)
  const local = !o.endereco ? 'Local no mapa' : demo ? 'Endereço informado' : o.endereco
  // Pessoa em risco vira aviso próprio em vermelho, não só o primeiro item de uma linha cinza que corta.
  const pessoaEmRisco = o.rota === 'humana'
  const motivos = pessoaEmRisco ? o.motivos.filter((m) => m !== 'Pessoa em risco') : o.motivos
  return (
    <button
      onClick={onClick}
      className={`w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${ativo ? 'border-marca-600 ring-2 ring-marca-500' : 'border-slate-200 hover:border-slate-300'} ${novo ? 'animar-entrada destaque-novo' : ''}`}
    >
      <div className="flex">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: corPrioridade(o.prioridade) }} />
        <div className="min-w-0 flex-1 space-y-1.5 p-3">
          <div className="flex items-center gap-2">
            <SeloPrioridade p={o.prioridade} />
            <span className="truncate text-sm font-semibold">{rotuloCategoria(o.categoria)}</span>
            {novo && <span className="rounded bg-marca-600 px-1.5 text-[10px] font-bold text-white">NOVO</span>}
            <span className="ml-auto shrink-0 text-xs text-slate-500">{tempoRelativo(o.criadoEm, agora)}</span>
          </div>
          {pessoaEmRisco && <p className="text-xs font-bold tracking-wide text-p1 uppercase">Pessoa em risco</p>}
          <p className="truncate text-xs text-slate-600">{motivos.join(' · ')}</p>
          {o.iaStatus === 'pendente' && !o.resumoIa ? (
            <p className="flex items-center gap-1.5 text-xs text-marca-700">
              <span className="size-3 animate-spin rounded-full border-2 border-marca-100 border-t-marca-600" /> IA analisando…
            </p>
          ) : (
            texto && <p className="line-clamp-2 text-sm text-slate-700">{o.resumoIa && '✨ '}{texto}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">📍 {local}</span>
            {o.fotos > 0 && <span>📷</span>}
            <span className="ml-auto shrink-0">{o.responsavel ?? <span className="font-semibold text-slate-900">Sem responsável</span>}</span>
            <SeloStatus status={o.status} />
          </div>
        </div>
      </div>
    </button>
  )
}
