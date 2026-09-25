import { useEffect, useState } from 'react'
import { api, ErroApi } from '../api'
import type { OcorrenciaPublica } from '../tipos'

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

/** Um protocolo salvo e, quando o servidor respondeu, o caso — para a tela inicial mostrar prioridade e status. */
export type Salvo = { protocolo: string; caso: OcorrenciaPublica | null }

/**
 * Protocolos salvos neste aparelho que ainda existem. A lista sobrevive a um `demo:reset`, o caso não:
 * sem esta checagem a tela inicial oferecia um protocolo que dava "não encontrado".
 * Só descarta o que o servidor responde 404; sem rede, mantém tudo (sem os dados do caso).
 */
export function useProtocolosSalvos(): Salvo[] {
  const [lista, setLista] = useState<Salvo[] | null>(null)
  useEffect(() => {
    let ativo = true
    const salvos = lerProtocolos()
    Promise.all(
      salvos.map((p) =>
        api<OcorrenciaPublica>(`/api/ocorrencias/${encodeURIComponent(p)}`).then(
          (caso) => ({ protocolo: p, caso }),
          (e) => (e instanceof ErroApi && e.status === 404 ? null : { protocolo: p, caso: null }),
        ),
      ),
    ).then((res) => {
      salvos.forEach((p, i) => res[i] || esquecerProtocolo(p))
      if (ativo) setLista(res.filter((r): r is Salvo => r !== null))
    })
    return () => {
      ativo = false
    }
  }, [])
  return lista ?? []
}
