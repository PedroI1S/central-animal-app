import { ORIENTACOES_VALIDADAS, PRIORIDADES } from '@ca/triagem'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, ErroApi } from '../api'
import type { OcorrenciaPublica } from '../tipos'
import { BotaoLigar, Carregando, CLASSE_PRIORIDADE, horario, Pata, rotuloCategoria, SeloStatus } from '../ui'
import { lerProtocolos } from './meusProtocolos'

export default function Acompanhar() {
  const { protocolo = '' } = useParams()
  const [busca] = useSearchParams()
  const novo = busca.get('novo') === '1'

  const { data: o, error, isLoading } = useQuery({
    queryKey: ['publica', protocolo],
    queryFn: () => api<OcorrenciaPublica>(`/api/ocorrencias/${encodeURIComponent(protocolo)}`),
    refetchInterval: 5000,
  })

  // Quando o servidor registra algo novo, destaca e vibra o celular — o "olhe o seu celular agora" da demo.
  const vistos = useRef<number | null>(null)
  const [destaque, setDestaque] = useState<number | null>(null)
  useEffect(() => {
    if (!o) return
    if (vistos.current !== null && o.eventos.length > vistos.current) {
      setDestaque(o.eventos.length - 1)
      navigator.vibrate?.([120, 60, 120])
    }
    vistos.current = o.eventos.length
  }, [o])

  if (isLoading) return <Carregando />
  if (error || !o)
    return (
      <Casca>
        <div className="p-6 text-center">
          <p className="text-lg font-semibold">{error instanceof ErroApi && error.status === 404 ? 'Protocolo não encontrado' : 'Não foi possível carregar'}</p>
          <Link to="/acompanhar" className="mt-4 inline-block text-marca-700 underline">
            Tentar outro protocolo
          </Link>
        </div>
      </Casca>
    )

  const p = PRIORIDADES[o.prioridade]
  const encerrada = o.status === 'encerrada' || o.status === 'improcedente'

  return (
    <Casca>
      {/* Sem opacity no texto: sobre a cor da prioridade ela derrubava o contraste abaixo de 4,5:1. */}
      <section className={`px-5 pt-6 pb-5 ${CLASSE_PRIORIDADE[o.prioridade]}`}>
        {novo && <p className="mb-2 text-sm font-semibold">✓ Ocorrência registrada</p>}
        <p className="text-sm">Prioridade</p>
        <p className="text-3xl font-bold">{p.rotulo}</p>
        <p className="mt-0.5 font-medium">{p.prazo}</p>
        <p className="mt-3 text-sm">{o.motivos.join(' · ')}</p>
      </section>

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs text-slate-500">Protocolo</p>
            <p className="font-mono text-lg font-bold tracking-wide">{o.protocolo}</p>
          </div>
          <button onClick={() => navigator.clipboard?.writeText(o.protocolo)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
            Copiar
          </button>
        </div>

        {!encerrada && (
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">O que fazer agora</h2>
            <ul className="mt-2 space-y-2">
              {o.orientacoes.map((t) => (
                <li key={t} className="flex gap-2 text-[15px] leading-snug">
                  <span className="text-marca-600">●</span>
                  {t}
                </li>
              ))}
            </ul>
            {!ORIENTACOES_VALIDADAS && <p className="mt-3 text-[11px] text-slate-500">Orientações em validação com médico-veterinário.</p>}
          </section>
        )}

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Serviços acionados</h2>
          <ul className="mt-2 divide-y divide-slate-100">
            {o.servicos.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="font-medium">{s.nome}</p>
                  <p className="text-xs text-slate-500">{s.orgao}</p>
                </div>
                <BotaoLigar servico={s} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Acompanhamento</h2>
            <SeloStatus status={o.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{rotuloCategoria(o.categoria)} · atualiza automaticamente</p>
          <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-4">
            {o.eventos.map((e, i) => (
              <li key={i} className={`relative ${i === destaque ? 'animar-entrada' : ''}`}>
                <span
                  className={`absolute -left-[23px] top-1 size-3 rounded-full border-2 border-white ${
                    i === o.eventos.length - 1 ? 'bg-marca-600' : 'bg-slate-300'
                  } ${i === destaque ? 'destaque-novo' : ''}`}
                />
                <p className={`text-[15px] leading-snug ${i === destaque ? 'font-semibold text-marca-900' : ''}`}>{e.texto}</p>
                <p className="text-xs text-slate-500">{horario(e.criadoEm)}</p>
              </li>
            ))}
          </ol>
        </section>

        <Link to="/" className="block py-2 text-center text-sm text-slate-500">
          Voltar ao início
        </Link>
      </div>
    </Casca>
  )
}

export function BuscarProtocolo() {
  const navegar = useNavigate()
  const [valor, setValor] = useState('')
  const recentes = lerProtocolos()
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valor.trim()) navegar(`/acompanhar/${valor.trim().toUpperCase()}`)
  }
  return (
    <Casca>
      <form onSubmit={enviar} className="space-y-3 p-5">
        <h1 className="text-xl font-bold">Acompanhar ocorrência</h1>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="CA-2026-000123"
          autoCapitalize="characters"
          className="w-full rounded-xl border border-slate-300 p-3 font-mono text-lg uppercase"
        />
        <button className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white">Consultar</button>
        {recentes.length > 0 && (
          <div className="pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase">Seus protocolos</p>
            {recentes.map((p) => (
              <Link key={p} to={`/acompanhar/${p}`} className="mt-2 block rounded-lg bg-white px-4 py-3 font-mono text-sm shadow-sm">
                {p}
              </Link>
            ))}
          </div>
        )}
      </form>
    </Casca>
  )
}

function Casca({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-full max-w-md bg-slate-50">
      <header className="flex items-center gap-2 bg-marca-700 px-4 py-3 text-white">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Pata className="size-5" /> Central Animal
        </Link>
      </header>
      {children}
    </main>
  )
}
