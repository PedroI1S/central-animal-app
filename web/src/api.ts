export class ErroApi extends Error {
  status: number
  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const json = init.body !== undefined && !(init.body instanceof FormData)
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: json ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
  })
  const dados = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroApi(res.status, (dados as { erro?: string }).erro ?? 'Não foi possível completar a ação.')
  return dados as T
}

export const enviarJson = <T,>(url: string, corpo: unknown, method = 'POST') =>
  api<T>(url, { method, body: JSON.stringify(corpo) })
