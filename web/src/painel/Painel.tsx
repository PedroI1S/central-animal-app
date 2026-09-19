import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api, enviarJson, ErroApi } from '../api'
import type { ItemFila, Servidor, Stats } from '../tipos'
import { Carregando, Pata, rotuloCategoria, SeloPrioridade, SeloStatus, corPrioridade, tempoRelativo, useAgora } from '../ui'
import Detalhe from './Detalhe'
import Login from './Login'
import MapaGeral from './MapaGeral'

const URL_PUBLICA = import.meta.env.VITE_PUBLIC_URL || window.location.origin

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
  const demo = params.get('modo') === 'demo'
  const vista = params.get('vista') === 'mapa' ? 'mapa' : 'fila'
  const selecionado = params.get('caso')
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas')
  const agora = useAgora(15_000)

  const definir = (chave: string, valor: string | null) =>
    setParams((p) => {
      const n = new URLSearchParams(p)
      if (valor === null) n.delete(chave)
      else n.set(chave, valor)
      return n
    })

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

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 bg-slate-900 px-5 py-3 text-white">
        <div className="flex items-center gap-2">
          <Pata className="size-7 text-marca-500" />
          <div>
            <div className="font-bold leading-tight">Central Animal</div>
            <div className="text-xs text-slate-400">Painel do servidor</div>
          </div>
        </div>

        <div className="ml-4 flex gap-2">
          <Indicador valor={stats.data?.criticasAbertas} rotulo="críticas abertas" cor="bg-p1" />
          <Indicador valor={stats.data?.semResponsavel} rotulo="sem responsável" cor="bg-white/10" />
          <Indicador valor={stats.data?.hoje} rotulo="hoje" cor="bg-white/10" />
          <Indicador valor={stats.data?.encerradasHoje} rotulo="encerradas hoje" cor="bg-white/10" />
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            {(['fila', 'mapa'] as const).map((v) => (
              <button key={v} onClick={() => definir('vista', v === 'fila' ? null : v)} className={`px-3 py-1.5 ${vista === v ? 'bg-slate-700' : ''}`}>
                {v === 'fila' ? '☰ Fila' : '🗺 Mapa'}
              </button>
            ))}
          </div>
          <button
            onClick={() => definir('modo', demo ? null : 'demo')}
            className={`rounded-lg border px-3 py-1.5 ${demo ? 'border-marca-500 bg-marca-600' : 'border-slate-700'}`}
            title="Modo apresentação: esconde textos livres e mostra o QR Code"
          >
            {demo ? '● Modo demo' : 'Modo demo'}
          </button>
          <span className="ml-2 text-slate-400">{eu.nome}</span>
          <button onClick={sair} className="text-slate-400 hover:text-white">
            Sair
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[440px] shrink-0 flex-col border-r border-slate-200 bg-slate-50">
          {demo && (
            <div className="flex items-center gap-4 border-b border-slate-200 bg-white p-4">
              <QRCodeSVG value={URL_PUBLICA} size={116} marginSize={1} />
              <div>
                <p className="text-lg font-bold leading-tight">Relate uma ocorrência</p>
                <p className="mt-1 text-sm text-slate-500">Aponte a câmera do celular</p>
                <p className="mt-2 font-mono text-xs break-all text-marca-700">{URL_PUBLICA.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="font-semibold text-slate-600">
              {itens.length} {filtro === 'abertas' ? 'abertas' : 'no total'}
            </span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as 'abertas' | 'todas')} className="rounded border border-slate-300 bg-white px-2 py-1">
              <option value="abertas">Abertas</option>
              <option value="todas">Todas</option>
            </select>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {fila.isLoading && <Carregando />}
            {itens.map((o) => (
              <li key={o.id}>
                <CartaoFila o={o} ativo={o.id === selecionado} novo={novos.has(o.id)} demo={demo} agora={agora} onClick={() => definir('caso', o.id)} />
              </li>
            ))}
          </ul>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto">
          {vista === 'mapa' ? (
            <MapaGeral itens={itens} demo={demo} onSelecionar={(id) => setParams((p) => { const n = new URLSearchParams(p); n.set('caso', id); n.delete('vista'); return n })} />
          ) : selecionado ? (
            <Detalhe key={selecionado} id={selecionado} demo={demo} onFechar={() => definir('caso', null)} onAbrir={(id) => definir('caso', id)} />
          ) : (
            <div className="grid h-full place-items-center text-slate-500">
              <div className="text-center">
                <div className="text-5xl">📋</div>
                <p className="mt-2">Selecione uma ocorrência na fila</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Indicador({ valor, rotulo, cor }: { valor?: number; rotulo: string; cor: string }) {
  return (
    <div className={`rounded-lg px-3 py-1 ${cor}`}>
      <span className="text-lg font-bold tabular-nums">{valor ?? '–'}</span> <span className="text-xs opacity-80">{rotulo}</span>
    </div>
  )
}

function CartaoFila({ o, ativo, novo, demo, agora, onClick }: { o: ItemFila; ativo: boolean; novo: boolean; demo: boolean; agora: number; onClick: () => void }) {
  // No modo demo nada escrito pela plateia vai para o telão: nem o relato, nem o resumo que a IA faz dele, nem o endereço.
  const texto = demo ? null : (o.resumoIa ?? o.relato)
  const local = !o.endereco ? 'Local no mapa' : demo ? 'Endereço informado' : o.endereco
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
          <p className="truncate text-xs text-slate-600">{o.motivos.join(' · ')}</p>
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
