import { CAPACIDADES, CATEGORIAS, podarRespostas, PRIORIDADES, type Prioridade } from '@ca/triagem'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import { useState, type ReactNode } from 'react'
import { AttributionControl, MapContainer, Marker, TileLayer } from 'react-leaflet'
import { api, enviarJson } from '../api'
import { ATRIBUICAO_OSM, RotuloMapa } from '../cidadao/MapaPino'
import type { Frente, OcorrenciaDetalhe, Profissional, Servidor } from '../tipos'
import { BotaoLigar, Carregando, Cartao, horario, rotuloCategoria, rotuloResposta, SeloPrioridade, SeloStatus, STATUS, tempoRelativo } from '../ui'

const pino = L.divIcon({ html: '<div style="font-size:28px;line-height:1;transform:translate(-50%,-100%)">📍</div>', className: '', iconSize: [0, 0] })

const ROTULO_PERGUNTA: Record<string, string> = {
  pessoa_risco: 'Pessoa em risco',
  tipo_animal: 'Animal',
  situacao: 'Situação',
  situacao_silvestre: 'Onde está',
  sinais: 'Sinais',
  maus_tratos_agora: 'Acontecendo agora',
  abandono_filhotes: 'Filhotes',
  outros_animais: 'Outros animais afetados',
}

// Caminho que as regras escolheram (packages/triagem/src/regras.ts): o operador vê a rota, não só a lista de serviços.
const ROTA: Record<string, string> = {
  humana: 'Rota humana',
  fauna: 'Rota de fauna silvestre',
  policial: 'Rota policial',
  municipal: 'Rota municipal',
}

