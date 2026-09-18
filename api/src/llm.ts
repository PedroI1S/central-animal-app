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

const PROMPT_EXTRACAO = `Você faz a pré-triagem de ocorrências com animais em Pato Branco (PR). Leia o relato do cidadão e preencha os campos. Regras:
- tipo_animal: "silvestre" para cobra, ave silvestre, gambá, capivara, macaco etc.; "domestico" para cão, gato, cavalo, boi; "nao_sei" se não der para saber.
- situacao (só para doméstico): "atropelamento" se o animal foi atingido por carro, moto ou qualquer veículo — mesmo que esteja ferido; "envenenamento" se há suspeita de veneno ou isca; "maus_tratos" se alguém agride, prende sem água/comida ou maltrata; "abandono" se está sozinho na rua, largado ou perdido; "morto_via" se já está morto na rua; "ferido" para outros ferimentos ou doenças; "outro" se nada se aplica.
- situacao_silvestre (só para silvestre): "ameaca" se está dentro de casa ou perto de pessoas; "ferido" se machucado; "avistado" caso contrário.
- sinais: marque SOMENTE sinais citados explicitamente. "nao_levanta" = não consegue levantar ou andar. "convulsao" = convulsão ou tremores. "vomito" = vômito, baba ou saliva excessiva. "inconsciente" só se o relato disser desmaiado, desacordado ou que não reage. Na dúvida, não marque.
- maus_tratos_agora, abandono_filhotes, outros_animais: "sim" ou "nao" apenas se o relato disser; senão "nao_informado".`

const SCHEMA_EXTRACAO = {
  type: 'object',
  properties: {
    tipo_animal: { enum: ['domestico', 'silvestre', 'nao_sei'] },
    situacao: { enum: ['atropelamento', 'ferido', 'envenenamento', 'maus_tratos', 'abandono', 'morto_via', 'outro', 'nao_se_aplica'] },
    situacao_silvestre: { enum: ['ameaca', 'ferido', 'avistado', 'nao_se_aplica'] },
    sinais: { type: 'array', items: { enum: ['sangramento', 'respiracao', 'inconsciente', 'convulsao', 'nao_levanta', 'vomito'] } },
    maus_tratos_agora: { enum: ['sim', 'nao', 'nao_informado'] },
    abandono_filhotes: { enum: ['sim', 'nao', 'nao_informado'] },
    outros_animais: { enum: ['sim', 'nao', 'nao_informado'] },
  },
  required: ['tipo_animal', 'situacao', 'situacao_silvestre', 'sinais', 'maus_tratos_agora', 'abandono_filhotes', 'outros_animais'],
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
            options: { ...OPCOES, num_predict: 120 },
            messages: [
              { role: 'system', content: PROMPT_EXTRACAO },
              { role: 'user', content: relato.slice(0, 1000) },
            ],
          },
          10_000,
        ),
      true,
    )
    const extraido = JSON.parse(bruto) as Record<string, string | string[]>
    // Descarta campos vazios ou não aplicáveis; o fluxo adaptativo pergunta o que faltar.
    const sugestao: Respostas = {}
    for (const [k, v] of Object.entries(extraido)) {
      if (v === 'nao_se_aplica' || v === 'nao_informado') continue
      sugestao[k] = v
    }
    if (Array.isArray(sugestao.sinais) && sugestao.sinais.length === 0) sugestao.sinais = ['nenhum']
    return sugestao
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
