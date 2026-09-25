import {
  aplicarVivo,
  classificar,
  detectarSinais,
  ORIENTACOES_VALIDADAS,
  PERGUNTAS,
  podarRespostas,
  proximaPergunta,
  type Pergunta,
  type Respostas,
  type Vivo,
} from '@ca/triagem'
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, comPrazo } from '../api'
import { Camera, Check, Faisca, Pino, Seta, Voltar } from '../icones'
import { FOCO_AUTOMATICO, rotuloResposta } from '../ui'
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
/**
 * `lista`: a bolha vira título (`texto`) + itens — usada para o "O que fazer agora".
 * `ia`: pergunta que a IA escreveu por estar em dúvida — ganha a borda e o rótulo em anil.
 */
type Mensagem = { id: number; de: 'bot' | 'eu'; texto: string; alerta?: boolean; lista?: string[]; ia?: boolean }

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
  grupo_domestico: 'Que animal',
  grupo_silvestre: 'Que animal',
  situacao: 'Situação',
  situacao_silvestre: 'Onde está',
  sinais: 'Sinais',
  maus_tratos_agora: 'Acontecendo agora',
  abandono_filhotes: 'Filhotes',
  outros_animais: 'Outros animais afetados',
}

// As seis etapas que o cidadão vê no alto. A conversa com a IA (esclarecer, corrigir…) é parte do "relato".
const PASSO: Record<Etapa, { n: number; nome: string }> = {
  pessoa: { n: 1, nome: 'Segurança' },
  relato: { n: 2, nome: 'Relato' },
  interpretando: { n: 2, nome: 'Relato' },
  esclarecer: { n: 2, nome: 'Relato' },
  pessoa_de_novo: { n: 2, nome: 'Relato' },
  vivo: { n: 2, nome: 'Relato' },
  corrigir: { n: 2, nome: 'Relato' },
  confirmar: { n: 3, nome: 'Confirmar' },
  perguntas: { n: 3, nome: 'Perguntas' },
  local: { n: 4, nome: 'Local' },
  foto: { n: 5, nome: 'Foto' },
  contato: { n: 6, nome: 'Contato' },
  enviando: { n: 6, nome: 'Contato' },
}

