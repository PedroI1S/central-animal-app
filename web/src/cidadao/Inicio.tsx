import { Link } from 'react-router'
import { ACESSO_LOCAL, Pata } from '../ui'
import { useProtocolosSalvos } from './meusProtocolos'

export default function Inicio() {
  const recentes = useProtocolosSalvos()
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-white">
      <header className="bg-gradient-to-br from-marca-700 to-marca-900 px-6 pt-12 pb-10 text-white">
        <Pata className="size-12" />
        <h1 className="mt-4 text-3xl font-bold text-balance">Central Animal</h1>
        <p className="mt-1 text-marca-100">Prefeitura de Pato Branco</p>
        <p className="mt-6 text-lg leading-snug">
          Viu um animal em risco? Conte o que está acontecendo. A gente entende a urgência e encaminha para quem pode ajudar.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-6 py-8">
        <Link
          to="/relatar"
          className="flex items-center justify-center gap-2 rounded-2xl bg-marca-600 px-6 py-5 text-lg font-semibold text-white shadow-lg shadow-marca-600/30 active:scale-[0.98]"
        >
          Relatar ocorrência
        </Link>
        <Link to="/acompanhar" className="rounded-2xl border border-slate-300 px-6 py-4 text-center font-medium text-slate-700">
          Acompanhar protocolo
        </Link>

        {recentes.length > 0 && (
          <div className="mt-4">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Seus protocolos</h2>
            <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {recentes.map((p) => (
                <li key={p}>
                  <Link to={`/acompanhar/${p}`} className="flex justify-between px-4 py-3 font-mono text-sm">
                    {p}{' '}
                    <span aria-hidden="true" className="text-marca-600">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="mt-auto space-y-2 pt-8 text-sm text-slate-600">
          {['Sem cadastro e sem instalar nada', 'Pode ser anônimo', 'Você acompanha o caso até o fim'].map((t) => (
            <li key={t}>
              <span aria-hidden="true">✓</span> {t}
            </li>
          ))}
        </ul>
      </div>

      <footer className="border-t border-slate-100 px-6 py-4 text-center text-xs text-slate-500">
        Pessoa em risco? Ligue&nbsp;<b>192</b> (SAMU) ou&nbsp;<b>193</b> (Bombeiros).
        {/* Pelo túnel a plateia inteira vê esta página: o atalho do painel só aparece no notebook. */}
        {ACESSO_LOCAL && (
          <>
            <br />
            <Link to="/painel" className="mt-1 inline-flex min-h-6 items-center underline">
              Área do servidor
            </Link>
          </>
        )}
      </footer>
    </main>
  )
}