export default function Detalhe({ id, demo, onFechar, onAbrir }: { id: string; demo: boolean; onFechar: () => void; onAbrir: (id: string) => void }) {
  const qc = useQueryClient()
  const { data: o, isLoading } = useQuery({
    queryKey: ['detalhe', id],
    queryFn: () => api<OcorrenciaDetalhe>(`/api/painel/ocorrencias/${id}`),
    refetchInterval: 3000,
  })
  const servidores = useQuery({ queryKey: ['servidores'], queryFn: () => api<Servidor[]>('/api/painel/servidores') })
  // Confirma na hora o que foi registrado. Antes, o único sinal era uma linha nova no fim da linha do tempo, fora da tela.
  const [registrado, setRegistrado] = useState<{ visivel: boolean } | null>(null)

  const acao = useMutation({
    mutationFn: (corpo: object) => enviarJson(`/api/painel/ocorrencias/${id}`, corpo, 'PATCH'),
    onSuccess: () => qc.invalidateQueries(),
  })
  const providencia = useMutation({
    mutationFn: (corpo: { texto: string; visivelCidadao: boolean }) => enviarJson(`/api/painel/ocorrencias/${id}/eventos`, corpo),
    onSuccess: (_, corpo) => {
      qc.invalidateQueries()
      setRegistrado({ visivel: corpo.visivelCidadao })
      setTimeout(() => setRegistrado(null), 6000)
    },
  })

  if (isLoading || !o) return <Carregando />

  const aberta = !['encerrada', 'improcedente'].includes(o.status)
  // Compara com a sugestão já podada pela árvore: o que a árvore descartou não é "correção do cidadão".
  const sugerido = o.sugestaoIa ? podarRespostas({ pessoa_risco: String(o.respostas.pessoa_risco), ...o.sugestaoIa }) : null
  const divergencias = sugerido
    ? Object.keys(ROTULO_PERGUNTA).filter(
        (k) => k !== 'pessoa_risco' && sugerido[k] !== undefined && JSON.stringify(sugerido[k]) !== JSON.stringify(o.respostas[k]),
      )
    : []
  const contato = o.anonimo ? 'Relato anônimo' : demo ? 'Contato informado (oculto no modo demo)' : `${o.contatoNome} · ${o.contatoTel}`

  return (
    <div className="space-y-4 p-4 @3xl:p-6">
      {/* No celular o caso ocupa a tela inteira: volta para a fila em vez do × */}
      <button onClick={onFechar} className="-my-1 py-1 text-sm font-semibold text-marca-700 lg:hidden">
        ‹ Voltar à fila
      </button>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeloPrioridade p={o.prioridade} grande />
            <SeloStatus status={o.status} />
            <span className="font-mono text-sm text-slate-600">{o.protocolo}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-balance">{rotuloCategoria(o.categoria)}</h2>
          {/* slate-600: este bloco fica sobre o fundo do painel (slate-100), onde o slate-500 dá 4,35:1. */}
          <p className="text-sm text-slate-600">
            Registrada {tempoRelativo(o.criadoEm)} ({horario(o.criadoEm)}) · {o.responsavel ? `Responsável: ${o.responsavel}` : 'Sem responsável'}
          </p>
          <p className="text-sm text-slate-600">
            {ROTA[o.rota] ?? o.rota} · {contato}
          </p>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="hidden rounded-lg px-3 py-1 text-2xl text-slate-600 hover:bg-slate-200 lg:block">
          ×
        </button>
      </div>

      {o.rota === 'humana' && (
        <div className="rounded-xl bg-p1 px-4 py-3 text-white">
          <p className="font-bold">Pessoa em risco</p>
          <p className="text-sm">Confirme se o SAMU (192) ou os Bombeiros (193) já foram acionados. O cidadão foi orientado a ligar.</p>
        </div>
      )}

      <div className="rounded-xl border-l-4 bg-white p-4 shadow-sm" style={{ borderColor: PRIORIDADES[o.prioridade].cor }}>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Por que esta prioridade</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {o.motivos.map((m) => (
            <span key={m} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">
              {m}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Classificação por regras explicáveis · {PRIORIDADES[o.prioridade].prazo}
        </p>
      </div>

      {o.relacionadas.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">
            <span aria-hidden="true">⚠️</span> {o.relacionadas.length} {o.relacionadas.length === 1 ? 'ocorrência anterior' : 'ocorrências anteriores'} a menos de 200 m nos últimos 90 dias
          </p>
          <ul className="mt-2 space-y-1">
            {o.relacionadas.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onAbrir(r.id)}
                  className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1 text-left text-sm hover:bg-amber-100"
                >
                  <SeloPrioridade p={r.prioridade} />
                  <span className="font-mono text-xs">{r.protocolo}</span>
                  <span>{rotuloCategoria(r.categoria)}</span>
                  <span className="text-slate-500">· {Math.round(r.distancia)} m · {tempoRelativo(r.criadoEm)}</span>
                  <span className="ml-auto">
                    <SeloStatus status={r.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ações logo abaixo do "porquê": atribuir e registrar sem rolar a página na frente da plateia. */}
      {aberta && (
        <Acoes
          o={o}
          servidores={servidores.data ?? []}
          ocupado={acao.isPending || providencia.isPending}
          erro={(acao.error ?? providencia.error)?.message}
          registrado={registrado}
          onAcao={(c) => acao.mutate(c)}
          onProvidencia={(texto, visivelCidadao) => providencia.mutate({ texto, visivelCidadao })}
        />
      )}

      {o.desfecho && (
        <Cartao titulo="Desfecho">
          <p>{o.desfecho}</p>
        </Cartao>
      )}

      {/* Duas colunas quando o painel tem espaço (não a janela); cartão ímpar no fim ocupa a linha inteira. */}
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @2xl:[&>:last-child:nth-child(odd)]:col-span-2">
        <Cartao titulo={<><span aria-hidden="true">✨</span> Análise da IA (Qwen local)</>}>
          {o.iaStatus === 'pendente' && (
            <p className="flex items-center gap-2 text-sm text-marca-700">
              <span className="size-4 animate-spin rounded-full border-2 border-marca-100 border-t-marca-600" /> Analisando relato e foto…
            </p>
          )}
          {(o.resumoIa || o.analiseFotoIa) && (
            <Revelar demo={demo} rotulo="Mostrar análise da IA (oculta no modo demo)">
              {o.resumoIa && <p className="text-[15px] leading-snug">{o.resumoIa}</p>}
              {o.analiseFotoIa && (
                <p className="mt-2 text-sm text-slate-700">
                  <b>Foto:</b> {o.analiseFotoIa}
                </p>
              )}
            </Revelar>
          )}
          {!o.resumoIa && !o.analiseFotoIa && o.iaStatus !== 'pendente' && (
            <p className="text-sm text-slate-500">
              {o.iaStatus === 'erro' ? 'A IA não conseguiu analisar agora. O relato original está logo abaixo.' : 'Sem relato livre nem foto para analisar.'}
            </p>
          )}
          {o.sugestaoIa && (
            <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
              {divergencias.length === 0
                ? '✓ O cidadão confirmou a interpretação da IA.'
                : `✎ O cidadão corrigiu a IA em: ${divergencias.map((k) => ROTULO_PERGUNTA[k]).join(', ')}.`}
            </p>
          )}
        </Cartao>

        <Cartao titulo="Respostas da triagem">
          <dl className="space-y-1 text-sm">
            {Object.entries(o.respostas).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-36 shrink-0 text-slate-500">{ROTULO_PERGUNTA[k] ?? k}</dt>
                <dd className="min-w-0 font-medium">{rotuloResposta(k, v)}</dd>
              </div>
            ))}
          </dl>
        </Cartao>

        {o.relato && (
          <Cartao titulo="Relato do cidadão">
            <Revelar demo={demo} rotulo="Mostrar relato (oculto no modo demo)">
              <p className="text-[15px] leading-snug whitespace-pre-wrap">“{o.relato}”</p>
            </Revelar>
          </Cartao>
        )}

        <Cartao titulo="Local">
          {o.lat != null && o.lng != null && (
            <MapContainer center={[o.lat, o.lng]} zoom={16} className="h-40 w-full rounded-lg" attributionControl={false} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
              <AttributionControl prefix={false} />
              <RotuloMapa rotulo="Mapa com o local da ocorrência." />
              <Marker position={[o.lat, o.lng]} icon={pino} />
            </MapContainer>
          )}
          <div className="mt-2 text-sm">
            {o.endereco ? (
              <Revelar demo={demo} rotulo="Mostrar endereço (oculto no modo demo)">
                <p>{o.endereco}</p>
              </Revelar>
            ) : (
              <p>Sem referência escrita</p>
            )}
          </div>
        </Cartao>

        {o.fotos.length > 0 && (
          <Cartao titulo="Fotos">
            <Revelar demo={demo} rotulo={o.fotos.length === 1 ? 'Mostrar foto (oculta no modo demo)' : 'Mostrar fotos (ocultas no modo demo)'}>
              <div className="flex gap-2 overflow-x-auto">
                {o.fotos.map((f) => (
                  <a key={f} href={f} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={f} alt="Foto da ocorrência" width={640} height={480} loading="lazy" className="h-40 rounded-lg object-cover" />
                  </a>
                ))}
              </div>
            </Revelar>
          </Cartao>
        )}
      </div>

      {o.frentes.length > 0 && (
        <Cartao titulo="Quem pode atender">
          <div className="space-y-4">
            {o.frentes.map((f) => (
              <FrenteAtendimento key={f.id} f={f} />
            ))}
          </div>
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
            Ordenado por competência e distância em linha reta · cadastro de demonstração
          </p>
        </Cartao>
      )}

      {o.prioridade <= 2 && (
        <Cartao titulo="Para passar a quem vai atender">
          <Revelar demo={demo} rotulo="Mostrar briefing (oculto no modo demo)">
            <Briefing o={o} />
          </Revelar>
        </Cartao>
      )}

      <Cartao titulo="Encaminhamento">
        <ul className="divide-y divide-slate-100">
          {o.servicos.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">{s.nome}</p>
                <p className="text-xs text-slate-500">{s.orgao}</p>
              </div>
              <BotaoLigar servico={s} />
            </li>
          ))}
        </ul>
      </Cartao>

      <Cartao titulo="Linha do tempo">
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {o.eventos.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-marca-600" />
              <p className="text-sm">{e.texto}</p>
              <p className="text-xs text-slate-500">
                {horario(e.criadoEm)} · {e.autor} · <span aria-hidden="true">{e.visivelCidadao ? '👁' : '🔒'}</span>{' '}
                {e.visivelCidadao ? 'visível ao cidadão' : 'interno'}
              </p>
            </li>
          ))}
        </ol>
      </Cartao>
    </div>
  )
}

