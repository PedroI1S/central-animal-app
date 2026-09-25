import { CAPACIDADES, CATEGORIAS, podarRespostas, PRIORIDADES, type Prioridade } from '@ca/triagem'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { AttributionControl, Circle, CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { api, enviarJson } from '../api'
import { ATRIBUICAO_OSM, RotuloMapa } from '../cidadao/MapaPino'
import { Aviso, Cadeado, Check, Copiar, Faisca, Fechar, Lapis, Olho, Voltar } from '../icones'
import type { Frente, OcorrenciaDetalhe, Profissional, Servidor } from '../tipos'
import { BotaoLigar, Carregando, Cartao, especieDe, hora, horario, Rotulo, rotuloCategoria, rotuloResposta, SeloPrioridade, SeloStatus, STATUS, tempoRelativo } from '../ui'

const ROTULO_PERGUNTA: Record<string, string> = {
  pessoa_risco: 'Pessoa em risco',
  tipo_animal: 'Animal',
  grupo_domestico: 'Que animal',
  grupo_silvestre: 'Que animal',
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

/**
 * O chat grava o relato seguido da conversa com a IA ("— Central: …\n— Cidadão: …", separados por linha em branco).
 * Aqui os dois voltam a ser coisas diferentes: o relato vai para o cartão do cidadão; a conversa, para o da IA.
 */
function separarConversa(relato: string | null): { texto: string | null; trocas: { pergunta: string; resposta: string }[] } {
  if (!relato) return { texto: null, trocas: [] }
  const partes = relato.split('\n\n')
  const trocas: { pergunta: string; resposta: string }[] = []
  while (partes.length > 1) {
    const m = /^— Central: ([\s\S]*)\n— Cidadão: ([\s\S]*)$/.exec(partes[partes.length - 1])
    if (!m) break
    trocas.unshift({ pergunta: m[1], resposta: m[2] })
    partes.pop()
  }
  return { texto: partes.join('\n\n'), trocas }
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

  if (isLoading || !o) return <Carregando noite />

  const aberta = !['encerrada', 'improcedente'].includes(o.status)
  // Compara com a sugestão já podada pela árvore: o que a árvore descartou não é "correção do cidadão".
  const sugerido = o.sugestaoIa ? podarRespostas({ pessoa_risco: String(o.respostas.pessoa_risco), ...o.sugestaoIa }) : null
  const divergencias = sugerido
    ? Object.keys(ROTULO_PERGUNTA).filter(
        (k) => k !== 'pessoa_risco' && sugerido[k] !== undefined && JSON.stringify(sugerido[k]) !== JSON.stringify(o.respostas[k]),
      )
    : []
  const contato = o.anonimo ? 'Relato anônimo' : demo ? 'Informado (oculto no modo demo)' : `${o.contatoNome} · ${o.contatoTel}`
  const { texto: relato, trocas } = separarConversa(o.relato)
  const animal = [
    o.respostas.tipo_animal === 'silvestre' ? 'Silvestre' : o.respostas.tipo_animal === 'domestico' ? 'Doméstico' : null,
    especieDe(o.respostas),
  ]
    .filter(Boolean)
    .join(' · ')
  const temLocal = o.lat != null && o.lng != null

  return (
    <div className="space-y-6 p-4 @3xl:px-8 @3xl:py-7">
      {/* No celular o caso ocupa a tela inteira: volta para a fila em vez do × */}
      <button type="button" onClick={onFechar} className="-my-1 flex min-h-11 items-center gap-1 text-sm font-semibold lg:hidden">
        <Voltar className="size-4" /> Voltar à fila
      </button>

      <div className="relative flex flex-col gap-6 border-b border-noite-linha pb-6 @4xl:flex-row @4xl:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5 pr-12">
            <SeloPrioridade p={o.prioridade} grande />
            <SeloStatus status={o.status} noite />
            <span className="font-mono text-sm text-nevoa">{o.protocolo}</span>
          </div>
          <h2 className="mt-1 font-display text-5xl leading-[0.86] font-extrabold text-balance uppercase @3xl:text-7xl">{rotuloCategoria(o.categoria)}</h2>
          {animal && <p className="text-xl text-claro-2">{animal}</p>}
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2.5 @xl:grid-cols-2">
            <Dado rotulo="Registrada">
              {tempoRelativo(o.criadoEm)} · {horario(o.criadoEm)}
            </Dado>
            <Dado rotulo="Responsável">{o.responsavel ?? 'Sem responsável'}</Dado>
            <Dado rotulo="Rota">{ROTA[o.rota] ?? o.rota}</Dado>
            <Dado rotulo="Contato">{contato}</Dado>
          </dl>
        </div>
        <EscadaPrioridade p={o.prioridade} motivos={o.motivos} />
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar caso"
          className="absolute -top-1.5 right-0 hidden size-11 place-items-center rounded border border-noite-3 hover:bg-noite-2 lg:grid"
        >
          <Fechar className="size-[18px]" />
        </button>
      </div>

      {o.rota === 'humana' && (
        <div className="rounded-md bg-p1 px-5 py-4 text-tinta">
          <p className="font-display text-2xl leading-none font-extrabold uppercase">Pessoa em risco</p>
          <p className="mt-1.5 text-[15px]">Confirme se o SAMU (192) ou os Bombeiros (193) já foram acionados. O cidadão foi orientado a ligar.</p>
        </div>
      )}

      {o.relacionadas.length > 0 && (
        <Cartao
          tom="border-p3"
          titulo={
            <span className="flex items-center gap-2 text-p3">
              <Aviso className="size-4" />
              Reincidência · {o.relacionadas.length} {o.relacionadas.length === 1 ? 'anterior' : 'anteriores'} a 200 m em 90 dias
            </span>
          }
        >
          <ul className="-mx-2 space-y-0.5">
            {o.relacionadas.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(r.id)}
                  className="flex min-h-11 w-full flex-wrap items-center gap-x-2.5 gap-y-1 rounded px-2 py-1.5 text-left text-sm hover:bg-noite-2"
                >
                  <SeloPrioridade p={r.prioridade} />
                  <span className="font-mono text-xs text-nevoa">{r.protocolo}</span>
                  <span className="font-semibold">{rotuloCategoria(r.categoria)}</span>
                  <span className="font-mono text-xs text-nevoa">
                    {Math.round(r.distancia)} m · {tempoRelativo(r.criadoEm)}
                  </span>
                  <span className="ml-auto">
                    <SeloStatus status={r.status} noite />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Cartao>
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
          <p className="text-[15px]">{o.desfecho}</p>
        </Cartao>
      )}

      {/*
        Duas colunas independentes quando o painel tem espaço (não a janela): cada uma empilha os seus cartões, sem
        o buraco que a grade deixava quando um cartão da linha era muito mais alto que o vizinho. Numa coluna só,
        as colunas viram `contents` e o `order` devolve a leitura natural: IA, respostas, local, quem atende…
      */}
      <div className="flex flex-col gap-6 @2xl:flex-row @2xl:items-start">
        <div className="contents @2xl:flex @2xl:min-w-0 @2xl:flex-1 @2xl:flex-col @2xl:gap-6">
          <Cartao
            className="order-1 @2xl:order-none"
            tom="border-ia-noite/40"
            titulo={
              <span className="flex items-center gap-2 text-ia-noite">
                <Faisca className="size-3.5" /> Análise da IA · Qwen local
              </span>
            }
          >
            <div className="space-y-3.5">
              {o.iaStatus === 'pendente' && (
                <p className="flex items-center gap-2 text-sm text-ia-noite">
                  <span className="size-4 animate-spin rounded-full border-2 border-noite-borda border-t-ia-noite" /> Analisando relato e foto…
                </p>
              )}
              {(o.resumoIa || o.analiseFotoIa || trocas.length > 0) && (
                <Revelar demo={demo} ia rotulo="Mostrar análise da IA · oculta no modo demo">
                  <div className="space-y-3.5">
                    {o.resumoIa && <p className="text-lg leading-snug">{o.resumoIa}</p>}
                    {o.analiseFotoIa && (
                      <p className="text-sm leading-relaxed text-claro-2">
                        <b className="font-semibold text-claro">Foto:</b> {o.analiseFotoIa}
                      </p>
                    )}
                    {trocas.length > 0 && (
                      <div className="space-y-2.5 rounded bg-noite-0 px-4 py-3.5">
                        <Rotulo como="p" className="text-[10.5px] text-nevoa">
                          Conversa · {trocas.length} {trocas.length === 1 ? 'pergunta de volta' : 'perguntas de volta'}
                        </Rotulo>
                        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-sm leading-snug">
                          {trocas.map((t, i) => (
                            <div key={i} className="contents">
                              <dt className="pt-0.5 font-mono text-[11px] text-ia-noite">CENTRAL</dt>
                              <dd>{t.pergunta}</dd>
                              <dt className="pt-0.5 font-mono text-[11px] text-nevoa">CIDADÃO</dt>
                              <dd className="mb-1">“{t.resposta}”</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                </Revelar>
              )}
              {!o.resumoIa && !o.analiseFotoIa && trocas.length === 0 && o.iaStatus !== 'pendente' && (
                <p className="text-sm text-nevoa">
                  {o.iaStatus === 'erro' ? 'A IA não conseguiu analisar agora. O relato original está ao lado.' : 'Sem relato livre nem foto para analisar.'}
                </p>
              )}
              {o.sugestaoIa && (
                <p className="flex items-start gap-2 border-t border-noite-linha pt-3 text-[13.5px] leading-snug text-claro-2">
                  {divergencias.length === 0 ? (
                    <>
                      <Check className="mt-px size-4 text-claro" />O cidadão confirmou a interpretação da IA.
                    </>
                  ) : (
                    <>
                      <Lapis className="mt-px size-4 text-claro" />
                      <span>
                        <b className="font-semibold text-claro">O cidadão corrigiu a IA em: {divergencias.map((k) => ROTULO_PERGUNTA[k]).join(', ')}.</b>
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          </Cartao>

          <Cartao className="order-3 @2xl:order-none" titulo="Local">
            {temLocal && (
              <MapContainer
                center={[o.lat!, o.lng!]}
                zoom={16}
                className="mapa-noite h-56 w-full rounded"
                attributionControl={false}
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
                <AttributionControl prefix={false} />
                <RotuloMapa rotulo="Mapa com o local da ocorrência e o raio de 200 metros usado para achar ocorrências anteriores." />
                {/* O mesmo raio de `relacionadas()` na API: o que está dentro do círculo conta como reincidência. */}
                <Circle center={[o.lat!, o.lng!]} radius={200} pathOptions={{ color: '#8fa3b3', weight: 1, dashArray: '3 4', fillColor: '#8fa3b3', fillOpacity: 0.06 }} />
                <CircleMarker center={[o.lat!, o.lng!]} radius={10} pathOptions={{ color: '#08131b', weight: 2.5, fillColor: PRIORIDADES[o.prioridade].cor, fillOpacity: 1 }} />
              </MapContainer>
            )}
            <div className={`flex flex-wrap justify-between gap-x-3 gap-y-1 text-[15px] ${temLocal ? 'mt-3' : ''}`}>
              {o.endereco ? (
                <Revelar demo={demo} rotulo="Mostrar endereço · oculto no modo demo">
                  <span>{o.endereco}</span>
                </Revelar>
              ) : (
                <span className="text-nevoa">{temLocal ? 'Sem referência escrita' : 'Sem local informado'}</span>
              )}
              {temLocal && (
                <span className="font-mono text-xs text-nevoa">
                  {o.lat!.toFixed(4).replace('.', ',')} · {o.lng!.toFixed(4).replace('.', ',')}
                </span>
              )}
            </div>
            {temLocal && (
              <p className="mt-1.5 font-mono text-[11.5px] text-nevoa">
                {o.relacionadas.length
                  ? `${o.relacionadas.length} ${o.relacionadas.length === 1 ? 'ocorrência anterior' : 'ocorrências anteriores'} dentro do raio de 200 m`
                  : 'Nenhuma ocorrência a 200 m nos últimos 90 dias'}
              </p>
            )}
          </Cartao>

          {o.prioridade <= 2 && (
            <Cartao className="order-5 @2xl:order-none" titulo="Briefing para quem vai atender">
              <Revelar demo={demo} rotulo="Mostrar briefing · oculto no modo demo">
                <Briefing o={o} />
              </Revelar>
            </Cartao>
          )}

        </div>
        <div className="contents @2xl:flex @2xl:min-w-0 @2xl:flex-1 @2xl:flex-col @2xl:gap-6">
          <div className="order-2 space-y-6 @2xl:order-none">
            <Cartao titulo="Respostas da triagem · confirmadas pelo cidadão">
              <dl className="divide-y divide-noite-linha">
                {Object.entries(o.respostas).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 py-2 text-[14.5px]">
                    <dt className="text-nevoa">{ROTULO_PERGUNTA[k] ?? k}</dt>
                    <dd className="font-medium">{rotuloResposta(k, v)}</dd>
                  </div>
                ))}
              </dl>
            </Cartao>

            {(relato || o.fotos.length > 0) && (
              <Cartao titulo={relato && o.fotos.length ? 'Relato e foto do cidadão' : relato ? 'Relato do cidadão' : 'Foto do cidadão'}>
                <div className="space-y-3">
                  {relato && (
                    <Revelar demo={demo} rotulo="Mostrar relato · oculto no modo demo">
                      <p className="font-display text-[26px] leading-[1.1] font-semibold whitespace-pre-wrap">“{relato}”</p>
                    </Revelar>
                  )}
                  {o.fotos.length > 0 && (
                    <Revelar demo={demo} rotulo={o.fotos.length === 1 ? 'Mostrar foto · oculta no modo demo' : 'Mostrar fotos · ocultas no modo demo'}>
                      <div className="flex gap-2 overflow-x-auto">
                        {o.fotos.map((f) => (
                          <a key={f} href={f} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={f} alt="Foto enviada pelo cidadão" width={640} height={480} loading="lazy" className="h-36 w-auto rounded object-cover" />
                          </a>
                        ))}
                      </div>
                    </Revelar>
                  )}
                </div>
              </Cartao>
            )}
          </div>

          {o.frentes.length > 0 && (
            <Cartao className="order-4 @2xl:order-none" titulo="Quem pode atender">
              <div className="space-y-5">
                {o.frentes.map((f) => (
                  <FrenteAtendimento key={f.id} f={f} />
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] text-nevoa">Por competência, depois distância em linha reta · cadastro de demonstração</p>
            </Cartao>
          )}

          <div className="order-6 space-y-6 @2xl:order-none">
            <Cartao titulo="Encaminhamento">
              <ul className="divide-y divide-noite-linha">
                {o.servicos.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.nome}</p>
                      <p className="text-[13px] text-nevoa">{s.orgao}</p>
                    </div>
                    <BotaoLigar servico={s} noite />
                  </li>
                ))}
              </ul>
            </Cartao>

            <Cartao titulo="Linha do tempo">
              {/* Mais recente em cima: é o que o operador precisa ler primeiro. */}
              <ol>
                {[...o.eventos].reverse().map((e, i, lista) => (
                  <li key={e.id} className="grid grid-cols-[48px_14px_minmax(0,1fr)] gap-2.5">
                    <span className="pt-px font-mono text-xs text-nevoa">{hora(e.criadoEm)}</span>
                    <div className="flex flex-col items-center">
                      <span className={`mt-1 size-[9px] rounded-full border-[1.5px] border-claro ${i === 0 ? 'bg-claro' : 'bg-noite-1'}`} />
                      {i < lista.length - 1 && <span className="w-px flex-1 bg-noite-borda" />}
                    </div>
                    <div className="flex flex-col gap-0.5 pb-3.5">
                      <p className="text-[14.5px] leading-snug">{e.texto}</p>
                      <p className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-nevoa">
                        {e.autor} ·{' '}
                        {e.visivelCidadao ? (
                          <>
                            <Olho className="size-3" /> visível ao cidadão
                          </>
                        ) : (
                          <>
                            <Cadeado className="size-3" /> interno
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Cartao>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[11px] tracking-[0.12em] text-nevoa uppercase">{rotulo}</dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  )
}

const ALTURA_DEGRAU: Record<Prioridade, string> = { 4: 'h-[22px]', 3: 'h-[34px]', 2: 'h-[46px]', 1: 'h-[58px]' }

/**
 * Por que esta prioridade: a escada P4 → P1 com o degrau do caso aceso, e os motivos que as regras registraram.
 * Tudo vem das regras (packages/triagem) — a IA não entra aqui.
 */
function EscadaPrioridade({ p, motivos }: { p: Prioridade; motivos: string[] }) {
  return (
    <section aria-labelledby="porque" className="flex shrink-0 flex-col gap-3.5 @4xl:w-[380px] @4xl:pr-14">
      <Rotulo como="h3" id="porque">
        Por que P{p} · escada de prioridade
      </Rotulo>
      <ol aria-label="Escada de prioridade" className="grid grid-cols-4 items-end gap-1.5">
        {([4, 3, 2, 1] as const).map((n) => {
          const este = n === p
          const cor = PRIORIDADES[n].cor
          return (
            <li key={n} aria-current={este ? 'true' : undefined} className="flex flex-col gap-1.5">
              <span
                className={`flex items-end rounded-[2px] px-1.5 pb-1.5 font-mono text-[10px] font-semibold tracking-[0.04em] whitespace-nowrap text-tinta ${ALTURA_DEGRAU[n]}`}
                style={este ? { backgroundColor: cor } : { border: `1px solid ${cor}` }}
              >
                {este ? 'ESTE CASO' : ''}
              </span>
              <span className={`font-display text-lg leading-none ${este ? 'font-extrabold' : 'font-bold text-nevoa'}`} style={este ? { color: cor } : undefined}>
                P{n} {PRIORIDADES[n].rotulo}
              </span>
              <span className={`font-mono text-[10.5px] ${este ? 'text-claro' : 'text-nevoa'}`}>{PRIORIDADES[n].curto}</span>
            </li>
          )
        })}
      </ol>
      {motivos.length > 0 && (
        <ol className="border-t border-noite-linha">
          {motivos.map((m, i) => (
            <li key={m} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2 border-b border-noite-linha py-2 text-sm">
              <span className="pt-px font-mono text-[11px]" style={{ color: PRIORIDADES[p].cor }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {m}
            </li>
          ))}
        </ol>
      )}
      <p className="font-mono text-[11px] text-nevoa">Regras explicáveis · a IA não define prioridade</p>
    </section>
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
  const campo = 'h-11 rounded border border-noite-borda bg-noite-0 px-3 text-[15px] text-claro placeholder:text-nevoa'
  const secundario = 'min-h-10 rounded border border-noite-borda px-3.5 text-sm hover:bg-noite-2 disabled:opacity-40'
  const primario = 'h-11 rounded bg-claro px-5 text-[15px] font-bold text-tinta disabled:opacity-40'

  return (
    <Cartao titulo="Ações">
      <div className="space-y-5">
        {/* grid-cols-1 explícito: sem ele a coluna cresce até o nome mais longo do select e vaza do cartão no celular. */}
        <div className="grid grid-cols-1 gap-5 @xl:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="responsavel" className="text-sm font-semibold">
              Responsável
            </label>
            <select
              id="responsavel"
              value={o.responsavelId ?? ''}
              disabled={props.ocupado}
              onChange={(e) => e.target.value && props.onAcao({ acao: 'atribuir', responsavelId: e.target.value })}
              className={`max-w-full ${campo}`}
            >
              <option value="">Atribuir a…</option>
              {props.servidores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} — {s.setor}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span id="rotulo-status" className="text-sm font-semibold">
              Status
            </span>
            <div role="group" aria-labelledby="rotulo-status" className="flex gap-2">
              {(['em_atendimento', 'encaminhada'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={o.status === s}
                  disabled={props.ocupado || o.status === s}
                  onClick={() => props.onAcao({ acao: 'status', status: s })}
                  className={`h-11 flex-1 rounded border text-[15px] ${
                    o.status === s ? 'border-claro bg-claro font-semibold text-tinta' : 'border-noite-borda hover:bg-noite-2 disabled:opacity-40'
                  }`}
                >
                  {STATUS[s].rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="providencia" className="text-sm font-semibold">
            Registrar providência
          </label>
          <div className="flex gap-2">
            <input
              id="providencia"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Equipe a caminho. Plantão veterinário avisado."
              className={`min-w-0 flex-1 ${campo}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && texto.trim().length > 1) registrar()
              }}
            />
            <button type="button" disabled={props.ocupado || texto.trim().length < 2} onClick={registrar} className={primario}>
              Registrar
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1">
            <label className="flex min-h-8 items-center gap-2 text-sm text-claro-2">
              <input type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} className="size-[18px] accent-claro" /> Visível para o
              cidadão
            </label>
            {props.registrado && (
              <span role="status" className="animar-entrada flex items-center gap-1.5 text-sm font-semibold">
                <Check className="size-4 text-p4" />
                {props.registrado.visivel ? 'Registrado · aparece no celular do cidadão em até 5 s' : 'Registrado como nota interna'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-noite-linha pt-4">
          <button type="button" aria-expanded={modo === 'reclassificar'} onClick={() => setModo(modo === 'reclassificar' ? 'nenhum' : 'reclassificar')} className={secundario}>
            Reclassificar prioridade
          </button>
          <button type="button" aria-expanded={modo === 'encerrar'} onClick={() => setModo(modo === 'encerrar' ? 'nenhum' : 'encerrar')} className={secundario}>
            Encerrar ocorrência
          </button>
        </div>

        {modo === 'reclassificar' && (
          <div className="flex flex-wrap items-center gap-2 rounded bg-noite-0 p-3">
            <select value={novaP} onChange={(e) => setNovaP(Number(e.target.value) as Prioridade)} aria-label="Nova prioridade" className={campo}>
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
              className={`min-w-0 flex-1 ${campo}`}
            />
            <button
              type="button"
              disabled={props.ocupado || justificativa.trim().length < 3 || novaP === o.prioridade}
              onClick={() => {
                props.onAcao({ acao: 'reclassificar', prioridade: novaP, justificativa: justificativa.trim() })
                setModo('nenhum')
                setJustificativa('')
              }}
              className={primario}
            >
              Salvar
            </button>
          </div>
        )}

        {modo === 'encerrar' && (
          <div className="space-y-2 rounded bg-noite-0 p-3">
            <textarea
              value={desfecho}
              onChange={(e) => setDesfecho(e.target.value)}
              rows={2}
              aria-label="Desfecho da ocorrência"
              placeholder="Ex.: Animal atendido e encaminhado para adoção…"
              className="w-full rounded border border-noite-borda bg-noite-1 px-3 py-2 text-[15px] text-claro placeholder:text-nevoa"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-8 items-center gap-2 text-sm">
                <input type="checkbox" checked={improcedente} onChange={(e) => setImprocedente(e.target.checked)} className="size-[18px] accent-claro" /> Improcedente /
                trote
              </label>
              <button
                type="button"
                disabled={props.ocupado || desfecho.trim().length < 3}
                onClick={() => props.onAcao({ acao: 'encerrar', desfecho: desfecho.trim(), improcedente })}
                className={`ml-auto ${primario}`}
              >
                Encerrar
              </button>
            </div>
          </div>
        )}

        {props.erro && (
          <p role="alert" className="text-sm text-p1">
            {props.erro}
          </p>
        )}
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
    <div className="space-y-2.5">
      {/* Região rolável precisa de foco próprio: sem tabindex, quem usa teclado não consegue ler o resto. */}
      <pre
        tabIndex={0}
        role="region"
        aria-label="Briefing da ocorrência"
        className="max-h-80 overflow-auto rounded bg-noite-0 px-4 py-3.5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-claro-2"
      >
        {texto}
      </pre>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(texto)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2500)
        }}
        className="flex min-h-10 items-center gap-1.5 rounded border border-noite-borda px-3 text-[13px] hover:bg-noite-2"
      >
        {copiado ? <Check className="size-3.5" /> : <Copiar className="size-3.5" />}
        <span role="status">{copiado ? 'Copiado' : 'Copiar briefing'}</span>
      </button>
    </div>
  )
}

/** Uma frente do caso. A da pessoa vem primeiro e marcada: é a que não pode ser lida por último. */
function FrenteAtendimento({ f }: { f: Frente }) {
  const pessoa = f.id === 'pessoa'
  return (
    <section>
      <h4 className={`font-mono text-[11px] font-medium tracking-[0.14em] uppercase ${pessoa ? 'text-p1' : 'text-nevoa'}`}>
        {pessoa && <span aria-hidden="true">▲ </span>}
        {f.rotulo}
      </h4>
      <ol className="divide-y divide-noite-linha">
        {f.opcoes.map((p, i) => (
          <li key={p.id}>
            <LinhaProfissional p={p} n={i + 1} />
          </li>
        ))}
      </ol>
    </section>
  )
}

/** 1,2 km acima de 1 km; 840 m abaixo. Em metro cheio: ninguém precisa de 843 m. */
function distancia(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10} m`
}

/** Uma opção de atendimento: quem é, o que cobre, a que distância e como acionar. */
function LinhaProfissional({ p, n }: { p: Profissional; n: number }) {
  return (
    <div className="grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 py-3">
      <span aria-hidden="true" className="font-display text-2xl leading-none font-extrabold text-cinza">
        {String(n).padStart(2, '0')}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{p.nome}</span>
          {p.atende24h && <span className="rounded-[2px] bg-claro px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.08em] text-tinta">24H</span>}
          <span className="ml-auto shrink-0 font-mono text-[13px]">{distancia(p.distancia)}</span>
        </div>
        <p className="text-[13.5px] text-nevoa">
          {p.orgao}
          {p.observacao && ` · ${p.observacao}`}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {p.atendidas.map((c) => (
            <span key={c} className="rounded-full border border-noite-borda px-2 py-0.5 text-xs text-claro-2">
              {CAPACIDADES[c]}
            </span>
          ))}
          {/* Cobre parte do que o caso exige: o operador precisa saber antes de ligar. */}
          {!p.cobreTudo && <span className="rounded-full border border-p3 px-2 py-0.5 text-xs text-p3">cobre em parte</span>}
          <span className="ml-auto">
            <BotaoLigar servico={{ id: p.id, nome: p.nome, orgao: p.orgao, telefone: p.telefone }} noite />
          </span>
        </div>
      </div>
    </div>
  )
}

/** Modo demo: o que a plateia escreveu ou fotografou só vai para o telão depois de um clique do operador. */
function Revelar({ demo, rotulo, ia = false, children }: { demo: boolean; rotulo: string; ia?: boolean; children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  if (!demo || aberto) return <>{children}</>
  return (
    <button
      type="button"
      onClick={() => setAberto(true)}
      className={`min-h-10 rounded border border-dashed px-3.5 text-left text-sm ${ia ? 'border-ia-noite text-ia-noite' : 'border-nevoa text-claro'}`}
    >
      {rotulo}
    </button>
  )
}