// Tinta é a mão de quem decide: botão principal e marcação. Borda de campo em #6f8799 (3,8:1 sobre branco).
const PRIMARIO = 'min-h-12 rounded-md bg-tinta px-4 font-semibold text-white disabled:opacity-40'
const SECUNDARIO = 'min-h-12 rounded-md border-[1.5px] border-tinta px-4 font-semibold disabled:opacity-40'
const CAMPO = 'rounded-md border border-cinza bg-white text-base placeholder:text-suave'

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
  const orientacoes = useRef<HTMLDivElement>(null)

  const falar = (de: Mensagem['de'], texto: string, alerta = false, lista?: string[]) =>
    setMensagens((m) => [...m, { id: proximoId++, de, texto, alerta, lista }])
  const falarIa = (texto: string) => setMensagens((m) => [...m, { id: proximoId++, de: 'bot', texto, ia: true }])

  useEffect(() => {
    setMensagens([
      { id: proximoId++, de: 'bot', texto: 'Olá! Sou a Central Animal de Pato Branco. Vou te ajudar a encaminhar essa ocorrência.' },
      { id: proximoId++, de: 'bot', texto: PERGUNTAS.pessoa_risco.texto },
    ])
  }, [])

  useEffect(() => {
    // Rolagem suave é animação: quem pediu menos movimento salta direto para o fim.
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    // Quando as orientações chegam, rola até o começo delas, não até o fim: no celular o mapa da etapa do local
    // deixa pouco espaço para a conversa, e rolar até o fim escondia justamente o título e a primeira orientação.
    if (etapa === 'local' && orientacoes.current) orientacoes.current.scrollIntoView({ behavior, block: 'start' })
    else fim.current?.scrollIntoView({ behavior, block: 'end' })
  }, [mensagens, etapa])

  /** Segue para a próxima pergunta adaptativa, ou para a localização quando a triagem terminou. */
  function avancar(r: Respostas) {
    setRespostas(r)
    const q = proximaPergunta(r)
    if (q) {
      falar('bot', q.texto)
      setEtapa('perguntas')
    } else {
      // As orientações saem aqui, assim que a categoria está fechada — não só na tela do protocolo. Quem está
      // diante de um animal envenenado precisa do "não provoque vômito" agora, não depois de mapa, foto e contato.
      // Mesma função que a API usa ao registrar: o que o chat mostra é o que o protocolo vai mostrar.
      falar('bot', 'O que fazer agora', false, classificar(r).orientacoes)
      falar('bot', 'Agora, onde está o animal?')
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
    falar('bot', 'Ligue agora para o 192 (SAMU) ou 193 (Bombeiros). Enquanto isso, continuamos o registro do animal.', true)

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
      falarIa(r.pergunta.texto)
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
      falar('eu', 'Está certo')
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
    falar('eu', [pos ? 'Localização marcada no mapa' : null, endereco.trim() || null].filter(Boolean).join(' · '))
    falar('bot', 'Quer enviar uma foto? Ela ajuda a equipe a entender a gravidade.')
    setEtapa('foto')
  }

  function confirmarFoto(enviar: boolean) {
    if (!enviar) setFoto(null)
    falar('eu', enviar ? 'Foto anexada' : 'Sem foto')
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

  const passo = PASSO[etapa]

  return (
    <main className="mx-auto flex h-full max-w-md flex-col bg-papel">
      <header className="shrink-0 border-b border-regra pb-2.5">
        <div className="flex h-13 items-center gap-1 pr-4 pl-1">
          <Link to="/" aria-label="Voltar ao início" className="grid size-11 place-items-center">
            <Voltar className="size-[22px]" />
          </Link>
          <h1 className="text-[17px] font-semibold">Nova ocorrência</h1>
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.1em] text-suave uppercase">
            Etapa {passo.n} de 6 · {passo.nome}
          </span>
        </div>
        <div role="img" aria-label={`Etapa ${passo.n} de 6`} className="flex gap-1 px-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-sm ${n <= passo.n ? 'bg-tinta' : 'bg-regra'}`} />
          ))}
        </div>
      </header>

      {/* role="log" + aria-live: sem isso o leitor de tela nunca anuncia as perguntas da Central.
          tabIndex: a conversa rola e não tem nada focável dentro — sem ele, quem usa teclado não volta para ler o começo. */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversa com a Central Animal"
        tabIndex={0}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
      >
        {mensagens.map((m) => (
          <Bolha key={m.id} de={m.de} alerta={m.alerta} ia={m.ia} ref={m.lista ? orientacoes : undefined}>
            {m.lista ? <Orientacoes titulo={m.texto} itens={m.lista} /> : m.texto}
          </Bolha>
        ))}
        {etapa === 'interpretando' && (
          <Bolha de="bot">
            <span className="inline-flex gap-1">
              <Ponto /> <Ponto atraso="150ms" /> <Ponto atraso="300ms" />
            </span>
            <span className="ml-2 text-[13px] text-suave">{ctx.trocas.length ? 'IA analisando sua resposta' : 'IA analisando seu relato'}</span>
          </Bolha>
        )}
        <div ref={fim} />
      </div>

      <div className="shrink-0 border-t border-regra bg-white px-4 pt-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {etapa === 'pessoa' && (
          <Opcoes>
            {PERGUNTAS.pessoa_risco.opcoes.map((o) => (
              <BotaoOpcao key={o.valor} onClick={() => responderPessoa(o.valor)} destaque={o.valor === 'sim'}>
                {o.rotulo}
              </BotaoOpcao>
            ))}
          </Opcoes>
        )}

        {etapa === 'relato' && (
          <div className="space-y-2.5">
            <textarea
              autoFocus={FOCO_AUTOMATICO}
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              aria-label="Conte o que está acontecendo com o animal"
              rows={3}
              maxLength={1000}
              placeholder="Ex.: atropelaram um cachorro na minha rua, ele está vivo mas sangrando e não consegue levantar…"
              className={`w-full resize-none p-3 ${CAMPO}`}
            />
            <div className="flex gap-2">
              <button type="button" onClick={pularRelato} className="min-h-12 px-3 text-sm text-suave underline underline-offset-[3px]">
                Responder com botões
              </button>
              <button type="button" onClick={enviarRelato} disabled={relato.trim().length < 3} className={`flex-1 ${PRIMARIO}`}>
                Enviar
              </button>
            </div>
          </div>
        )}

        {etapa === 'esclarecer' && ia?.pergunta && (
          <ConversaIa
            key={ia.pergunta.texto}
            opcoes={ia.pergunta.opcoes}
            placeholder="Ou responda com suas palavras"
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
                {o.rotulo}
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
            <section aria-label="Interpretação da IA" className="overflow-hidden rounded-lg border border-regra">
              <p className="flex items-center gap-1.5 border-b border-regra px-3.5 py-2 font-mono text-[10.5px] font-medium tracking-[0.12em] text-ia uppercase">
                <Faisca className="size-3" /> Interpretado pela IA
              </p>
              <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 px-3.5 py-2.5 text-[15px]">
                {Object.entries(podarRespostas({ ...sugestao, ...respostas }))
                  .filter(([k]) => k !== 'pessoa_risco')
                  .map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-suave">{ROTULO_CURTO[k] ?? k}</dt>
                      <dd className="font-semibold">{rotuloResposta(k, v)}</dd>
                    </div>
                  ))}
              </dl>
            </section>
            <div className="flex gap-2">
              <button type="button" onClick={() => confirmarSugestao(false)} className={`flex-1 ${SECUNDARIO}`}>
                Corrigir
              </button>
              <button type="button" onClick={() => confirmarSugestao(true)} className={`flex flex-1 items-center justify-center gap-2 ${PRIMARIO}`}>
                <Check className="size-[18px]" /> Está certo
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
    <div className="space-y-2.5">
      {opcoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {opcoes.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onResponder(o)}
              className="min-h-11 rounded-full border-[1.5px] border-tinta px-4 text-[15.5px] font-medium active:scale-[0.98]"
            >
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
          aria-label="Responder com suas palavras"
          placeholder={placeholder}
          className={`h-12 min-w-0 flex-1 px-3.5 ${CAMPO}`}
        />
        <button type="submit" aria-label="Enviar resposta" disabled={texto.trim().length < 2} className="grid size-12 place-items-center rounded-md bg-tinta text-white disabled:opacity-40">
          <Seta className="size-5" />
        </button>
      </form>
      <button type="button" onClick={onBotoes} className="min-h-9 w-full text-sm text-suave underline underline-offset-[3px]">
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
            {o.rotulo}
          </BotaoOpcao>
        ))}
      </Opcoes>
    )
  }
  const alternar = (v: string) =>
    setMarcados((m) => (v === 'nenhum' ? ['nenhum'] : m.includes(v) ? m.filter((x) => x !== v) : [...m.filter((x) => x !== 'nenhum'), v]))
  return (
    <div className="space-y-2.5">
      <p className="text-sm leading-snug text-suave">
        {inicial.length > 0 && 'Já marquei o que você escreveu. '}
        {daIa.length > 0 ? (
          <>
            A IA acha que pode haver o sinal com <Faisca className="inline size-3 align-[-1px] text-ia" rotulo="estrela" /> — marque só se for o caso.
          </>
        ) : (
          q.ajuda
        )}
      </p>
      <div role="group" aria-label={q.texto} className="grid grid-cols-2 gap-2">
        {q.opcoes.map((o) => {
          const marcado = marcados.includes(o.valor)
          const sugerido = daIa.includes(o.valor) && !marcado
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={marcado}
              onClick={() => alternar(o.valor)}
              className={`flex min-h-[54px] items-center gap-2 rounded-md px-3 py-2 text-left text-[14.5px] leading-tight ${
                marcado
                  ? 'border-[1.5px] border-tinta bg-tinta font-semibold text-white'
                  : sugerido
                    ? 'border-[1.5px] border-dashed border-ia bg-white font-medium'
                    : 'border border-cinza bg-white font-medium'
              }`}
            >
              {marcado && <Check className="size-4" />}
              <span className="flex-1">{o.rotulo}</span>
              {sugerido && <Faisca className="size-3.5 text-ia" rotulo="Sugerido pela IA" />}
            </button>
          )
        })}
      </div>
      <button type="button" disabled={marcados.length === 0} onClick={() => onResponder(marcados)} className={`w-full ${PRIMARIO}`}>
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
      <button type="button" onClick={usarGps} disabled={buscando} className={`flex w-full items-center justify-center gap-2 ${SECUNDARIO}`}>
        {buscando ? (
          'Localizando…'
        ) : (
          <>
            <Pino className="size-[18px]" /> Usar minha localização
          </>
        )}
      </button>
      <MapaPino pos={props.pos} onChange={props.setPos} />
      <p className="text-[13px] text-suave">{aviso ?? 'Toque no mapa ou arraste o pino para ajustar.'}</p>
      <input
        value={props.endereco}
        onChange={(e) => props.setEndereco(e.target.value)}
        aria-label="Endereço ou ponto de referência"
        maxLength={300}
        placeholder="Ex.: Rua XV de Novembro, 123 — perto da praça…"
        className={`h-12 w-full px-3.5 ${CAMPO}`}
      />
      <button
        type="button"
        onClick={props.onContinuar}
        disabled={!props.pos && props.endereco.trim().length < 3}
        aria-describedby="dica-local"
        className={`w-full ${PRIMARIO}`}
      >
        Continuar
      </button>
      {!props.pos && props.endereco.trim().length < 3 && (
        <p id="dica-local" className="text-center text-[13px] text-suave">
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
      {foto && <img src={foto.url} alt="Foto anexada" width={640} height={480} className="max-h-48 w-full rounded-md object-cover" />}
      <label className={`flex w-full cursor-pointer items-center justify-center gap-2 ${SECUNDARIO} has-focus-visible:outline-2 has-focus-visible:outline-ia`}>
        {processando ? (
          'Processando…'
        ) : foto ? (
          'Trocar foto'
        ) : (
          <>
            <Camera className="size-[18px]" /> Tirar ou escolher foto
          </>
        )}
        <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onConfirmar(false)} className="min-h-12 flex-1 rounded-md text-suave underline underline-offset-[3px]">
          Pular
        </button>
        <button type="button" onClick={() => onConfirmar(true)} disabled={!foto} className={`flex-1 ${PRIMARIO}`}>
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
      {erro && (
        <p role="alert" className="rounded-md border border-alerta bg-white p-2.5 text-sm text-alerta">
          {erro}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Seu nome" autoComplete="name" placeholder="Ex.: Maria Silva" maxLength={120} className={`h-12 min-w-0 px-3 ${CAMPO}`} />
        <input
          value={tel}
          onChange={(e) => setTel(e.target.value)}
          aria-label="Telefone para contato"
          type="tel"
          autoComplete="tel"
          placeholder="Ex.: (46) 99999-0000"
          inputMode="tel"
          maxLength={40}
          className={`h-12 min-w-0 px-3 ${CAMPO}`}
        />
      </div>
      <button
        type="button"
        disabled={enviando || !nome.trim() || !tel.trim()}
        aria-describedby="dica-contato"
        onClick={() => onEnviar(false, nome.trim(), tel.trim())}
        className={`w-full ${PRIMARIO}`}
      >
        Enviar com meu contato
      </button>
      {/* Um botão apagado sem explicação deixa o cidadão travado: diz o que falta. */}
      {(!nome.trim() || !tel.trim()) && (
        <p id="dica-contato" className="text-center text-[13px] text-suave">
          Preencha nome e telefone, ou envie anonimamente.
        </p>
      )}
      <button type="button" disabled={enviando} onClick={() => onEnviar(true)} className={`w-full ${SECUNDARIO}`}>
        {enviando ? 'Enviando…' : 'Enviar anonimamente'}
      </button>
      <p className="text-center text-xs text-suave">Seus dados são usados só para o atendimento e nunca são mostrados à pessoa denunciada.</p>
    </div>
  )
}

function Bolha({ de, alerta, ia, children, ref }: { de: 'bot' | 'eu'; alerta?: boolean; ia?: boolean; children: ReactNode; ref?: Ref<HTMLDivElement> }) {
  return (
    // scroll-mt: a bolha ainda está 8 px abaixo (animação de entrada) quando a rolagem a leva ao topo.
    <div ref={ref} className={`animar-entrada flex scroll-mt-4 ${de === 'eu' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] px-3.5 py-2.5 text-base leading-snug ${
          alerta
            ? 'rounded-[4px_16px_16px_16px] bg-p1 font-bold text-tinta'
            : de === 'eu'
              ? 'rounded-[16px_4px_16px_16px] bg-tinta text-white'
              : ia
                ? 'mt-1 flex flex-col gap-1.5 rounded-[4px_16px_16px_16px] border-[1.5px] border-ia bg-white text-[17px] font-medium'
                : 'rounded-[4px_16px_16px_16px] border border-regra bg-white'
        }`}
      >
        {ia && (
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-medium tracking-[0.12em] text-ia uppercase">
            <Faisca className="size-3" /> A IA ficou em dúvida
          </span>
        )}
        <span className="sr-only">{de === 'eu' ? 'Você: ' : 'Central Animal: '}</span>
        {ia ? <span>{children}</span> : children}
      </div>
    </div>
  )
}

/** Orientações dentro da bolha: lista de verdade, para o leitor de tela anunciar "lista, 3 itens". */
function Orientacoes({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <>
      <span className="font-semibold">{titulo}</span>
      <ol className="mt-1.5">
        {itens.map((t, i) => (
          <li key={t} className="grid grid-cols-[26px_minmax(0,1fr)] gap-1 border-t border-regra py-1.5 first:border-t-0">
            <span aria-hidden="true" className="pt-0.5 font-mono text-xs font-semibold">
              {String(i + 1).padStart(2, '0')}
            </span>
            {t}
          </li>
        ))}
      </ol>
      {/* suave sobre o branco da bolha: 5,5:1. */}
      {!ORIENTACOES_VALIDADAS && <span className="mt-1.5 block text-xs text-suave">Orientações em validação com médico-veterinário.</span>}
    </>
  )
}

const Opcoes = ({ children }: { children: ReactNode }) => <div className="flex flex-col gap-2">{children}</div>

/** Opção de resposta única. `destaque` é o "Sim, há pessoa em risco": borda e texto em alerta, não só cor de fundo. */
function BotaoOpcao({ onClick, destaque, children }: { onClick: () => void; destaque?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-md bg-white px-4 py-2.5 text-left font-medium active:scale-[0.98] ${
        destaque ? 'border-[1.5px] border-alerta font-semibold text-alerta' : 'border border-cinza'
      }`}
    >
      {children}
    </button>
  )
}

const Ponto = ({ atraso = '0ms' }: { atraso?: string }) => (
  <span className="inline-block size-2 animate-bounce rounded-full bg-suave" style={{ animationDelay: atraso }} />
)
