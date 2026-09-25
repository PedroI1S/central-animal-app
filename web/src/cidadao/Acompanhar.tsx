import { ORIENTACOES_VALIDADAS, PRIORIDADES } from '@ca/triagem'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api, ErroApi } from '../api'
import { Check, Copiar } from '../icones'
import type { EventoPublico, OcorrenciaPublica } from '../tipos'
import { BotaoLigar, Carregando, CLASSE_PRIORIDADE, hora, horario, Pata, rotuloCategoria, STATUS } from '../ui'
import { esquecerProtocolo, useProtocolosSalvos } from './meusProtocolos'

const naoExiste = (e: unknown) => e instanceof ErroApi && e.status === 404

export default function Acompanhar() {
  const { protocolo = '' } = useParams()
  const [busca] = useSearchParams()
  const novo = busca.get('novo') === '1'

  const { data: o, error } = useQuery({
    queryKey: ['publica', protocolo],
    queryFn: () => api<OcorrenciaPublica>(`/api/ocorrencias/${encodeURIComponent(protocolo)}`),
    // 404 não passa a existir sozinho: nem repete a consulta nem segue consultando.
    retry: (falhas, e) => !naoExiste(e) && falhas < 1,
    refetchInterval: (q) => (naoExiste(q.state.error) ? false : 5000),
  })

  // Protocolo que não existe mais sai da lista "Seus protocolos" deste aparelho.
  const inexistente = naoExiste(error)
  useEffect(() => {
    if (inexistente) esquecerProtocolo(protocolo)
  }, [inexistente, protocolo])

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

  // Sem resposta ainda (ou consulta pausada, sem rede) é "carregando", não erro. Se uma consulta periódica
  // falhar com o caso já na tela (oscilação do 4G), o caso continua visível até a próxima dar certo.
  if (!o || inexistente) {
    if (!error) return <Carregando />
    return (
      <Casca>
        <div className="p-6 text-center">
          <h1 className="text-lg font-semibold text-balance">{inexistente ? 'Protocolo não encontrado' : 'Não foi possível carregar'}</h1>
          <Link to="/acompanhar" className="mt-3 inline-flex min-h-11 items-center underline underline-offset-[3px]">
            Tentar outro protocolo
          </Link>
        </div>
      </Casca>
    )
  }

  const p = PRIORIDADES[o.prioridade]
  const encerrada = o.status === 'encerrada' || o.status === 'improcedente'
  const cartao = 'rounded-lg border border-regra bg-white p-4'

  return (
    <Casca>
      {/* Tinta sobre a cor da prioridade (5,5 a 11:1). Sem opacity no texto: ela derrubava o contraste abaixo de 4,5:1. */}
      <section className={`relative min-h-[296px] overflow-hidden px-5 pt-4.5 pb-6 ${CLASSE_PRIORIDADE[o.prioridade]}`}>
        {novo && (
          <p className="flex items-center gap-1.5 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase">
            <Check className="size-[15px]" /> Ocorrência registrada
          </p>
        )}
        <p className="mt-5 font-mono text-[11px] tracking-[0.14em] uppercase">Prioridade</p>
        <h1 className="mt-0.5 font-display text-[86px] leading-[0.8] font-extrabold uppercase">{p.rotulo}</h1>
        <p className="mt-2.5 text-[19px] font-bold">{p.prazo}</p>
        <p className="mt-2 max-w-[236px] text-[15px] leading-snug">{o.motivos.join(' · ')}</p>
        {/* A etiqueta do deck, em contorno: decoração, fica fora da árvore de acessibilidade. */}
        <span
          aria-hidden="true"
          className="absolute top-[138px] -right-1.5 flex h-[146px] w-[104px] rotate-[14deg] flex-col items-center justify-end rounded-[10px] border-[2.5px] border-tinta pb-3.5"
        >
          <span className="absolute top-3.5 size-4 rounded-full border-[2.5px] border-tinta" />
          <span className="font-display text-[64px] leading-[0.85] font-extrabold">P{o.prioridade}</span>
        </span>
      </section>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3 rounded-lg border border-regra bg-white px-4 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-suave uppercase">Protocolo</span>
            <span className="font-mono text-[21px] font-semibold tracking-[0.02em]">{o.protocolo}</span>
          </div>
          <BotaoCopiar protocolo={o.protocolo} />
        </div>

        <section aria-labelledby="onde" className={cartao}>
          <div className="flex items-center">
            <h2 id="onde" className="text-lg font-bold">
              Onde está seu caso
            </h2>
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.12em] text-suave uppercase">
              <span aria-hidden="true" className="vivo size-[7px] rounded-full bg-tinta" /> Ao vivo
            </span>
          </div>
          <Trajeto status={o.status} criadoEm={o.criadoEm} eventos={o.eventos} />
          <p className="mt-3 text-[13px] text-suave">{rotuloCategoria(o.categoria)} · atualiza sozinho</p>
        </section>

        {!encerrada && (
          <section aria-labelledby="agora" className={cartao}>
            <h2 id="agora" className="text-lg font-bold">
              O que fazer agora
            </h2>
            <ol className="mt-2">
              {o.orientacoes.map((t, i) => (
                <li key={t} className="grid grid-cols-[30px_minmax(0,1fr)] gap-1.5 border-t border-regra py-2.5 text-base leading-snug">
                  <span aria-hidden="true" className="pt-0.5 font-mono text-xs font-semibold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            {!ORIENTACOES_VALIDADAS && <p className="text-[12.5px] text-suave">Orientações em validação com médico-veterinário.</p>}
          </section>
        )}

        <section aria-labelledby="servicos" className={cartao}>
          <h2 id="servicos" className="text-lg font-bold">
            Serviços acionados
          </h2>
          <ul className="mt-2">
            {o.servicos.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-regra py-2.5 last:pb-0">
                <div>
                  <p className="font-semibold">{s.nome}</p>
                  <p className="text-[13.5px] text-suave">{s.orgao}</p>
                </div>
                <BotaoLigar servico={s} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="historico" className={cartao}>
          <div className="flex items-baseline gap-2">
            <h2 id="historico" className="text-lg font-bold">
              Acompanhamento
            </h2>
            <span className="ml-auto text-[13px] text-suave">{STATUS[o.status]?.rotulo ?? o.status}</span>
          </div>
          <ol aria-live="polite" className="mt-3.5">
            {o.eventos.map((e, i) => {
              const ultimo = i === o.eventos.length - 1
              return (
                <li key={i} className={`grid grid-cols-[14px_minmax(0,1fr)] gap-3 ${i === destaque ? 'animar-entrada' : ''}`}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 shrink-0 rounded-full ${ultimo ? 'anel size-3 bg-tinta' : 'size-2.5 border-2 border-cinza bg-white'} ${i === destaque ? 'destaque-novo' : ''}`}
                    />
                    {!ultimo && <span className="w-0.5 flex-1 bg-regra" />}
                  </div>
                  <div className={`flex flex-col gap-0.5 ${ultimo ? '' : 'pb-4'}`}>
                    {i === destaque && (
                      <span className="self-start rounded-[2px] bg-tinta px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.1em] text-white">NOVO</span>
                    )}
                    <p className={`leading-snug ${ultimo ? 'text-[16.5px] font-bold' : 'text-[15.5px]'}`}>{e.texto}</p>
                    <p className="font-mono text-[11px] text-suave">{horario(e.criadoEm)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <Link to="/" className="flex min-h-11 items-center justify-center text-[15px] text-suave">
          Voltar ao início
        </Link>
      </div>
    </Casca>
  )
}

const PASSOS = ['Registrada', 'Em atendimento', 'Encaminhada', 'Encerrada']
const INDICE_STATUS: Record<string, number> = { nova: 0, em_atendimento: 1, encaminhada: 2, encerrada: 3, improcedente: 3 }

/**
 * O caminho do caso em quatro paradas, com a hora em que cada uma aconteceu. As horas saem dos eventos públicos
 * (atribuição, mudança de status, encerramento) — quando uma parada foi pulada, fica sem hora.
 */
function Trajeto({ status, criadoEm, eventos }: { status: string; criadoEm: string; eventos: EventoPublico[] }) {
  const atual = INDICE_STATUS[status] ?? 0
  const quando = [
    criadoEm,
    eventos.find((e) => e.tipo === 'atribuida' || (e.tipo === 'status' && e.texto.includes('Em atendimento')))?.criadoEm,
    eventos.find((e) => e.tipo === 'status' && e.texto.includes('Encaminhada'))?.criadoEm,
    eventos.find((e) => e.tipo === 'encerrada')?.criadoEm,
  ]
  return (
    <ol className="mt-4 grid grid-cols-4">
      {PASSOS.map((rotulo, i) => {
        const feito = i <= atual
        const agora = i === atual
        return (
          <li key={rotulo} aria-current={agora ? 'step' : undefined} className="flex flex-col gap-2">
            <div className="relative flex h-4 items-center">
              {i < PASSOS.length - 1 && <span className={`absolute right-0 left-2 h-0.5 ${i < atual ? 'bg-tinta' : 'bg-regra'}`} />}
              <span
                className={`relative size-4 rounded-full ${
                  agora ? 'anel border-4 border-white bg-tinta outline-2 outline-tinta' : feito ? 'bg-tinta' : 'border-2 border-cinza bg-white'
                }`}
              />
            </div>
            {/* Mono em caixa-alta: "ENCAMINHADA" cabe na coluna de um celular de 320 px; em Barlow 14 px ela invadia a vizinha. */}
            <span className={`pr-1 font-mono text-[10.5px] leading-tight tracking-[0.04em] uppercase ${agora ? 'font-semibold' : feito ? '' : 'text-suave'}`}>
              {i === 3 && status === 'improcedente' ? 'Improcedente' : rotulo}
            </span>
            {feito && quando[i] && <span className="font-mono text-[11px] text-suave">{hora(quando[i]!)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function BuscarProtocolo() {
  const navegar = useNavigate()
  const [valor, setValor] = useState('')
  const recentes = useProtocolosSalvos()
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (valor.trim()) navegar(`/acompanhar/${valor.trim().toUpperCase()}`)
  }
  return (
    <Casca>
      <form onSubmit={enviar} className="flex flex-col gap-3 p-5">
        <h1 className="font-display text-[40px] leading-[0.9] font-extrabold uppercase">Acompanhar ocorrência</h1>
        <label htmlFor="protocolo" className="mt-2 text-sm font-semibold">
          Número do protocolo
        </label>
        <input
          id="protocolo"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          spellCheck={false}
          placeholder="Ex.: CA-2026-000123"
          autoCapitalize="characters"
          className="h-13 w-full rounded-md border border-cinza bg-white px-3.5 font-mono text-lg uppercase placeholder:text-suave"
        />
        <button className="min-h-12 rounded-md bg-tinta font-semibold text-white">Consultar</button>
        {recentes.length > 0 && (
          <div className="flex flex-col gap-2 pt-4">
            <p className="font-mono text-[10.5px] font-medium tracking-[0.14em] text-suave uppercase">Seus protocolos</p>
            {recentes.map(({ protocolo }) => (
              <Link key={protocolo} to={`/acompanhar/${protocolo}`} className="flex min-h-12 items-center rounded-md border border-regra bg-white px-4 font-mono text-[15px] font-semibold">
                {protocolo}
              </Link>
            ))}
          </div>
        )}
      </form>
    </Casca>
  )
}

/** Copiar sem retorno visual deixa a dúvida "copiou?"; o rótulo confirma e o role=status anuncia. */
function BotaoCopiar({ protocolo }: { protocolo: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(protocolo)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2500)
      }}
      className="ml-auto flex min-h-11 items-center gap-1.5 rounded-md border-[1.5px] border-tinta px-3.5 text-[15px] font-semibold"
    >
      {copiado ? <Check className="size-4" /> : <Copiar className="size-4" />}
      <span role="status">{copiado ? 'Copiado' : 'Copiar'}</span>
    </button>
  )
}

function Casca({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-full max-w-md bg-papel">
      <header className="flex h-13 items-center bg-tinta pr-3 pl-4 text-claro">
        <Link to="/" className="flex min-h-11 items-center gap-2">
          <Pata className="size-[18px]" />
          <span className="font-display text-[17px] font-extrabold tracking-wide uppercase">Central Animal</span>
        </Link>
        <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-nevoa uppercase">Acompanhamento</span>
      </header>
      {children}
    </main>
  )
}