function Acoes(props: {
  o: OcorrenciaDetalhe
  servidores: Servidor[]
  ocupado: boolean
  erro?: string
  registrado: { visivel: boolean } | null
  onAcao: (corpo: object) => void
  onProvidencia: (texto: string, visivel: boolean) => void
}) {
  const { o } = props
  const [texto, setTexto] = useState('')
  const [visivel, setVisivel] = useState(true)
  const [modo, setModo] = useState<'nenhum' | 'reclassificar' | 'encerrar'>('nenhum')
  const [novaP, setNovaP] = useState<Prioridade>(o.prioridade)
  const [justificativa, setJustificativa] = useState('')
  const [desfecho, setDesfecho] = useState('')
  const [improcedente, setImprocedente] = useState(false)

  const registrar = () => {
    props.onProvidencia(texto.trim(), visivel)
    setTexto('')
  }

  return (
    <Cartao titulo="Ações" className="border-marca-200 ring-1 ring-marca-100">
      <div className="space-y-4">
        {/* grid-cols-1 explícito: sem ele a coluna cresce até o nome mais longo do select e vaza do cartão no celular. */}
        <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
          <Linha rotulo="Responsável">
            <select
              value={o.responsavelId ?? ''}
              disabled={props.ocupado}
              onChange={(e) => e.target.value && props.onAcao({ acao: 'atribuir', responsavelId: e.target.value })}
              aria-label="Responsável pela ocorrência"
              className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">Atribuir a…</option>
              {props.servidores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} — {s.setor}
                </option>
              ))}
            </select>
          </Linha>
          <Linha rotulo="Status">
            {(['em_atendimento', 'encaminhada'] as const).map((s) => (
              <button
                key={s}
                disabled={props.ocupado || o.status === s}
                onClick={() => props.onAcao({ acao: 'status', status: s })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
              >
                {STATUS[s].rotulo}
              </button>
            ))}
          </Linha>
        </div>

        <div>
          <label htmlFor="providencia" className="mb-1 block text-sm font-medium">
            Registrar providência
          </label>
          <div className="flex gap-2">
            <input
              id="providencia"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Equipe a caminho. Plantão veterinário avisado."
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && texto.trim().length > 1) registrar()
              }}
            />
            <button
              disabled={props.ocupado || texto.trim().length < 2}
              onClick={registrar}
              className="rounded-lg bg-marca-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              Registrar
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} /> Visível para o cidadão
            </label>
            {props.registrado && (
              <span role="status" className="animar-entrada text-sm font-semibold text-marca-700">
                {props.registrado.visivel ? '✓ Registrado · aparece no celular do cidadão em até 5 s' : '✓ Registrado como nota interna'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModo(modo === 'reclassificar' ? 'nenhum' : 'reclassificar')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Reclassificar prioridade
          </button>
          <button onClick={() => setModo(modo === 'encerrar' ? 'nenhum' : 'encerrar')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Encerrar ocorrência
          </button>
        </div>

        {modo === 'reclassificar' && (
          <Linha rotulo="Nova prioridade">
            <select
              value={novaP}
              onChange={(e) => setNovaP(Number(e.target.value) as Prioridade)}
              aria-label="Nova prioridade"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>
                  P{p} · {PRIORIDADES[p].rotulo}
                </option>
              ))}
            </select>
            <input
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              aria-label="Justificativa da reclassificação"
              placeholder="Por que muda de prioridade…"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              disabled={props.ocupado || justificativa.trim().length < 3 || novaP === o.prioridade}
              onClick={() => {
                props.onAcao({ acao: 'reclassificar', prioridade: novaP, justificativa: justificativa.trim() })
                setModo('nenhum')
                setJustificativa('')
              }}
              className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              Salvar
            </button>
          </Linha>
        )}

        {modo === 'encerrar' && (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <textarea
              value={desfecho}
              onChange={(e) => setDesfecho(e.target.value)}
              rows={2}
              aria-label="Desfecho da ocorrência"
              placeholder="Ex.: Animal atendido e encaminhado para adoção…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={improcedente} onChange={(e) => setImprocedente(e.target.checked)} /> Improcedente / trote
              </label>
              <button
                disabled={props.ocupado || desfecho.trim().length < 3}
                onClick={() => props.onAcao({ acao: 'encerrar', desfecho: desfecho.trim(), improcedente })}
                className="ml-auto rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-40"
              >
                Encerrar
              </button>
            </div>
          </div>
        )}

        {props.erro && <p role="alert" className="text-sm text-red-600">{props.erro}</p>}
      </div>
    </Cartao>
  )
}

