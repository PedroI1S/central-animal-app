const CHAVE = 'central-animal:protocolos'

export function lerProtocolos(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function salvarProtocolo(p: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([p, ...lerProtocolos().filter((x) => x !== p)].slice(0, 5)))
  } catch {
    /* navegação privada: segue sem guardar */
  }
}
