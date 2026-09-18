import { PRIORIDADES, type Prioridade } from '@ca/triagem'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import { useState, type ReactNode } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { api, enviarJson } from '../api'
import type { OcorrenciaDetalhe, Servidor } from '../tipos'
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

export default function Detalhe({ id, demo, onFechar, onAbrir }: { id: string; demo: boolean; onFechar: () => void; onAbrir: (id: string) => void }) {
  const qc = useQueryClient()
  const { data: o, isLoading } = useQuery({
    queryKey: ['detalhe', id],
    queryFn: () => api<OcorrenciaDetalhe>(`/api/painel/ocorrencias/${id}`),
    refetchInterval: 3000,
  })
  const servidores = useQuery({ queryKey: ['servidores'], queryFn: () => api<Servidor[]>('/api/painel/servidores') })
  const [mostrarRelato, setMostrarRelato] = useState(false)

  const acao = useMutation({
    mutationFn: (corpo: object) => enviarJson(`/api/painel/ocorrencias/${id}`, corpo, 'PATCH'),
    onSuccess: () => qc.invalidateQueries(),
  })
  const providencia = useMutation({
    mutationFn: (corpo: { texto: string; visivelCidadao: boolean }) => enviarJson(`/api/painel/ocorrencias/${id}/eventos`, corpo),
    onSuccess: () => qc.invalidateQueries(),
  })

  if (isLoading || !o) return <Carregando />

  const aberta = !['encerrada', 'improcedente'].includes(o.status)
  const divergencias = o.sugestaoIa
    ? Object.keys(ROTULO_PERGUNTA).filter(
        (k) => o.sugestaoIa![k] !== undefined && JSON.stringify(o.sugestaoIa![k]) !== JSON.stringify(o.respostas[k]),
      )
    : []

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeloPrioridade p={o.prioridade} grande />
            <SeloStatus status={o.status} />
            <span className="font-mono text-sm text-slate-500">{o.protocolo}</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold">{rotuloCategoria(o.categoria)}</h2>
          <p className="text-sm text-slate-500">
            Registrada {tempoRelativo(o.criadoEm)} ({horario(o.criadoEm)}) · {o.responsavel ? `Responsável: ${o.responsavel}` : 'Sem responsável'}
          </p>
        </div>
        <button onClick={onFechar} className="rounded-lg px-3 py-1 text-2xl text-slate-400 hover:bg-slate-100">
          ×
        </button>
      </div>

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
            ⚠️ {o.relacionadas.length} {o.relacionadas.length === 1 ? 'ocorrência anterior' : 'ocorrências anteriores'} a menos de 200 m nos últimos 90 dias
          </p>
          <ul className="mt-2 space-y-1">
            {o.relacionadas.map((r) => (
              <li key={r.id}>
                <button onClick={() => onAbrir(r.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-amber-100">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <Cartao titulo="✨ Análise da IA (Qwen local)">
          {o.iaStatus === 'pendente' && (
            <p className="flex items-center gap-2 text-sm text-marca-700">
              <span className="size-4 animate-spin rounded-full border-2 border-marca-100 border-t-marca-600" /> Analisando relato e foto…
            </p>
          )}
          {o.resumoIa && <p className="text-[15px] leading-snug">{o.resumoIa}</p>}
          {o.analiseFotoIa && (
            <p className="mt-2 text-sm text-slate-700">
              <b>Foto:</b> {o.analiseFotoIa}
            </p>
          )}
          {!o.resumoIa && !o.analiseFotoIa && o.iaStatus !== 'pendente' && <p className="text-sm text-slate-400">Sem relato livre nem foto para analisar.</p>}
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
                <dd className="font-medium">{rotuloResposta(k, v)}</dd>
              </div>
            ))}
          </dl>
        </Cartao>

        {o.relato && (
          <Cartao titulo="Relato do cidadão">
            {demo && !mostrarRelato ? (
              <button onClick={() => setMostrarRelato(true)} className="text-sm text-marca-700 underline">
                Mostrar relato (oculto no modo demo)
              </button>
            ) : (
              <p className="text-[15px] leading-snug whitespace-pre-wrap">“{o.relato}”</p>
            )}
          </Cartao>
        )}

        <Cartao titulo="Local">
          {o.lat != null && o.lng != null && (
            <MapContainer center={[o.lat, o.lng]} zoom={16} className="h-40 w-full rounded-lg" attributionControl={false} scrollWheelZoom={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[o.lat, o.lng]} icon={pino} />
            </MapContainer>
          )}
          <p className="mt-2 text-sm">{o.endereco ?? 'Sem referência escrita'}</p>
        </Cartao>

        {o.fotos.length > 0 && (
          <Cartao titulo="Fotos">
            <div className="flex gap-2">
              {o.fotos.map((f) => (
                <a key={f} href={f} target="_blank" rel="noreferrer">
                  <img src={f} alt="Foto da ocorrência" className="h-40 rounded-lg object-cover" />
                </a>
              ))}
            </div>
          </Cartao>
        )}

        <Cartao titulo="Contato">
          {o.anonimo ? (
            <p className="text-sm text-slate-500">Relato anônimo</p>
          ) : demo ? (
            <p className="text-sm text-slate-500">Contato informado (oculto no modo demo)</p>
          ) : (
            <p className="text-sm">
              {o.contatoNome} · {o.contatoTel}
            </p>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Encaminhamento">
        <ul className="divide-y divide-slate-100">
          {o.servicos.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{s.nome}</p>
                <p className="text-xs text-slate-500">{s.orgao}</p>
              </div>
              <BotaoLigar servico={s} />
            </li>
          ))}
        </ul>
      </Cartao>

      {aberta && (
        <Acoes
          o={o}
          servidores={servidores.data ?? []}
          ocupado={acao.isPending || providencia.isPending}
          erro={(acao.error ?? providencia.error)?.message}
          onAcao={(c) => acao.mutate(c)}
          onProvidencia={(texto, visivelCidadao) => providencia.mutate({ texto, visivelCidadao })}
        />
      )}

      {o.desfecho && (
        <Cartao titulo="Desfecho">
          <p>{o.desfecho}</p>
        </Cartao>
      )}

      <Cartao titulo="Linha do tempo">
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {o.eventos.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-marca-600" />
              <p className="text-sm">{e.texto}</p>
              <p className="text-xs text-slate-400">
                {horario(e.criadoEm)} · {e.autor} {e.visivelCidadao ? '· 👁 visível ao cidadão' : '· 🔒 interno'}
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

  return (
    <Cartao titulo="Ações" className="border-marca-200 ring-1 ring-marca-100">
      <div className="space-y-4">
        <Linha rotulo="Responsável">
          <select
            value={o.responsavelId ?? ''}
            disabled={props.ocupado}
            onChange={(e) => e.target.value && props.onAcao({ acao: 'atribuir', responsavelId: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Atribuir a…</option>
            {props.servidores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome} — {s.setor}
              </option>
            ))}
          </select>
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

        <div>
          <p className="mb-1 text-sm font-medium">Registrar providência</p>
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Equipe a caminho. Plantão veterinário avisado."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && texto.trim().length > 1) {
                  props.onProvidencia(texto.trim(), visivel)
                  setTexto('')
                }
              }}
            />
            <button
              disabled={props.ocupado || texto.trim().length < 2}
              onClick={() => {
                props.onProvidencia(texto.trim(), visivel)
                setTexto('')
              }}
              className="rounded-lg bg-marca-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              Registrar
            </button>
          </div>
          <label className="mt-1 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} /> Visível para o cidadão
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setModo(modo === 'reclassificar' ? 'nenhum' : 'reclassificar')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Reclassificar prioridade
          </button>
          <button onClick={() => setModo(modo === 'encerrar' ? 'nenhum' : 'encerrar')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            Encerrar ocorrência
          </button>
        </div>

        {modo === 'reclassificar' && (
          <Linha rotulo="Nova prioridade">
            <select value={novaP} onChange={(e) => setNovaP(Number(e.target.value) as Prioridade)} className="rounded-lg border border-slate-300 px-3 py-2">
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>
                  P{p} · {PRIORIDADES[p].rotulo}
                </option>
              ))}
            </select>
            <input
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Justificativa (obrigatória)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
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
              placeholder="Desfecho (obrigatório) — ex.: Animal atendido e encaminhado para adoção."
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="flex items-center gap-3">
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

        {props.erro && <p className="text-sm text-red-600">{props.erro}</p>}
      </div>
    </Cartao>
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