/**
 * Resumo pronto para ser lido no rádio ou colado no WhatsApp de quem está a caminho.
 *
 * Montado por concatenação de campos, não por IA: precisa ser instantâneo, igual toda vez e sem
 * chance de inventar. O que a IA produziu (resumo e leitura da foto) entra como citação, marcado.
 */
function textoBriefing(o: OcorrenciaDetalhe): string {
  const p = PRIORIDADES[o.prioridade]
  const grupo = (o.respostas.grupo_silvestre ?? o.respostas.grupo_domestico) as string | undefined
  const especie = [
    o.respostas.tipo_animal === 'silvestre' ? 'Silvestre' : 'Doméstico',
    grupo && rotuloResposta(o.respostas.grupo_silvestre ? 'grupo_silvestre' : 'grupo_domestico', grupo),
  ]
    .filter(Boolean)
    .join(' · ')

  const linhas = [
    `CENTRAL ANIMAL · ${o.protocolo} · PRIORIDADE ${p.rotulo.toUpperCase()}`,
    `Registrado ${tempoRelativo(o.criadoEm)} (${horario(o.criadoEm)}) · ${CATEGORIAS[o.categoria]}`,
    '',
  ]

  // O dado que mais muda a conduta de quem recebe: tem gente ferida?
  linhas.push(
    o.rota === 'humana'
      ? 'PESSOA FERIDA: SIM. O cidadão foi orientado a ligar 192 (SAMU) ou 193 (Bombeiros).'
      : 'PESSOA FERIDA: não relatada.',
    '',
  )

  if (o.relato) linhas.push('O QUE O CIDADÃO RELATOU', o.relato, '')
  linhas.push('ANIMAL', especie)
  if (o.analiseFotoIa) linhas.push(`Foto (leitura automática, confirmar no local): ${o.analiseFotoIa}`)
  linhas.push('')

  linhas.push('LOCAL', o.endereco ?? 'Sem referência escrita')
  if (o.lat != null && o.lng != null) linhas.push(`${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}`)
  linhas.push('')

  linhas.push('CONTATO', o.anonimo ? 'Relato anônimo — sem retorno possível' : `${o.contatoNome} · ${o.contatoTel}`)
  return linhas.join('\n')
}

