import { PERGUNTAS, podarRespostas, proximaPergunta, type Pergunta, type Respostas } from '@ca/triagem'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, enviarJson } from '../api'
import { Pata, rotuloResposta } from '../ui'
import MapaPino from './MapaPino'
import { salvarProtocolo } from './meusProtocolos'
import { reduzirFoto } from './reduzirFoto'

type Etapa = 'pessoa' | 'relato' | 'interpretando' | 'confirmar' | 'perguntas' | 'local' | 'foto' | 'contato' | 'enviando'
type Mensagem = { id: number; de: 'bot' | 'eu'; texto: string; alerta?: boolean }

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
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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
    if (valor === 'sim') {
      falar('bot', '🚨 Ligue AGORA para o 192 (SAMU) ou 193 (Bombeiros). Enquanto isso, continuamos o registro do animal.', true)
    }
    falar('bot', 'Conte, com suas palavras, o que está acontecendo com o animal.')
    setEtapa('relato')
  }

  async function enviarRelato() {
    const texto = relato.trim()
    if (texto.length < 3) return
    falar('eu', texto)
    setEtapa('interpretando')
    try {
      const { ok, sugestao: s } = await enviarJson<{ ok: boolean; sugestao: Respostas | null }>('/api/triagem/interpretar', { texto })
      if (ok && s && Object.keys(s).length > 0) {
        setSugestao(s)
        falar('bot', 'Entendi assim. Está certo?')
        setEtapa('confirmar')
        return
      }
    } catch {
      /* IA indisponível: segue pelas perguntas */
    }
    falar('bot', 'Vou te fazer algumas perguntas rápidas.')
    avancar(respostas)
  }

  function pularRelato() {
    falar('eu', 'Prefiro responder com botões')
    avancar(respostas)
  }

  function confirmarSugestao(certo: boolean) {
    if (certo) {
      falar('eu', '✓ Está certo')
      avancar(podarRespostas({ ...sugestao, ...respostas }))
    } else {
      falar('eu', 'Quero corrigir')
      falar('bot', 'Sem problemas, vamos pelas perguntas.')
      avancar(respostas)
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
    const dados = {
      respostas,
      sugestaoIa: sugestao,
      relato: relato.trim() || null,
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
          <div className="font-semibold">Central Animal</div>
          <div className="text-xs text-marca-100">{etapa === 'interpretando' ? 'analisando seu relato…' : 'online'}</div>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
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
            <span className="ml-2 text-xs text-slate-500">IA analisando seu relato</span>
          </Bolha>
        )}
        <div ref={fim} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {etapa === 'pessoa' && (
          <Opcoes>
            {PERGUNTAS.pessoa_risco.opcoes.map((o) => (
              <BotaoOpcao key={o.valor} onClick={() => responderPessoa(o.valor)} destaque={o.valor === 'sim'}>
                {o.emoji} {o.rotulo}
              </BotaoOpcao>
            ))}
          </Opcoes>
        )}

        {etapa === 'relato' && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Ex.: atropelaram um cachorro na minha rua, ele está vivo mas sangrando e não consegue levantar"
              className="w-full resize-none rounded-xl border border-slate-300 p-3 text-base focus:border-marca-500 focus:outline-none"
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

        {pergunta && <Resposta key={pergunta.id} q={pergunta} onResponder={(v) => responder(pergunta, v)} />}

        {etapa === 'local' && <EtapaLocal pos={pos} setPos={setPos} endereco={endereco} setEndereco={setEndereco} onContinuar={confirmarLocal} />}

        {etapa === 'foto' && <EtapaFoto foto={foto} setFoto={setFoto} onConfirmar={confirmarFoto} />}

        {(etapa === 'contato' || etapa === 'enviando') && <EtapaContato enviando={etapa === 'enviando'} erro={erro} onEnviar={enviar} />}
      </div>
    </main>
  )
}

function Resposta({ q, onResponder }: { q: Pergunta; onResponder: (v: string | string[]) => void }) {
  const [marcados, setMarcados] = useState<string[]>([])
  if (q.tipo === 'unica') {
    return (
      <Opcoes>
        {q.opcoes.map((o) => (
          <BotaoOpcao key={o.valor} onClick={() => onResponder(o.valor)}>
            {o.emoji} {o.rotulo}
          </BotaoOpcao>
        ))}
      </Opcoes>
    )
  }
  const alternar = (v: string) =>
    setMarcados((m) => (v === 'nenhum' ? ['nenhum'] : m.includes(v) ? m.filter((x) => x !== v) : [...m.filter((x) => x !== 'nenhum'), v]))
  return (
    <div className="space-y-2">
      {q.ajuda && <p className="text-xs text-slate-500">{q.ajuda}</p>}
      <div className="grid grid-cols-2 gap-2">
        {q.opcoes.map((o) => (
          <button
            key={o.valor}
            onClick={() => alternar(o.valor)}
            className={`rounded-xl border px-3 py-2.5 text-left text-sm ${
              marcados.includes(o.valor) ? 'border-marca-600 bg-marca-50 font-semibold text-marca-900' : 'border-slate-300'
            }`}
          >
            {o.emoji} {o.rotulo}
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
        {buscando ? 'Localizando…' : '📍 Usar minha localização'}
      </button>
      <MapaPino pos={props.pos} onChange={props.setPos} />
      <p className="text-xs text-slate-500">{aviso ?? 'Toque no mapa ou arraste o pino para ajustar.'}</p>
      <input
        value={props.endereco}
        onChange={(e) => props.setEndereco(e.target.value)}
        maxLength={300}
        placeholder="Endereço ou ponto de referência (opcional)"
        className="w-full rounded-xl border border-slate-300 p-3 focus:border-marca-500 focus:outline-none"
      />
      <button
        onClick={props.onContinuar}
        disabled={!props.pos && props.endereco.trim().length < 3}
        className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        Continuar
      </button>
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
      {foto && <img src={foto.url} alt="Foto anexada" className="max-h-48 w-full rounded-xl object-cover" />}
      <label className="block w-full cursor-pointer rounded-xl border border-marca-600 py-3 text-center font-semibold text-marca-700">
        {processando ? 'Processando…' : foto ? 'Trocar foto' : '📷 Tirar ou escolher foto'}
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
      {erro && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" maxLength={120} className="rounded-xl border border-slate-300 p-3" />
        <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Telefone" inputMode="tel" maxLength={40} className="rounded-xl border border-slate-300 p-3" />
      </div>
      <button
        disabled={enviando || !nome.trim() || !tel.trim()}
        onClick={() => onEnviar(false, nome.trim(), tel.trim())}
        className="w-full rounded-xl bg-marca-600 py-3 font-semibold text-white disabled:opacity-40"
      >
        Enviar com meu contato
      </button>
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
