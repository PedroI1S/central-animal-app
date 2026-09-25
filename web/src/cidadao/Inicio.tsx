import { PRIORIDADES, type Prioridade } from '@ca/triagem'
import { Link } from 'react-router'
import { Avancar, Seta } from '../icones'
import { ACESSO_LOCAL, CLASSE_PRIORIDADE, Pata, STATUS } from '../ui'
import { useProtocolosSalvos } from './meusProtocolos'

// As quatro etiquetas de triagem em leque, como cartões numa mão: diz "a gente separa por urgência" sem texto.
const LEQUE: { p: Prioridade; pos: string }[] = [
  { p: 4, pos: 'left-[22%] top-[34px] -rotate-[16deg]' },
  { p: 3, pos: 'left-[39%] top-4 -rotate-[6deg]' },
  { p: 2, pos: 'left-[56%] top-3 rotate-[5deg]' },
  { p: 1, pos: 'left-[72%] top-7 rotate-[14deg]' },
]

export default function Inicio() {
  const recentes = useProtocolosSalvos()
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col bg-papel">
      <header className="bg-tinta px-6 pt-5 pb-7 text-claro">
        <div className="flex items-center gap-2">
          <Pata className="size-5" />
          <span className="font-display text-lg font-extrabold tracking-wide uppercase">Central Animal</span>
          <span className="ml-auto font-mono text-[10.5px] tracking-[0.12em] text-nevoa">PATO BRANCO · PR</span>
        </div>

        <div aria-hidden="true" className="relative mt-2 h-[150px]">
          {LEQUE.map(({ p, pos }) => (
            <span
              key={p}
              className={`absolute flex h-[104px] w-[74px] flex-col items-center justify-end gap-0.5 rounded-[7px] pb-3 shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${CLASSE_PRIORIDADE[p]} ${pos}`}
            >
              <span className="absolute top-2.5 size-3 rounded-full bg-tinta" />
              <span className="font-display text-[40px] leading-[0.9] font-extrabold">P{p}</span>
              <span className="font-mono text-[9px] tracking-[0.1em] uppercase">{PRIORIDADES[p].rotulo}</span>
            </span>
          ))}
        </div>

        <h1 className="mt-2.5 font-display text-[58px] leading-[0.86] font-extrabold uppercase">
          Viu um
          <br />
          animal
          <br />
          em risco?
        </h1>
        <p className="mt-3.5 text-[17px] leading-[1.38] text-pretty text-claro-2">
          Conte o que está acontecendo. A gente entende a urgência e encaminha para quem pode ajudar.
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[10.5px] tracking-[0.08em] text-nevoa uppercase">
          <li>Sem cadastro</li>
          <li>Pode ser anônimo</li>
          <li>Acompanhe até o fim</li>
        </ul>
      </header>

      <div className="flex flex-1 flex-col gap-2.5 px-6 pt-5 pb-6">
        <Link
          to="/relatar"
          className="flex h-16 items-center justify-between rounded-md bg-tinta px-5.5 text-[19px] font-semibold text-white shadow-[0_8px_20px_rgba(13,27,38,0.22)] active:scale-[0.98]"
        >
          Relatar ocorrência
          <Seta className="size-[22px]" />
        </Link>
        <Link to="/acompanhar" className="flex h-13 items-center justify-center rounded-md border-[1.5px] border-tinta font-semibold">
          Acompanhar protocolo
        </Link>

        {recentes.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-2">
            <h2 className="font-mono text-[10.5px] font-medium tracking-[0.14em] text-suave uppercase">Seus protocolos</h2>
            <ul className="flex flex-col gap-2">
              {recentes.map(({ protocolo, caso }) => (
                <li key={protocolo}>
                  <Link to={`/acompanhar/${protocolo}`} className="flex min-h-[62px] items-center gap-3 rounded-md border border-regra bg-white px-3.5 py-2">
                    {caso && (
                      <span
                        className={`flex h-8 w-6 shrink-0 flex-col items-center justify-between rounded-[3px] pt-1 pb-[3px] font-display text-xs leading-none font-extrabold ${CLASSE_PRIORIDADE[caso.prioridade]}`}
                      >
                        <span aria-hidden="true" className="size-[5px] rounded-full bg-white" />
                        <span>
                          <span className="sr-only">Prioridade </span>P{caso.prioridade}
                        </span>
                      </span>
                    )}
                    <span className="flex flex-col gap-0.5">
                      <span className="font-mono text-[15px] font-semibold">{protocolo}</span>
                      {caso && <span className="text-[13px] text-suave">{STATUS[caso.status]?.rotulo ?? caso.status}</span>}
                    </span>
                    <Avancar className="ml-auto size-[18px]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-4 border-t border-regra bg-white px-6 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col">
          <span className="text-[15px] font-bold text-alerta">Pessoa em risco?</span>
          <span className="text-[13px] text-suave">Ligue antes de relatar.</span>
          {/* Pelo túnel a plateia inteira vê esta página: o atalho do painel só aparece no notebook. */}
          {ACESSO_LOCAL && (
            <Link to="/painel" className="mt-1 inline-flex min-h-6 items-center text-[13px] text-suave underline">
              Área do servidor
            </Link>
          )}
        </div>
        <div className="ml-auto flex gap-4">
          {[
            ['192', 'SAMU'],
            ['193', 'Bombeiros'],
          ].map(([n, quem]) => (
            <div key={n} className="flex flex-col items-center">
              <span className="font-display text-[32px] leading-[0.9] font-extrabold">{n}</span>
              <span className="font-mono text-[9.5px] tracking-[0.1em] text-suave uppercase">{quem}</span>
            </div>
          ))}
        </div>
      </footer>
    </main>
  )
}
