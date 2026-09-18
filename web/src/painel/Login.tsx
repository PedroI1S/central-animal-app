import { useState, type FormEvent } from 'react'
import { enviarJson } from '../api'

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

  return (
    <main className="grid min-h-full place-items-center bg-gradient-to-br from-slate-800 to-slate-950 p-6">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-2xl">
        <div>
          <div className="text-4xl">🐾</div>
          <h1 className="mt-2 text-2xl font-bold">Central Animal</h1>
          <p className="text-sm text-slate-500">Painel do servidor · Prefeitura de Pato Branco</p>
        </div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail" autoComplete="username" className="w-full rounded-lg border border-slate-300 p-3" />
        <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password" placeholder="Senha" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 p-3" />
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button disabled={enviando} className="w-full rounded-lg bg-marca-600 py-3 font-semibold text-white disabled:opacity-50">
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center text-xs text-slate-400">Protótipo · ana@central.pb / central123</p>
      </form>
    </main>
  )
}
