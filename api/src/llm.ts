import { readFile } from 'node:fs/promises'
import type { Respostas } from '@ca/triagem'

// Qwen local via Ollama. Regra do projeto: a IA SUGERE, o cidadão CONFIRMA, as regras DECIDEM a prioridade.

const OLLAMA = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODELO = process.env.OLLAMA_MODEL ?? 'qwen3.5:9b'
// Contexto fixo: mudar num_ctx entre chamadas força o Ollama a recarregar o modelo (~7 s).
const OPCOES = { temperature: 0, num_ctx: 4096 }

// ---------- Fila: chamadas interativas passam na frente das de segundo plano ----------

type Tarefa = { executar: () => Promise<void>; interativa: boolean }
const fila: Tarefa[] = []
let ocupado = false

function enfileirar<T>(fn: () => Promise<T>, interativa: boolean): Promise<T> {
  return new Promise((resolve, reject) => {
    const tarefa = { interativa, executar: () => fn().then(resolve, reject) }
    if (interativa) {
      const i = fila.findIndex((t) => !t.interativa)
      i === -1 ? fila.push(tarefa) : fila.splice(i, 0, tarefa)
    } else fila.push(tarefa)
    void processar()
  })
}

async function processar() {
  if (ocupado) return
  const tarefa = fila.shift()
  if (!tarefa) return
  ocupado = true
  try {
    await tarefa.executar()
  } finally {
    ocupado = false
    void processar()
  }
}

/** Quantas chamadas interativas estão esperando — acima do limite o chat cai direto para os botões. */
export const interativasNaFila = () => fila.filter((t) => t.interativa).length + (ocupado ? 1 : 0)

async function chat(body: object, timeoutMs: number): Promise<string> {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODELO, stream: false, think: false, keep_alive: -1, options: OPCOES, ...body }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  return ((await res.json()) as { message: { content: string } }).message.content
}

// ---------- 1. Interpretar o relato livre (interativo, o cidadão está esperando) ----------

const PROMPT_EXTRACAO = `Você faz a pré-triagem de ocorrências com animais em Pato Branco (PR). Leia o relato e responda com JSON curto.
caso:
- "atropelamento": animal atingido por carro, moto ou qualquer veículo — mesmo que esteja ferido.
- "envenenamento": suspeita de veneno ou isca.
- "maus_tratos": uma PESSOA agride, prende sem água/comida ou maltrata o animal. Animal preso em telhado, árvore, bueiro ou buraco sem ninguém causando isso NÃO é maus-tratos — use "outro".
- "abandono": animal sozinho na rua, largado ou perdido.
- "morto_via": animal já morto na rua.
- "ferido": outros ferimentos ou doenças.
- "silvestre_perto_de_pessoas" / "silvestre_ferido" / "silvestre_avistado": cobra, ave silvestre, gambá, capivara, macaco etc.
- "outro": nada se aplica.
sinais: SOMENTE sinais citados explicitamente. nao_levanta = não consegue levantar/andar; convulsao = convulsão ou tremores; vomito = vômito, baba ou saliva excessiva; inconsciente só se disser desmaiado/desacordado/não reage. Se nenhum sinal for citado, use []. Responda em uma única linha.`

const SCHEMA_EXTRACAO = {
  type: 'object',
  properties: {
    caso: {
      enum: [
        'atropelamento', 'ferido', 'envenenamento', 'maus_tratos', 'abandono', 'morto_via', 'outro',
        'silvestre_perto_de_pessoas', 'silvestre_ferido', 'silvestre_avistado',
      ],
    },
    sinais: { type: 'array', items: { enum: ['sangramento', 'respiracao', 'inconsciente', 'convulsao', 'nao_levanta', 'vomito'] } },
  },
  required: ['caso', 'sinais'],
}

// Perguntas de um toque (flagrante, filhotes, outros animais) ficam sempre com o cidadão: errar ali custa caro.
type Extracao = { caso: string; sinais: string[] }

const SILVESTRE: Record<string, string> = {
  silvestre_perto_de_pessoas: 'ameaca',
  silvestre_ferido: 'ferido',
  silvestre_avistado: 'avistado',
}

/** Traduz a saída enxuta do modelo para as respostas da árvore. O que não vier fica sem resposta — e o chat pergunta. */
function paraRespostas(e: Extracao): Respostas {
  const r: Respostas = {}
  if (SILVESTRE[e.caso]) {
    r.tipo_animal = 'silvestre'
    r.situacao_silvestre = SILVESTRE[e.caso]
  } else {
    r.tipo_animal = 'domestico'
    r.situacao = e.caso
  }
  if (e.sinais?.length) r.sinais = [...new Set(e.sinais)]
  return r
}

const LIMITE_FILA = 2

/** Converte o relato em respostas sugeridas. Retorna null se a IA estiver lenta ou falhar — o chat segue por botões. */
export async function interpretarRelato(relato: string): Promise<Respostas | null> {
  if (interativasNaFila() >= LIMITE_FILA) return null
  try {
    const bruto = await enfileirar(
      () =>
        chat(
          {
            format: SCHEMA_EXTRACAO,
            options: { ...OPCOES, num_predict: 60 },
            messages: [
              { role: 'system', content: PROMPT_EXTRACAO },
              { role: 'user', content: relato.slice(0, 1000) },
            ],
          },
          10_000,
        ),
      true,
    )
    return paraRespostas(JSON.parse(bruto) as Extracao)
  } catch {
    return null
  }
}

// ---------- 2. Resumo e análise de foto (segundo plano, para o painel) ----------

export function gerarResumo(relato: string, contexto: string): Promise<string> {
  return enfileirar(
    () =>
      chat(
        {
          options: { ...OPCOES, num_predict: 120 },
          messages: [
            {
              role: 'system',
              content:
                'Escreva UMA frase objetiva, em português, resumindo a ocorrência para a equipe que vai atendê-la. Comece direto pelo fato (ex.: "Cão atropelado..."), sem saudação nem vocativo. Inclua o que aconteceu, o estado do animal e o local, se citados. Não invente fatos.',
            },
            { role: 'user', content: `Classificação: ${contexto}\nRelato do cidadão: ${relato.slice(0, 1000)}` },
          ],
        },
        60_000,
      ),
    false,
  ).then((t) => t.trim())
}

export async function analisarFoto(caminho: string): Promise<string> {
  const imagem = (await readFile(caminho)).toString('base64')
  return enfileirar(
    () =>
      chat(
        {
          options: { ...OPCOES, num_predict: 150 },
          messages: [
            {
              role: 'system',
              content:
                'Você apoia a triagem de ocorrências com animais. Descreva objetivamente, em até duas frases em português, o que a foto mostra: espécie e porte do animal, sinais visíveis (ferimentos, sangue, postura) e riscos no ambiente. Não faça diagnóstico. Se não houver animal na foto, diga isso.',
            },
            { role: 'user', content: 'Descreva a foto.', images: [imagem] },
          ],
        },
        90_000,
      ),
    false,
  ).then((t) => t.trim())
}

/** Carrega o modelo na memória quando a API sobe, para a primeira pessoa da plateia não esperar 15 s. */
export async function aquecer(log: (msg: string) => void) {
  try {
    const t = Date.now()
    await chat({ options: { ...OPCOES, num_predict: 1 }, messages: [{ role: 'user', content: 'ok' }] }, 60_000)
    log(`Qwen pronto (${MODELO}, ${Date.now() - t} ms)`)
  } catch (e) {
    log(`Qwen indisponível — a triagem segue só por botões. (${(e as Error).message})`)
  }
}
