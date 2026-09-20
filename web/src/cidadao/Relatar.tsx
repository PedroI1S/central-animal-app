import { aplicarVivo, detectarSinais, PERGUNTAS, podarRespostas, proximaPergunta, type Pergunta, type Respostas, type Vivo } from '@ca/triagem'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, comPrazo } from '../api'
import { FOCO_AUTOMATICO, Pata, rotuloResposta } from '../ui'
import MapaPino from './MapaPino'
import { salvarProtocolo } from './meusProtocolos'
import { reduzirFoto } from './reduzirFoto'

type Etapa =
  | 'pessoa'
  | 'relato'
  | 'interpretando'
  | 'esclarecer'
  | 'pessoa_de_novo'
  | 'vivo'
  | 'confirmar'
  | 'corrigir'
  | 'perguntas'
  | 'local'
  | 'foto'
  | 'contato'
  | 'enviando'
type Mensagem = { id: number; de: 'bot' | 'eu'; texto: string; alerta?: boolean }

/** O que a Central perguntou na conversa com a IA e o que o cidadão respondeu. */
type Troca = { pergunta: string; resposta: string }

type RespostaIa = {
  ok: boolean
  sugestao: Respostas | null
  sinaisEscritos?: string[]
  sinaisDaIa?: string[]
  pessoaCitada?: boolean
  vivoIncerto?: boolean
  pergunta?: { texto: string; opcoes: string[] } | null
}

/** Onde a conversa com a IA está: o que já foi perguntado, quantas rodadas livres restam, o que o cidadão já disse. */
type Contexto = { trocas: Troca[]; rodadas: number; pessoaVista: boolean; pessoaEmRisco: boolean; vivo: Vivo | null }

// A IA pode perguntar de volta (ou receber uma correção) até duas vezes; depois, os botões resolvem.
const MAX_RODADAS = 2
const PERGUNTA_CORRIGIR = 'O que não está certo? Me conte com suas palavras.'
const PERGUNTA_PESSOA = 'Você falou de uma pessoa. Alguém está ferido ou em risco agora?'
const PERGUNTA_VIVO = 'O animal ainda está vivo?'
const OPCOES_VIVO: { valor: Vivo; rotulo: string }[] = [
  { valor: 'sim', rotulo: 'Sim, está vivo' },
  { valor: 'nao', rotulo: 'Não, já morreu' },
  { valor: 'nao_sei', rotulo: 'Não sei' },
]
const CONTEXTO_INICIAL: Contexto = { trocas: [], rodadas: 0, pessoaVista: false, pessoaEmRisco: false, vivo: null }

const ROTULO_CURTO: Record<string, string> = {
  tipo_animal: 'Animal',
  situacao: 'Situação',
  situacao_silvestre: 'Onde está',
  sinais: 'Sinais',
  maus_tratos_agora: 'Acontecendo agora',
  abandono_filhotes: 'Filhotes',
  outros_animais: 'Outros animais afetados',
}

let proximoId = 0

