import { PRIORIDADES, type Prioridade } from '@ca/triagem'
import { AttributionControl, CircleMarker, MapContainer, ScaleControl, TileLayer, Tooltip, ZoomControl } from 'react-leaflet'
import { ATRIBUICAO_OSM, PATO_BRANCO, RotuloMapa } from '../cidadao/MapaPino'
import type { ItemFila } from '../tipos'
import { rotuloCategoria, tempoNaFila } from '../ui'

/** Tamanho = prioridade: no telão, o P1 se acha antes de ler a cor. */
const RAIO: Record<Prioridade, number> = { 1: 10, 2: 8, 3: 7, 4: 6 }

export default function MapaGeral({ itens, demo, agora, onSelecionar }: { itens: ItemFila[]; demo: boolean; agora: number; onSelecionar: (id: string) => void }) {
  const noMapa = itens.filter((o) => o.lat != null && o.lng != null)
  // P4 embaixo, P1 por cima: quando dois casos se sobrepõem, o mais grave é o que aparece.
  const ordenados = [...noMapa].sort((a, b) => b.prioridade - a.prioridade)
  return (
    <MapContainer center={PATO_BRANCO} zoom={14} className="mapa-noite h-full w-full" attributionControl={false} zoomControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
      {/* Canto de cima é do título (esquerda) e do QR do modo demo (direita): controles vão para baixo. */}
      <ZoomControl position="bottomright" />
      <ScaleControl position="bottomright" imperial={false} />
      <AttributionControl position="bottomright" prefix={false} />
      <RotuloMapa rotulo="Mapa das ocorrências abertas. A mesma lista está na fila." />
      {/* Pulso: P1 que ninguém assumiu ainda. Só desenho — não recebe clique nem foco. */}
      {noMapa
        .filter((o) => o.prioridade === 1 && !o.responsavel)
        .map((o) => (
          <CircleMarker
            key={`pulso-${o.id}`}
            center={[o.lat!, o.lng!]}
            radius={RAIO[1]}
            interactive={false}
            pathOptions={{ className: 'pulso-mapa', color: PRIORIDADES[1].cor, weight: 2, fill: false }}
          />
        ))}
      {ordenados.map((o) => (
        <CircleMarker
          key={o.id}
          center={[o.lat!, o.lng!]}
          radius={RAIO[o.prioridade]}
          pathOptions={{ color: '#08131b', weight: 2, fillColor: PRIORIDADES[o.prioridade].cor, fillOpacity: 1 }}
          eventHandlers={{ click: () => onSelecionar(o.id) }}
        >
          <Tooltip direction="top" offset={[0, -8]} className="dica-noite">
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <span className="rounded-[2px] px-1.5 font-display text-[13px] font-extrabold tracking-wide text-tinta uppercase" style={{ backgroundColor: PRIORIDADES[o.prioridade].cor }}>
                  P{o.prioridade} · {PRIORIDADES[o.prioridade].rotulo}
                </span>
                <span className="font-mono text-[11px] text-nevoa">{o.protocolo}</span>
              </span>
              <span className="text-sm font-semibold">{rotuloCategoria(o.categoria)}</span>
              <span className="font-mono text-[11px] text-nevoa">
                {/* Endereço é texto livre da plateia: fica fora do telão no modo demo. */}
                {!demo && o.endereco ? `${o.endereco} · ` : ''}
                {tempoNaFila(o.criadoEm, agora) === 'AGORA' ? 'agora' : `há ${tempoNaFila(o.criadoEm, agora).toLowerCase()}`} · {o.responsavel ?? 'sem responsável'}
              </span>
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
