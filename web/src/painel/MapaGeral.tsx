import { CATEGORIAS, PRIORIDADES } from '@ca/triagem'
import { AttributionControl, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { ATRIBUICAO_OSM, PATO_BRANCO, RotuloMapa } from '../cidadao/MapaPino'
import type { ItemFila } from '../tipos'

export default function MapaGeral({ itens, demo, onSelecionar }: { itens: ItemFila[]; demo: boolean; onSelecionar: (id: string) => void }) {
  return (
    <MapContainer
      center={PATO_BRANCO}
      zoom={14}
      className="h-full w-full"
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
      <AttributionControl prefix={false} />
      <RotuloMapa rotulo="Mapa das ocorrências abertas. A mesma lista está na aba Fila." />
      {itens
        .filter((o) => o.lat != null && o.lng != null)
        .map((o) => (
          <CircleMarker
            key={o.id}
            center={[o.lat!, o.lng!]}
            radius={o.prioridade === 1 ? 14 : 10}
            pathOptions={{ color: 'white', weight: 2, fillColor: PRIORIDADES[o.prioridade].cor, fillOpacity: 0.9 }}
            eventHandlers={{ click: () => onSelecionar(o.id) }}
          >
            <Tooltip>
              <b>{o.protocolo}</b> · {CATEGORIAS[o.categoria]}
              {/* Endereço é texto livre da plateia: fica fora do telão no modo demo. */}
              {!demo && o.endereco && (
                <>
                  <br />
                  {o.endereco}
                </>
              )}
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  )
}