export default function Relatar() {
  const navegar = useNavigate()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [etapa, setEtapa] = useState<Etapa>('pessoa')
  const [respostas, setRespostas] = useState<Respostas>({})
  const [relato, setRelato] = useState('')
  const [sugestao, setSugestao] = useState<Respostas | null>(null)
  // Conversa com a IA: última interpretação, onde estamos, e como a pergunta de sinais deve vir.
  const [ia, setIa] = useState<RespostaIa | null>(null)
  const [ctx, setCtx] = useState<Contexto>(CONTEXTO_INICIAL)
  const [sinaisMarcados, setSinaisMarcados] = useState<string[]>([])
  const [sinaisDaIa, setSinaisDaIa] = useState<string[]>([])
  const [pos, setPos] = useState<[number, number] | null>(null)
  const [endereco, setEndereco] = useState('')
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)

  const falar = (de: Mensagem['de'], texto: string, alerta = false) =>
    setMensagens((m) => [...m, { id: proximoId++, de, texto, alerta }])

  useEffect(() => {
    setMensagens([
      { id: proximoId++, de: 'bot', texto: 'Olá! Sou a Central Animal de Pato Branco. Vou te ajudar a encaminhar essa ocorrência. 🐾' },
      { id: proximoId++, de: 'bot', texto: PERGUNTAS.pessoa_risco.texto },
    ])
  }, [])

  useEffect(() => {
    // Rolagem suave é animação: quem pediu menos movimento salta direto para o fim.
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fim.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'end' })
  }, [mensagens, etapa])

  /** Segue para a próxima pergunta adaptativa, ou para a localização quando a triagem terminou. */
  function avancar(r: Respostas) {
    setRespostas(r)
    const q = proximaPergunta(r)
    if (q) {
      falar('bot', q.texto)
      setEtapa('perguntas')
    } else {
      falar('bot', 'Entendi. Agora, onde está o animal?')
      setEtapa('local')
    }
  }

  function responderPessoa(valor: string) {
    const r = { pessoa_risco: valor }
    setRespostas(r)
    falar('eu', valor === 'sim' ? 'Sim, há pessoa em risco' : 'Não')
    if (valor === 'sim') alertaPessoa()
    falar('bot', 'Conte, com suas palavras, o que está acontecendo com o animal.')
    setEtapa('relato')
  }

  const alertaPessoa = () =>
    falar('bot', '🚨 Ligue AGORA para o 192 (SAMU) ou 193 (Bombeiros). Enquanto isso, continuamos o registro do animal.', true)

  /** Só o que o cidadão escreveu — as perguntas da Central não entram ("Ele está sangrando?" não é sangramento). */
  const textoDoCidadao = (trocas: Troca[]) => [relato, ...trocas.map((t) => t.resposta)].join('. ')

  async function interpretar(c: Contexto) {
    setEtapa('interpretando')
    try {
      const r = await api<RespostaIa>('/api/triagem/interpretar', {
        method: 'POST',
        body: JSON.stringify({ texto: relato.trim(), conversa: c.trocas, perguntar: podePerguntar(c) }),
        signal: comPrazo(60_000),
      })
      if (r.ok && r.sugestao && Object.keys(r.sugestao).length > 0) {
        setIa(r)
        continuar(r, c)
        return
      }
    } catch {
      /* IA indisponível ou lenta: segue pelas perguntas */
    }
    irParaBotoes('Vou te fazer algumas perguntas rápidas.', c)
  }

  /**
   * Depois de cada interpretação, na ordem: pessoa citada no relato (a resposta é sempre do cidadão) →
   * "o animal ainda está vivo?" → pergunta de esclarecimento da IA → cartão para o cidadão confirmar.
   */
  function continuar(r: RespostaIa, c: Contexto) {
    setCtx(c)
    if (r.pessoaCitada && respostas.pessoa_risco !== 'sim' && !c.pessoaVista) {
      falar('bot', PERGUNTA_PESSOA)
      setEtapa('pessoa_de_novo')
    } else if (r.vivoIncerto && !c.vivo) {
      falar('bot', PERGUNTA_VIVO)
      setEtapa('vivo')
    } else if (r.pergunta && podePerguntar(c)) {
      falar('bot', r.pergunta.texto)
      setEtapa('esclarecer')
    } else {
      const morto = c.vivo === 'nao'
      setSugestao(c.vivo ? aplicarVivo(r.sugestao!, c.vivo) : r.sugestao)
      setSinaisMarcados(morto ? [] : (r.sinaisEscritos ?? []))
      setSinaisDaIa(morto ? [] : (r.sinaisDaIa ?? []))
      falar('bot', 'Entendi assim. Está certo?')
      setEtapa('confirmar')
    }
  }

  /**
   * A IA só pergunta de volta enquanto houver rodada livre — e nunca com pessoa em risco: aí o caso já é crítico
   * pela rota humana, qualquer que seja a categoria, e o cidadão deveria estar ligando para o 192, não respondendo.
   */
  const podePerguntar = (c: Contexto) => c.rodadas < MAX_RODADAS && !c.pessoaEmRisco

  /** Sem a IA (ou recusada), a árvore de botões — com a pergunta de sinais já marcada pelo que o cidadão escreveu. */
  function irParaBotoes(mensagem: string, c: Contexto = ctx) {
    falar('bot', mensagem)
    setSinaisMarcados(detectarSinais(textoDoCidadao(c.trocas)))
    setSinaisDaIa([])
    avancar(respostas)
  }

  function enviarRelato() {
    const texto = relato.trim()
    if (texto.length < 3) return
    falar('eu', texto)
    void interpretar({ ...CONTEXTO_INICIAL, pessoaEmRisco: respostas.pessoa_risco === 'sim' })
  }

  function pularRelato() {
    falar('eu', 'Prefiro responder com botões')
    irParaBotoes('Tudo bem, vamos pelas perguntas.')
  }

  function responderPessoaDeNovo(valor: string) {
    const rotulo = valor === 'sim' ? 'Sim, há pessoa em risco' : 'Não'
    falar('eu', rotulo)
    if (valor === 'sim') {
      setRespostas((r) => ({ ...r, pessoa_risco: 'sim' }))
      alertaPessoa()
    }
    continuar(ia!, {
      ...ctx,
      pessoaVista: true,
      pessoaEmRisco: ctx.pessoaEmRisco || valor === 'sim',
      trocas: [...ctx.trocas, { pergunta: PERGUNTA_PESSOA, resposta: rotulo }],
    })
  }

  function responderVivo(v: Vivo) {
    const rotulo = OPCOES_VIVO.find((o) => o.valor === v)!.rotulo
    falar('eu', rotulo)
    continuar(ia!, { ...ctx, vivo: v, trocas: [...ctx.trocas, { pergunta: PERGUNTA_VIVO, resposta: rotulo }] })
  }

  /** Resposta a uma pergunta da IA ou a "o que não está certo?": volta para a IA com a conversa inteira. */
  function responderIa(pergunta: string, resposta: string) {
    falar('eu', resposta)
    void interpretar({ ...ctx, rodadas: ctx.rodadas + 1, trocas: [...ctx.trocas, { pergunta, resposta }] })
  }

  function confirmarSugestao(certo: boolean) {
    if (certo) {
      falar('eu', '✓ Está certo')
      avancar(podarRespostas({ ...sugestao, ...respostas }))
    } else if (ctx.rodadas < MAX_RODADAS) {
      falar('eu', 'Quero corrigir')
      falar('bot', PERGUNTA_CORRIGIR)
      setEtapa('corrigir')
    } else {
      falar('eu', 'Quero corrigir')
      irParaBotoes('Sem problemas, vamos pelas perguntas.')
    }
  }

  function responder(q: Pergunta, valor: string | string[]) {
    falar('eu', rotuloResposta(q.id, valor))
    avancar(podarRespostas({ ...respostas, [q.id]: valor }))
  }

  function confirmarLocal() {
    falar('eu', [pos ? '📍 Localização marcada no mapa' : null, endereco.trim() || null].filter(Boolean).join(' · '))
    falar('bot', 'Quer enviar uma foto? Ela ajuda a equipe a entender a gravidade.')
    setEtapa('foto')
  }

  function confirmarFoto(enviar: boolean) {
    if (!enviar) setFoto(null)
    falar('eu', enviar ? '📷 Foto anexada' : 'Sem foto')
    falar('bot', 'Por último: quer receber retorno sobre o atendimento?')
    setEtapa('contato')
  }

  async function enviar(anonimo: boolean, nome = '', tel = '') {
    setEtapa('enviando')
    setErro(null)
    // A equipe vê o relato com a conversa: o que a Central perguntou e o que o cidadão respondeu.
    const conversaTexto = ctx.trocas.map((t) => `— Central: ${t.pergunta}\n— Cidadão: ${t.resposta}`)
    const dados = {
      respostas,
      sugestaoIa: sugestao,
      relato: relato.trim() ? [relato.trim(), ...conversaTexto].join('\n\n') : null,
      lat: pos?.[0] ?? null,
      lng: pos?.[1] ?? null,
      endereco: endereco.trim() || null,
      anonimo,
      contatoNome: anonimo ? null : nome,
      contatoTel: anonimo ? null : tel,
    }
    const form = new FormData()
    form.append('dados', JSON.stringify(dados))
    if (foto) form.append('foto', foto.blob, 'foto.jpg')
    try {
      const { protocolo } = await api<{ protocolo: string }>('/api/ocorrencias', { method: 'POST', body: form })
      salvarProtocolo(protocolo)
      navegar(`/acompanhar/${protocolo}?novo=1`, { replace: true })
    } catch (e) {
      setErro((e as Error).message)
      setEtapa('contato')
    }
  }

  const pergunta = etapa === 'perguntas' ? proximaPergunta(respostas) : null

  return (
    <main className="mx-auto flex h-full max-w-md flex-col bg-slate-50">
      <header className="flex items-center gap-3 bg-marca-700 px-4 py-3 text-white shadow">
        <Link to="/" className="text-2xl leading-none" aria-label="Voltar">
          ‹
        </Link>
        <div className="grid size-9 place-items-center rounded-full bg-white/15">
          <Pata className="size-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold">Central Animal</h1>
          <div className="text-xs text-marca-100">{etapa === 'interpretando' ? 'analisando seu relato…' : 'online'}</div>
        </div>
      </header>

      {/* role="log" + aria-live: sem isso o leitor de tela nunca anuncia as perguntas da Central. */}
      <div role="log" aria-live="polite" aria-label="Conversa com a Central Animal" className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {mensagens.map((m) => (
          <Bolha key={m.id} de={m.de} alerta={m.alerta}>
            {m.texto}
          </Bolha>
        ))}
        {etapa === 'interpretando' && (
          <Bolha de="bot">
            <span className="inline-flex gap-1">
              <Ponto /> <Ponto atraso="150ms" /> <Ponto atraso="300ms" />
            </span>
            <span className="ml-2 text-xs text-slate-500">{ctx.trocas.length ? 'IA analisando sua resposta' : 'IA analisando seu relato'}</span>
          </Bolha>
        )}
        <div ref={fim} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {etapa === 'pessoa' && (
          <Opcoes>
            {PERGUNTAS.pessoa_risco.opcoes.map((o) => (
              <BotaoOpcao key={o.valor} onClick={() => responderPessoa(o.valor)} destaque={o.valor === 'sim'}>
                <span aria-hidden="true">{o.emoji}</span> {o.rotulo}
              </BotaoOpcao>
            ))}
          </Opcoes>
        )}

        {etapa === 'relato' && (
          <div className="space-y-2">
            <textarea
              autoFocus={FOCO_AUTOMATICO}
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              aria-label="Conte o que está acontecendo com o animal"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: atropelaram um cachorro na minha rua, ele está vivo mas sangrando e não consegue levantar…"
              className="w-full resize-none rounded-xl border border-slate-300 p-3 text-base focus:outline-none focus-visible:border-marca-600 focus-visible:ring-2 focus-visible:ring-marca-600"
            />
            <div className="flex gap-2">
              <button onClick={pularRelato} className="rounded-xl px-3 py-3 text-sm text-slate-600">
                Responder com botões
              </button>
              <button
                onClick={enviarRelato}
                disabled={relato.trim().length < 3}
                className="flex-1 rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        {etapa === 'esclarecer' && ia?.pergunta && (
          <ConversaIa
            key={ia.pergunta.texto}
            opcoes={ia.pergunta.opcoes}
            placeholder="Ou escreva com suas palavras…"
            onResponder={(t) => responderIa(ia.pergunta!.texto, t)}
            onBotoes={() => {
              falar('eu', 'Prefiro responder com botões')
              irParaBotoes('Tudo bem, vamos pelas perguntas.')
            }}
          />
        )}

        {etapa === 'corrigir' && (
          <ConversaIa
            opcoes={[]}
            placeholder="Ex.: não foi atropelamento, alguém bateu nele…"
            onResponder={(t) => responderIa(PERGUNTA_CORRIGIR, t)}
            onBotoes={() => {
              falar('eu', 'Prefiro responder com botões')
              irParaBotoes('Sem problemas, vamos pelas perguntas.')
            }}
          />
        )}

        {etapa === 'pessoa_de_novo' && (
          <Opcoes>
            {PERGUNTAS.pessoa_risco.opcoes.map((o) => (
              <BotaoOpcao key={o.valor} onClick={() => responderPessoaDeNovo(o.valor)} destaque={o.valor === 'sim'}>
                <span aria-hidden="true">{o.emoji}</span> {o.rotulo}
              </BotaoOpcao>
            ))}
          </Opcoes>
        )}

        {etapa === 'vivo' && (
          <Opcoes>
            {OPCOES_VIVO.map((o) => (
              <BotaoOpcao key={o.valor} onClick={() => responderVivo(o.valor)}>
                {o.rotulo}
              </BotaoOpcao>
            ))}
          </Opcoes>
        )}

        {etapa === 'confirmar' && sugestao && (
          <div className="space-y-3">
            <div className="rounded-xl border border-marca-100 bg-marca-50 p-3">
              <div className="mb-2 text-xs font-semibold text-marca-700">✨ Interpretado pela IA</div>
              <dl className="space-y-1 text-sm">
                {Object.entries(podarRespostas({ ...sugestao, ...respostas }))
                  .filter(([k]) => k !== 'pessoa_risco')
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="w-28 shrink-0 text-slate-500">{ROTULO_CURTO[k] ?? k}</dt>
                      <dd className="font-medium">{rotuloResposta(k, v)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <div className="flex gap-2">
              <button onClick={() => confirmarSugestao(false)} className="flex-1 rounded-xl border border-slate-300 py-3 font-medium">
                Corrigir
              </button>
              <button onClick={() => confirmarSugestao(true)} className="flex-1 rounded-xl bg-marca-600 py-3 font-semibold text-white">
                ✓ Está certo
              </button>
            </div>
          </div>
        )}

        {pergunta && (
          <Resposta
            key={pergunta.id}
            q={pergunta}
            inicial={pergunta.id === 'sinais' ? sinaisMarcados : []}
            daIa={pergunta.id === 'sinais' ? sinaisDaIa : []}
            onResponder={(v) => responder(pergunta, v)}
          />
        )}

        {etapa === 'local' && <EtapaLocal pos={pos} setPos={setPos} endereco={endereco} setEndereco={setEndereco} onContinuar={confirmarLocal} />}

        {etapa === 'foto' && <EtapaFoto foto={foto} setFoto={setFoto} onConfirmar={confirmarFoto} />}

        {(etapa === 'contato' || etapa === 'enviando') && <EtapaContato enviando={etapa === 'enviando'} erro={erro} onEnviar={enviar} />}
      </div>
    </main>
  )
}

/** Pergunta da IA (ou pedido de correção): botões curtos sugeridos pela IA + resposta livre + saída para os botões. */
function ConversaIa({
  opcoes,
  placeholder,
  onResponder,
  onBotoes,
}: {
  opcoes: string[]
  placeholder: string
  onResponder: (texto: string) => void
  onBotoes: () => void
}) {
  const [texto, setTexto] = useState('')
  // Formulário de verdade: o "Ir"/"Enter" do teclado do celular envia a resposta.
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (texto.trim().length >= 2) onResponder(texto.trim().slice(0, 280))
  }
  return (
    <div className="space-y-2">
      {opcoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <button key={o} onClick={() => onResponder(o)} className="rounded-full border border-marca-600 px-4 py-2 text-sm font-medium text-marca-700 active:scale-[0.98]">
              {o}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={enviar} className="flex gap-2">
        <input
          autoFocus={FOCO_AUTOMATICO && opcoes.length === 0}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={280}
          enterKeyHint="send"
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 p-3 text-base focus:outline-none focus-visible:border-marca-600 focus-visible:ring-2 focus-visible:ring-marca-600"
        />
        <button type="submit" disabled={texto.trim().length < 2} className="rounded-xl bg-marca-600 px-4 font-semibold text-white disabled:opacity-40">
          Enviar
        </button>
      </form>
      <button onClick={onBotoes} className="w-full py-1 text-sm text-slate-500">
        Prefiro responder com botões
      </button>
    </div>
  )
}

function Resposta({
  q,
  inicial,
  daIa,
  onResponder,
}: {
  q: Pergunta
  /** Já vêm marcadas (sinais que o cidadão escreveu). */
  inicial: string[]
  /** Destacadas, mas desmarcadas: só a IA viu — quem marca é o cidadão. */
  daIa: string[]
  onResponder: (v: string | string[]) => void
}) {
  const [marcados, setMarcados] = useState<string[]>(inicial)
  if (q.tipo === 'unica') {
    return (
      <Opcoes>
        {q.opcoes.map((o) => (
          <BotaoOpcao key={o.valor} onClick={() => onResponder(o.valor)}>
            <span aria-hidden="true">{o.emoji}</span> {o.rotulo}
          </BotaoOpcao>
        ))}
      </Opcoes>
    )
  }
  const alternar = (v: string) =>
    setMarcados((m) => (v === 'nenhum' ? ['nenhum'] : m.includes(v) ? m.filter((x) => x !== v) : [...m.filter((x) => x !== 'nenhum'), v]))
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        {inicial.length > 0 && 'Já marquei o que você escreveu. '}
        {daIa.length > 0 ? 'A IA achou que pode haver os sinais com ✨ — marque só se for o caso.' : q.ajuda}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {q.opcoes.map((o) => (
          <button
            key={o.valor}
            onClick={() => alternar(o.valor)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
              marcados.includes(o.valor)
                ? 'border-marca-600 bg-marca-50 font-semibold text-marca-900'
                : daIa.includes(o.valor)
                  ? 'border-dashed border-marca-500 bg-white'
                  : 'border-slate-300'
            }`}
          >
            <span aria-hidden="true">{o.emoji}</span> {o.rotulo}
            {daIa.includes(o.valor) && !marcados.includes(o.valor) && <span title="Sugerido pela IA"> ✨</span>}
          </button>
        ))}
      </div>
      <button
        disabled={marcados.length === 0}
        onClick={() => onResponder(marcados)}
        className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        Continuar
      </button>
    </div>
  )
}

function EtapaLocal(props: {
  pos: [number, number] | null
  setPos: (p: [number, number]) => void
  endereco: string
  setEndereco: (s: string) => void
  onContinuar: () => void
}) {
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  function usarGps() {
    if (!navigator.geolocation) return setAviso('Seu navegador não permite localização. Toque no mapa para marcar.')
    setBuscando(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        props.setPos([p.coords.latitude, p.coords.longitude])
        setBuscando(false)
        setAviso(null)
      },
      () => {
        setBuscando(false)
        setAviso('Não foi possível obter sua localização. Toque no mapa para marcar o local.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="space-y-2">
      <button onClick={usarGps} disabled={buscando} className="w-full rounded-xl border border-marca-600 py-3 font-semibold text-marca-700">
        {buscando ? (
          'Localizando…'
        ) : (
          <>
            <span aria-hidden="true">📍</span> Usar minha localização
          </>
        )}
      </button>
      <MapaPino pos={props.pos} onChange={props.setPos} />
      <p className="text-xs text-slate-500">{aviso ?? 'Toque no mapa ou arraste o pino para ajustar.'}</p>
      <input
        value={props.endereco}
        onChange={(e) => props.setEndereco(e.target.value)}
        aria-label="Endereço ou ponto de referência"
        maxLength={300}
        placeholder="Ex.: Rua XV de Novembro, 123 — perto da praça…"
        className="w-full rounded-xl border border-slate-300 p-3 focus:outline-none focus-visible:border-marca-600 focus-visible:ring-2 focus-visible:ring-marca-600"
      />
      <button
        onClick={props.onContinuar}
        disabled={!props.pos && props.endereco.trim().length < 3}
        aria-describedby="dica-local"
        className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        Continuar
      </button>
      {!props.pos && props.endereco.trim().length < 3 && (
        <p id="dica-local" className="text-center text-xs text-slate-600">
          Marque o local no mapa ou escreva um endereço para continuar.
        </p>
      )}
    </div>
  )
}

function EtapaFoto({
  foto,
  setFoto,
  onConfirmar,
}: {
  foto: { blob: Blob; url: string } | null
  setFoto: (f: { blob: Blob; url: string } | null) => void
  onConfirmar: (enviar: boolean) => void
}) {
  const [processando, setProcessando] = useState(false)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setProcessando(true)
    try {
      const blob = await reduzirFoto(arquivo)
      setFoto({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setFoto(null)
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="space-y-2">
      {foto && <img src={foto.url} alt="Foto anexada" width={640} height={480} className="max-h-48 w-full rounded-xl object-cover" />}
      <label className="block w-full cursor-pointer rounded-xl border border-marca-600 py-3 text-center font-semibold text-marca-700">
        {processando ? (
          'Processando…'
        ) : foto ? (
          'Trocar foto'
        ) : (
          <>
            <span aria-hidden="true">📷</span> Tirar ou escolher foto
          </>
        )}
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => escolher(e.target.files?.[0])} />
      </label>
      <div className="flex gap-2">
        <button onClick={() => onConfirmar(false)} className="flex-1 rounded-xl py-3 text-slate-600">
          Pular
        </button>
        <button
          onClick={() => onConfirmar(true)}
          disabled={!foto}
          className="flex-1 rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
        >
          Enviar foto
        </button>
      </div>
    </div>
  )
}

function EtapaContato({ enviando, erro, onEnviar }: { enviando: boolean; erro: string | null; onEnviar: (anonimo: boolean, nome?: string, tel?: string) => void }) {
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  return (
    <div className="space-y-2">
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Seu nome" autoComplete="name" placeholder="Ex.: Maria Silva" maxLength={120} className="rounded-xl border border-slate-300 p-3" />
        <input value={tel} onChange={(e) => setTel(e.target.value)} aria-label="Telefone para contato" type="tel" autoComplete="tel" placeholder="Ex.: (46) 99999-0000" inputMode="tel" maxLength={40} className="rounded-xl border border-slate-300 p-3" />
      </div>
      <button
        disabled={enviando || !nome.trim() || !tel.trim()}
        aria-describedby="dica-contato"
        onClick={() => onEnviar(false, nome.trim(), tel.trim())}
        className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        Enviar com meu contato
      </button>
      {/* Um botão apagado sem explicação deixa o cidadão travado: diz o que falta. */}
      {(!nome.trim() || !tel.trim()) && (
        <p id="dica-contato" className="text-center text-xs text-slate-600">
          Preencha nome e telefone, ou envie anonimamente.
        </p>
      )}
      <button disabled={enviando} onClick={() => onEnviar(true)} className="w-full rounded-xl border border-slate-300 py-3 font-medium disabled:opacity-40">
        {enviando ? 'Enviando…' : 'Enviar anonimamente'}
      </button>
      <p className="text-center text-[11px] text-slate-500">Seus dados são usados só para o atendimento e nunca são mostrados à pessoa denunciada.</p>
    </div>
  )
}

function Bolha({ de, alerta, children }: { de: 'bot' | 'eu'; alerta?: boolean; children: ReactNode }) {
  return (
    <div className={`animar-entrada flex ${de === 'eu' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug shadow-sm ${
          alerta
            ? 'rounded-bl-sm bg-p1 font-semibold text-white'
            : de === 'eu'
              ? 'rounded-br-sm bg-marca-600 text-white'
              : 'rounded-bl-sm bg-white text-slate-800'
        }`}
      >
        <span className="sr-only">{de === 'eu' ? 'Você: ' : 'Central Animal: '}</span>
        {children}
      </div>
    </div>
  )
}

const Opcoes = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-2">{children}</div>

function BotaoOpcao({ onClick, destaque, children }: { onClick: () => void; destaque?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left font-medium active:scale-[0.98] ${destaque ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-300 bg-white'}`}
    >
      {children}
    </button>
  )
}

const Ponto = ({ atraso = '0ms' }: { atraso?: string }) => (
  <span className="inline-block size-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: atraso }} />
)
