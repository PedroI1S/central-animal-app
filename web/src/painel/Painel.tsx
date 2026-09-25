import { PRIORIDADES, type Prioridade } from '@ca/triagem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { api, enviarJson, ErroApi } from '../api'
import { Camera, Faisca, Pino } from '../icones'
import type { ItemFila, Servidor, Stats } from '../tipos'
import { Carregando, EtiquetaTriagem, hora, Pata, rotuloCategoria, SeloStatus, tempoNaFila, useAgora } from '../ui'
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

const ABERTAS = ['nova', 'em_atendimento', 'encaminhada']
const DIA = 24 * 60 * 60 * 1000

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

  // As telas de espera e de erro também precisam de landmark e de h1: sem isso, enquanto o painel
  // carrega a página inteira fica sem estrutura para quem navega por marcos.
  if (eu.isLoading) return <Espera />
  // Com PAINEL_SEM_LOGIN (api/src/auth.ts) a API não responde 401 e esta tela não aparece.
  if (eu.error instanceof ErroApi && eu.error.status === 401) return <Login onEntrar={() => qc.invalidateQueries({ queryKey: ['eu'] })} />
  if (eu.error)
    return (
      <Espera>
        <p role="alert" className="p-6 text-center text-nevoa">
          {eu.error.message}
        </p>
      </Espera>
    )
  if (!eu.data) return <Espera texto="Conectando…" />
  return <Area eu={eu.data} />
}

