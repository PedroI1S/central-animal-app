// Sobe o túnel da Cloudflare e aponta o link fixo (GitHub Pages) para ele.
//   npm run tunnel:publicar     → sobe, publica o destino e mantém rodando
//   Ctrl+C                      → derruba o túnel e marca o link como "desligado"
import { execFileSync, spawn } from 'node:child_process'
import { Resolver } from 'node:dns/promises'
import https from 'node:https'

const REPO = 'PedroI1S/central-animal'
const LINK_FIXO = 'https://pedroi1s.github.io/central-animal/'
const PORTA = process.env.PORT ?? 3000

const log = (m) => console.log(`\x1b[36m[túnel]\x1b[0m ${m}`)
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- 1. A API precisa estar no ar ----------
try {
  const r = await fetch(`http://localhost:${PORTA}/api/health`)
  if (!r.ok) throw new Error()
} catch {
  console.error(`\n❌ A Central Animal não está rodando na porta ${PORTA}. Rode antes, em outro terminal:\n   npm run start\n`)
  process.exit(1)
}

// ---------- 2. Publicar destino no GitHub Pages ----------
function publicar(url) {
  const caminho = `repos/${REPO}/contents/destino.json`
  const sha = execFileSync('gh', ['api', caminho, '--jq', '.sha'], { encoding: 'utf8' }).trim()
  const conteudo = Buffer.from(JSON.stringify({ url, atualizadoEm: new Date().toISOString() }, null, 2) + '\n').toString('base64')
  execFileSync('gh', ['api', '-X', 'PUT', caminho, '-f', `message=Destino: ${url ?? 'desligado'}`, '-f', `content=${conteudo}`, '-f', `sha=${sha}`], {
    stdio: 'ignore',
  })
}

async function aguardarPublicacao(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${LINK_FIXO}destino.json?t=${Date.now()}`, { cache: 'no-store' })
      if (r.ok && (await r.json()).url === url) return true
    } catch {}
    await esperar(5000)
  }
  return false
}

// ---------- 3. Checar o túnel pelo DNS público (o DNS da rede pode ter cache negativo) ----------
const dnsPublico = new Resolver()
dnsPublico.setServers(['1.1.1.1', '8.8.8.8'])

async function tunelResponde(url) {
  const host = new URL(url).hostname
  const [ip] = await dnsPublico.resolve4(host)
  return new Promise((resolve) => {
    const req = https.get(
      { host: ip, servername: host, path: '/api/health', headers: { host }, timeout: 8000 },
      (res) => resolve(res.statusCode === 200),
    )
    req.on('error', () => resolve(false))
    req.on('timeout', () => (req.destroy(), resolve(false)))
  })
}

// ---------- 4. Subir o túnel ----------
log('Iniciando túnel da Cloudflare…')
const cf = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORTA}`], { stdio: ['ignore', 'pipe', 'pipe'] })

let url = null
let registrado = false
let encerrando = false

const ler = (dados) => {
  const texto = dados.toString()
  const m = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (m && !url) url = m[0]
  if (texto.includes('Registered tunnel connection')) registrado = true
}
cf.stdout.on('data', ler)
cf.stderr.on('data', ler)

async function encerrar(codigo) {
  if (encerrando) return
  encerrando = true
  log('Encerrando… marcando o link fixo como desligado.')
  try {
    publicar(null)
  } catch (e) {
    log(`⚠️ Não consegui atualizar o link fixo: ${e.message}`)
  }
  cf.kill()
  process.exit(codigo)
}
process.on('SIGINT', () => encerrar(0))
process.on('SIGTERM', () => encerrar(0))
cf.on('exit', () => {
  if (!encerrando) {
    log('❌ O cloudflared parou inesperadamente. Rode `npm run tunnel:publicar` de novo.')
    encerrar(1)
  }
})

for (let i = 0; i < 120 && !(url && registrado); i++) await esperar(500)
if (!url || !registrado) {
  log('❌ O túnel não registrou em 60 s. Verifique a internet e tente de novo.')
  await encerrar(1)
}
log(`Túnel registrado: ${url}`)

let ok = false
for (let i = 0; i < 20 && !ok; i++) {
  ok = await tunelResponde(url).catch(() => false)
  if (!ok) await esperar(3000)
}
if (!ok) {
  log('❌ O túnel não respondeu pela internet.')
  await encerrar(1)
}
log('Túnel respondendo pela internet ✓')

log('Atualizando o link fixo no GitHub Pages…')
publicar(url)
const publicado = await aguardarPublicacao(url)
log(publicado ? 'Link fixo atualizado ✓' : '⚠️ O GitHub ainda não publicou; pode levar mais alguns minutos.')

const linhas = ['🐾 Central Animal no ar', '', `Link fixo:  ${LINK_FIXO}`, `Painel:     ${LINK_FIXO}painel?modo=demo`, '', 'Deixe este terminal aberto. Ctrl+C para desligar.']
const largura = Math.max(...linhas.map((l) => l.length)) + 2
console.log(['', `  ┌${'─'.repeat(largura + 2)}┐`, ...linhas.map((l) => `  │ ${l.padEnd(largura)} │`), `  └${'─'.repeat(largura + 2)}┘`, ''].join('\n'))
