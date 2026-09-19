import { useEffect, useState } from 'react'
import { api, ErroApi } from '../api'

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

/** Tira da lista um protocolo que o servidor não conhece mais (ex.: banco da demonstração zerado). */
export function esquecerProtocolo(p: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lerProtocolos().filter((x) => x !== p)))
  } catch {
    /* navegação privada: nada guardado */
  }
}

/**
 * Protocolos salvos neste aparelho que ainda existem. A lista sobrevive a um `demo:reset`, o caso não:
 * sem esta checagem a tela inicial oferecia um protocolo que dava "não encontrado".
 * Só descarta o que o servidor responde 404; sem rede, mantém tudo.
 */
export function useProtocolosSalvos(): string[] {
  const [lista, setLista] = useState<string[] | null>(null)
  useEffect(() => {
    let ativo = true
    const salvos = lerProtocolos()
    Promise.all(
      salvos.map((p) =>
        api(`/api/ocorrencias/${encodeURIComponent(p)}`).then(
          () => true,
          (e) => !(e instanceof ErroApi && e.status === 404),
        ),
      ),
    ).then((existe) => {
      salvos.forEach((p, i) => existe[i] || esquecerProtocolo(p))
      if (ativo) setLista(salvos.filter((_, i) => existe[i]))
    })
    return () => {
      ativo = false
    }
  }, [])
  return lista ?? []
}
