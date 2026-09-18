/** Reduz a foto no próprio celular (máx. 1280 px, JPEG) — envio rápido pelo túnel e análise mais leve para o Qwen. */
export async function reduzirFoto(arquivo: File, max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a foto'))), 'image/jpeg', 0.82),
  )
}