/** Casca mínima das telas de espera/erro do painel: um main e um h1 para leitores de tela. */
function Espera({ texto, children }: { texto?: string; children?: ReactNode }) {
  return (
    <main className="noite grid h-full place-items-center bg-noite-0 text-claro [color-scheme:dark]">
      <div>
        <h1 className="sr-only">Painel do servidor — Central Animal</h1>
        {children ?? <Carregando texto={texto} noite />}
      </div>
    </main>
  )
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
  // A faixa de chegadas precisa também das já encerradas: a consulta "todas" a cada 15 s basta para ela.
  const todas = useQuery({
    queryKey: ['fila', 'todas'],
    queryFn: () => api<ItemFila[]>('/api/painel/ocorrencias?filtro=todas'),
    refetchInterval: 15_000,
    enabled: larga,
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
  const abertas = itens.filter((o) => ABERTAS.includes(o.status))

  const listaFila = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-noite-linha px-4">
        <h2 className="font-display text-[22px] leading-none font-extrabold tracking-wide uppercase">Fila</h2>
        <span role="status" className="min-w-0 truncate font-mono text-[11px] tracking-[0.08em] text-nevoa uppercase">
          {itens.length} {filtro === 'abertas' ? 'abertas' : 'no total'}
          <span className="hidden sm:inline"> · por prioridade</span>
        </span>
        <div role="group" aria-label="Filtrar ocorrências" className="ml-auto flex shrink-0 overflow-hidden rounded border border-noite-3 text-[13px]">
          {(['abertas', 'todas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`h-8 px-2.5 ${filtro === f ? 'bg-claro font-semibold text-tinta' : 'text-nevoa hover:text-claro'}`}
            >
              {f === 'abertas' ? 'Abertas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {fila.isLoading && <Carregando noite />}
        {itens.map((o) => (
          <li key={o.id} className="cartao-fila">
            <CartaoFila o={o} ativo={o.id === selecionado} novo={novos.has(o.id)} demo={demo} agora={agora} onClick={() => abrir(o.id)} />
          </li>
        ))}
        {!fila.isLoading && itens.length === 0 && <li className="p-8 text-center text-nevoa">Nenhuma ocorrência {filtro === 'abertas' ? 'aberta' : ''}.</li>}
      </ul>
    </>
  )
  const detalhe = selecionado && <Detalhe key={selecionado} id={selecionado} demo={demo} onFechar={() => mudar({ caso: null })} onAbrir={abrir} />
  const mapa = <MapaGeral itens={abertas} demo={demo} agora={agora} onSelecionar={abrir} />

  return (
    <div className="noite flex h-full flex-col bg-noite-0 text-claro [color-scheme:dark]">
      <header className="border-b border-noite-linha">
        <div className="flex h-15 items-center gap-3 px-3 sm:px-4 lg:gap-7 lg:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <Pata className="size-6 text-claro" />
            <h1 className="font-display text-2xl leading-none font-extrabold tracking-wide whitespace-nowrap uppercase">Central Animal</h1>
            <span className="hidden rounded-[3px] border border-noite-3 px-2 py-1 font-mono text-[11px] tracking-[0.14em] text-nevoa uppercase sm:inline">
              Painel do servidor
            </span>
          </div>

          {larga && <AoVivo agora={agora} />}

          <div className="ml-auto flex items-center gap-2 text-sm whitespace-nowrap lg:gap-4">
            {!larga && (
              <div role="group" aria-label="Ver" className="flex overflow-hidden rounded border border-noite-3">
                {(['fila', 'mapa'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={!selecionado && vista === v}
                    onClick={() => mudar({ vista: v === 'fila' ? null : v, caso: null })}
                    className={`min-h-11 px-3 ${!selecionado && vista === v ? 'bg-claro font-semibold text-tinta' : 'text-nevoa'}`}
                  >
                    {v === 'fila' ? 'Fila' : 'Mapa'}
                  </button>
                ))}
              </div>
            )}
            {larga && (
              <button
                type="button"
                aria-pressed={demo}
                onClick={() => mudar({ modo: demo ? null : 'demo' })}
                className={`flex h-9 items-center gap-2 rounded border px-3.5 font-mono text-xs tracking-[0.08em] uppercase ${
                  demo ? 'border-ia-noite bg-ia-noite text-tinta' : 'border-noite-3 text-nevoa hover:text-claro'
                }`}
                title="Modo apresentação: esconde textos livres e mostra o QR Code"
              >
                <span aria-hidden="true" className={`size-2 rounded-full border-[1.5px] ${demo ? 'border-tinta bg-tinta' : 'border-current'}`} />
                Modo demo
              </button>
            )}
            <div className="hidden flex-col items-end leading-tight xl:flex">
              <span className="font-semibold">{eu.nome}</span>
              <span className="text-xs text-nevoa">{eu.setor}</span>
            </div>
            {!eu.semLogin && (
              <button type="button" onClick={sair} className="h-9 rounded border border-noite-3 px-3 text-[13px] text-nevoa hover:text-claro">
                Sair
              </button>
            )}
          </div>
        </div>
        {!larga && <IndicadoresCompactos stats={stats.data} />}
      </header>

      {larga && <Indicadores stats={stats.data} abertas={abertas} todas={todas.data} agora={agora} />}

      {larga ? (
        <div className="flex min-h-0 flex-1">
          <aside aria-label="Fila de ocorrências" className="flex w-[400px] shrink-0 flex-col border-r border-noite-linha bg-noite-1 xl:w-[440px]">
            {listaFila}
          </aside>
          {/* Sem caso aberto, o espaço é do mapa ao vivo; no modo demo, com o QR por cima. */}
          <main className="@container relative min-w-0 flex-1 overflow-y-auto">
            {detalhe || (
              <>
                {mapa}
                <TituloMapa n={abertas.filter((o) => o.lat != null).length} />
                <Legenda />
                {demo && <CartaoQr />}
              </>
            )}
          </main>
        </div>
      ) : detalhe ? (
        <main className="@container min-h-0 flex-1 overflow-y-auto">{detalhe}</main>
      ) : vista === 'mapa' ? (
        <main className="min-h-0 flex-1">{mapa}</main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col bg-noite-1">{listaFila}</main>
      )}
    </div>
  )
}

const SEMANA = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const semPonto = (s: string) => s.replace(/\./g, '').toUpperCase()

function AoVivo({ agora }: { agora: number }) {
  const d = new Date(agora)
  return (
    <div className="flex items-center gap-2.5 font-mono text-xs tracking-[0.08em] whitespace-nowrap text-nevoa">
      <span aria-hidden="true" className="vivo size-2 rounded-full bg-p4" />
      <span className="text-claro">AO VIVO</span>
      <span aria-hidden="true">·</span>
      <span>
        {semPonto(SEMANA.format(d))} {semPonto(DIA_MES.format(d)).replace(' DE ', ' ')} · {hora(d.toISOString())}
      </span>
    </div>
  )
}

/** Número de indicador: dois dígitos, como num placar. */
const placar = (v?: number) => (v == null ? '––' : String(v).padStart(2, '0'))

// Sem opacity nos rótulos: sobre a cor ela derrubava o contraste (caso anotado no CLAUDE.md). Número e rótulo
// se separam por tamanho, fonte e peso.
function Indicadores({ stats, abertas, todas, agora }: { stats?: Stats; abertas: ItemFila[]; todas?: ItemFila[]; agora: number }) {
  const celula = 'flex flex-col justify-between border-r border-noite-linha px-5 py-4'
  const rotulo = 'font-mono text-[11px] tracking-[0.12em] whitespace-nowrap text-nevoa uppercase'
  const numero = 'font-display text-[64px] leading-[0.8] font-extrabold tabular-nums'
  return (
    <section
      aria-label="Indicadores do plantão"
      className="grid h-32 shrink-0 grid-cols-[180px_172px_124px_180px_318px_minmax(0,1fr)] border-b border-noite-linha"
    >
      <div className={celula}>
        <span className={rotulo}>Críticas abertas</span>
        <span className={`${numero} text-p1`}>{placar(stats?.criticasAbertas)}</span>
      </div>
      <div className={celula}>
        <span className={rotulo}>Sem responsável</span>
        <span className={numero}>{placar(stats?.semResponsavel)}</span>
      </div>
      <div className={celula}>
        <span className={rotulo}>Hoje</span>
        <span className={numero}>{placar(stats?.hoje)}</span>
      </div>
      <div className={celula}>
        <span className={rotulo}>Encerradas hoje</span>
        <span className={`${numero} ${stats?.encerradasHoje ? '' : 'text-cinza'}`}>{placar(stats?.encerradasHoje)}</span>
      </div>
      <Distribuicao abertas={abertas} />
      <Chegadas itens={todas ?? abertas} agora={agora} />
    </section>
  )
}

function IndicadoresCompactos({ stats }: { stats?: Stats }) {
  const itens = [
    { valor: stats?.criticasAbertas, rotulo: 'críticas abertas', cor: 'text-p1' },
    { valor: stats?.semResponsavel, rotulo: 'sem responsável', cor: '' },
    { valor: stats?.hoje, rotulo: 'hoje', cor: '' },
    { valor: stats?.encerradasHoje, rotulo: 'encerradas hoje', cor: '' },
  ]
  return (
    <div className="grid grid-cols-4 border-t border-noite-linha">
      {itens.map((i) => (
        <div key={i.rotulo} className="border-r border-noite-linha px-2 py-2 last:border-r-0">
          <div className={`font-display text-3xl leading-none font-extrabold tabular-nums ${i.cor}`}>{placar(i.valor)}</div>
          <div className="mt-1 font-mono text-[10.5px] leading-tight tracking-[0.04em] text-nevoa uppercase">{i.rotulo}</div>
        </div>
      ))}
    </div>
  )
}

/** Barra empilhada das abertas por prioridade: o tamanho do problema de cada nível, num relance. */
function Distribuicao({ abertas }: { abertas: ItemFila[] }) {
  const n = (p: Prioridade) => abertas.filter((o) => o.prioridade === p).length
  const ps = [1, 2, 3, 4] as const
  return (
    <div className="flex flex-col justify-between border-r border-noite-linha px-5 py-4">
      <span className="font-mono text-[11px] tracking-[0.12em] text-nevoa uppercase">Abertas por prioridade · {abertas.length}</span>
      <div
        role="img"
        aria-label={ps.map((p) => `P${p}: ${n(p)}`).join(', ')}
        className={`flex h-4 gap-[3px] rounded-sm ${abertas.length ? '' : 'border border-dashed border-noite-3'}`}
      >
        {ps.map((p) => n(p) > 0 && <span key={p} className="rounded-sm" style={{ flexGrow: n(p), backgroundColor: PRIORIDADES[p].cor }} />)}
      </div>
      <div aria-hidden="true" className="flex justify-between font-mono text-xs text-nevoa">
        {ps.map((p) => (
          <span key={p}>
            <b className="font-semibold" style={{ color: PRIORIDADES[p].cor }}>
              P{p}
            </b>{' '}
            {n(p)}
          </span>
        ))}
      </div>
    </div>
  )
}

const ALTURA_TRACO: Record<Prioridade, number> = { 1: 40, 2: 30, 3: 22, 4: 14 }

/**
 * Chegadas nas últimas 24 h: um traço por caso, na hora em que chegou, alto e da cor da prioridade.
 * No palco, é aqui que a plateia vê os próprios relatos se empilhando em "agora".
 */
function Chegadas({ itens, agora }: { itens: ItemFila[]; agora: number }) {
  const inicio = agora - DIA
  const recentes = itens.filter((o) => new Date(o.criadoEm).getTime() >= inicio)
  const pos = (t: number) => `${((t - inicio) / DIA) * 100}%`
  const horas: { t: number; rotulo: string | null }[] = []
  const primeira = new Date(inicio)
  primeira.setMinutes(0, 0, 0)
  for (let t = primeira.getTime() + 3600_000; t < agora; t += 3600_000) {
    const h = new Date(t).getHours()
    horas.push({ t, rotulo: h % 6 === 0 ? `${String(h).padStart(2, '0')}h` : null })
  }
  return (
    <div className="flex min-w-0 flex-col justify-between px-5 py-4">
      <div className="flex justify-between gap-4 font-mono text-[11px] tracking-[0.12em] text-nevoa uppercase">
        <span>Chegadas · últimas 24 h</span>
        <span className="normal-case">cada traço = 1 caso</span>
      </div>
      <div role="img" aria-label={`${recentes.length} ${recentes.length === 1 ? 'caso' : 'casos'} nas últimas 24 horas`} className="relative h-[60px]">
        <span className="absolute inset-x-0 top-11 h-px bg-noite-3" />
        {horas.map((h) => (
          <span key={h.t} className="absolute top-11 w-px bg-noite-3" style={{ left: pos(h.t), height: h.rotulo ? 6 : 3, transform: 'translateY(-100%)' }} />
        ))}
        {horas
          .filter((h) => h.rotulo)
          .map((h) => (
            <span key={h.t} aria-hidden="true" className="absolute top-12 -translate-x-1/2 font-mono text-[10px] text-cinza" style={{ left: pos(h.t) }}>
              {h.rotulo}
            </span>
          ))}
        <span aria-hidden="true" className="absolute top-12 right-0 font-mono text-[10px] text-claro">
          agora
        </span>
        {recentes.map((o) => (
          <span
            key={o.id}
            className="absolute w-[3px] -translate-x-1/2 rounded-[1px]"
            style={{
              left: pos(new Date(o.criadoEm).getTime()),
              top: 44 - ALTURA_TRACO[o.prioridade],
              height: ALTURA_TRACO[o.prioridade],
              backgroundColor: PRIORIDADES[o.prioridade].cor,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function TituloMapa({ n }: { n: number }) {
  return (
    <div className="pointer-events-none absolute top-5 left-6 z-[700] flex flex-col gap-1">
      <span className="font-mono text-[11px] tracking-[0.14em] text-nevoa uppercase">Mapa ao vivo · Pato Branco</span>
      <span className="font-display text-[28px] leading-none font-bold">
        {n} {n === 1 ? 'aberta' : 'abertas'} no mapa
      </span>
    </div>
  )
}

function Legenda() {
  const tamanhos: Record<Prioridade, string> = { 1: 'size-3.5', 2: 'size-3', 3: 'size-2.5', 4: 'size-2' }
  return (
    <div className="pointer-events-none absolute bottom-5 left-6 z-[700] flex items-center gap-4 rounded border border-noite-linha bg-noite-0/90 px-3.5 py-2.5 font-mono text-[11px] text-nevoa">
      {([1, 2, 3, 4] as const).map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <span className={`rounded-full ${tamanhos[p]}`} style={{ backgroundColor: PRIORIDADES[p].cor }} />P{p} {PRIORIDADES[p].rotulo.toLowerCase()}
        </span>
      ))}
      <span className="hidden text-nevoa xl:inline">· P1 pulsa até alguém assumir</span>
    </div>
  )
}

/** Modo demo: QR grande sobre o mapa, para ler do fundo da sala. Fica fora da fila, que ganha a altura toda. */
function CartaoQr() {
  return (
    <div className="absolute top-5 right-6 z-[1100] flex items-center gap-5 rounded-lg bg-white py-4.5 pr-5.5 pl-4.5 text-tinta shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <QRCodeSVG value={URL_PUBLICA} size={176} marginSize={1} fgColor="#0d1b26" />
      <div className="flex w-52 flex-col gap-2">
        <span className="font-mono text-[11px] tracking-[0.14em] text-suave uppercase">Escaneie agora</span>
        <p className="font-display text-[34px] leading-[0.92] font-extrabold uppercase">Relate uma ocorrência</p>
        <p className="text-sm text-suave">Aponte a câmera do celular. Seu caso aparece neste mapa.</p>
        <p className="font-mono text-xs break-all">{URL_PUBLICA.replace(/^https?:\/\//, '')}</p>
      </div>
    </div>
  )
}

function CartaoFila({ o, ativo, novo, demo, agora, onClick }: { o: ItemFila; ativo: boolean; novo: boolean; demo: boolean; agora: number; onClick: () => void }) {
  // No modo demo nada escrito pela plateia vai para o telão: nem o relato, nem o resumo que a IA faz dele, nem o endereço.
  const texto = demo ? null : (o.resumoIa ?? (o.relato ? `“${o.relato.split('\n\n')[0]}”` : null))
  const local = !o.endereco ? 'Local no mapa' : demo ? 'Local informado' : o.endereco
  // Pessoa em risco vira aviso próprio, não só o primeiro item de uma linha que corta.
  const pessoaEmRisco = o.rota === 'humana'
  const motivos = pessoaEmRisco ? o.motivos.filter((m) => m !== 'Pessoa em risco') : o.motivos
  const aberta = ABERTAS.includes(o.status)
  const urgenteSemDono = o.prioridade === 1 && !o.responsavel && aberta
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativo ? 'true' : undefined}
      className={`flex w-full gap-3.5 border-b border-noite-linha py-3.5 pr-4 pl-3.5 text-left transition-colors ${
        ativo ? 'bg-noite-2 shadow-[inset_0_0_0_1px_var(--color-nevoa)]' : 'hover:bg-noite-2/60'
      } ${novo ? 'animar-entrada destaque-novo' : ''}`}
    >
      <EtiquetaTriagem p={o.prioridade} furo={ativo ? 'bg-noite-2' : 'bg-noite-1'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-base font-semibold">{rotuloCategoria(o.categoria)}</span>
          {novo && <span className="shrink-0 rounded-[2px] bg-ia-noite px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.1em] text-tinta">NOVO</span>}
          <span className={`ml-auto shrink-0 font-mono text-xs ${urgenteSemDono ? 'text-p1' : 'text-nevoa'}`}>
            {aberta ? tempoNaFila(o.criadoEm, agora) : hora(o.criadoEm)}
          </span>
        </div>
        {pessoaEmRisco && <p className="font-mono text-[11px] font-semibold tracking-[0.1em] text-p1 uppercase">Pessoa em risco</p>}
        {motivos.length > 0 && <p className="truncate text-[13px] text-nevoa">{motivos.join(' · ')}</p>}
        {o.iaStatus === 'pendente' && !o.resumoIa ? (
          <p className="flex items-center gap-1.5 text-[13px] text-ia-noite">
            <span className="size-3 animate-spin rounded-full border-2 border-noite-borda border-t-ia-noite" /> IA analisando…
          </p>
        ) : demo ? (
          (o.relato || o.resumoIa) && <p className="font-mono text-[11px] tracking-[0.06em] text-nevoa uppercase">Texto do cidadão oculto no modo demo</p>
        ) : (
          texto && (
            <p className="flex gap-1.5 text-sm leading-[19px] text-claro-2">
              {o.resumoIa && <Faisca className="mt-[3px] size-3 text-ia-noite" rotulo="Resumo da IA" />}
              <span className="line-clamp-2">{texto}</span>
            </p>
          )
        )}
        <div className="mt-0.5 flex items-center gap-2.5 font-mono text-[11.5px] text-nevoa">
          <span className="flex min-w-0 items-center gap-1">
            <Pino className="size-3" />
            <span className="truncate">{local}</span>
          </span>
          {o.fotos > 0 && <Camera className="size-3.5" rotulo="Tem foto" />}
          <span className={`ml-auto shrink-0 ${o.responsavel ? '' : 'font-semibold text-claro'}`}>{o.responsavel ?? 'SEM RESPONSÁVEL'}</span>
          <SeloStatus status={o.status} noite />
        </div>
      </div>
    </button>
  )
}