function Briefing({ o }: { o: OcorrenciaDetalhe }) {
  const [copiado, setCopiado] = useState(false)
  const texto = textoBriefing(o)
  return (
    <div className="space-y-2">
      {/* Região rolável precisa de foco próprio: sem tabindex, quem usa teclado não consegue ler o resto. */}
      <pre
        tabIndex={0}
        role="region"
        aria-label="Briefing da ocorrência"
        className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-800"
      >
        {texto}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2500)
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
      >
        <span role="status">{copiado ? '✓ Copiado' : 'Copiar briefing'}</span>
      </button>
    </div>
  )
}

/** Uma frente do caso. A da pessoa vem primeiro e marcada: é a que não pode ser lida por último. */
function FrenteAtendimento({ f }: { f: Frente }) {
  const pessoa = f.id === 'pessoa'
  return (
    <section>
      <h4 className={`text-xs font-semibold tracking-wide uppercase ${pessoa ? 'text-p1' : 'text-slate-500'}`}>
        {pessoa && <span aria-hidden="true">▲ </span>}
        {f.rotulo}
      </h4>
      <ul className="divide-y divide-slate-100">
        {f.opcoes.map((p) => (
          <li key={p.id}>
            <LinhaProfissional p={p} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** 1,2 km acima de 1 km; 840 m abaixo. Em metro cheio: ninguém precisa de 843 m. */
function distancia(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10} m`
}

/** Uma opção de atendimento: quem é, o que cobre, a que distância e como acionar. */
function LinhaProfissional({ p }: { p: Profissional }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="font-medium">
          {p.nome}
          {p.atende24h && <span className="ml-2 rounded bg-marca-50 px-1.5 py-0.5 text-[11px] font-semibold text-marca-700">24h</span>}
        </p>
        <p className="text-xs text-slate-500">
          {p.orgao} · {distancia(p.distancia)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {p.atendidas.map((c) => (
            <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {CAPACIDADES[c]}
            </span>
          ))}
          {/* Cobre parte do que o caso exige: o operador precisa saber antes de ligar. */}
          {!p.cobreTudo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">cobre em parte</span>}
        </div>
        {p.observacao && <p className="mt-1 text-xs text-slate-500">{p.observacao}</p>}
      </div>
      <div className="shrink-0">
        <BotaoLigar servico={{ id: p.id, nome: p.nome, orgao: p.orgao, telefone: p.telefone }} />
      </div>
    </div>
  )
}

/** Modo demo: o que a plateia escreveu ou fotografou só vai para o telão depois de um clique do operador. */
function Revelar({ demo, rotulo, children }: { demo: boolean; rotulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  if (!demo || aberto) return <>{children}</>
  return (
    <button onClick={() => setAberto(true)} className="text-sm text-marca-700 underline">
      {rotulo}
    </button>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{rotulo}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
