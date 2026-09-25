import type { ReactNode } from 'react'

/*
 * Ícones de traço, 24×24, na cor do texto. Substituem os emoji da versão anterior: emoji muda de desenho
 * em cada celular e o leitor de tela anuncia o nome dele ("curativo adesivo") antes do rótulo.
 * Todos são decorativos (aria-hidden); quem carrega informação recebe `rotulo` e vira role="img".
 */
function Icone({ children, className = 'size-4', rotulo, cheio = false }: { children: ReactNode; className?: string; rotulo?: string; cheio?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={cheio ? 'currentColor' : 'none'}
      stroke={cheio ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...(rotulo ? { role: 'img', 'aria-label': rotulo } : { 'aria-hidden': true })}
    >
      {children}
    </svg>
  )
}

type P = { className?: string; rotulo?: string }

/** A marca da IA: tudo que ela sugere ou escreve leva esta estrela, em anil. */
export const Faisca = (p: P) => (
  <Icone {...p} cheio>
    <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
  </Icone>
)
export const Pino = (p: P) => (
  <Icone {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icone>
)
export const Camera = (p: P) => (
  <Icone {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icone>
)
export const Seta = (p: P) => (
  <Icone {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icone>
)
export const Voltar = (p: P) => (
  <Icone {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Icone>
)
export const Avancar = (p: P) => (
  <Icone {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icone>
)
export const Check = (p: P) => (
  <Icone {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icone>
)
export const Copiar = (p: P) => (
  <Icone {...p}>
    <rect x="8" y="8" width="12" height="12" rx="1.5" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </Icone>
)
export const Fechar = (p: P) => (
  <Icone {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icone>
)
export const Olho = (p: P) => (
  <Icone {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
)
export const Cadeado = (p: P) => (
  <Icone {...p}>
    <rect x="5" y="11" width="14" height="9" rx="1.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icone>
)
export const Lapis = (p: P) => (
  <Icone {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </Icone>
)
export const Telefone = (p: P) => (
  <Icone {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Icone>
)
export const Alvo = (p: P) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icone>
)
export const Aviso = (p: P) => (
  <Icone {...p}>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v4M12 17.5v.5" />
  </Icone>
)
