import { useState, type FormEvent } from 'react'
import { enviarJson } from '../api'
import { ACESSO_LOCAL, Pata } from '../ui'

export default function Login({ onEntrar }: { onEntrar: () => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      await enviarJson('/api/auth/login', { email, senha })
      onEntrar()
    } catch (err) {
      setErro((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'h-12 w-full rounded border border-noite-borda bg-noite-0 px-3.5 text-[15px] text-claro placeholder:text-nevoa'
  return (
    <main className="noite grid min-h-full place-items-center bg-noite-0 p-6 text-claro [color-scheme:dark]">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-md border border-noite-3 bg-noite-1 p-8">
        <div>
          <Pata className="size-9 text-claro" />
          <h1 className="mt-3 font-display text-3xl leading-none font-extrabold uppercase">Central Animal</h1>
          <p className="mt-1.5 font-mono text-[11px] tracking-[0.12em] text-nevoa uppercase">Painel do servidor · Pato Branco</p>
        </div>
        <label htmlFor="login-email" className="sr-only">
          E-mail
        </label>
        <input
          id="login-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          spellCheck={false}
          placeholder="E-mail"
          autoComplete="username"
          className={campo}
        />
        <label htmlFor="login-senha" className="sr-only">
          Senha
        </label>
        <input
          id="login-senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="password"
          placeholder="Senha"
          autoComplete="current-password"
          className={campo}
        />
        {erro && (
          <p role="alert" className="text-sm text-p1">
            {erro}
          </p>
        )}
        <button disabled={enviando} className="h-12 w-full rounded bg-claro font-bold text-tinta disabled:opacity-50">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {ACESSO_LOCAL && <p className="text-center font-mono text-[11px] text-nevoa">Protótipo · ana@central.pb / central123</p>}
      </form>
    </main>
  )
}
