import L from 'leaflet'
import { useEffect } from 'react'
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

export const PATO_BRANCO: [number, number] = [-26.2295, -52.6711]

// A política de uso dos tiles do OpenStreetMap exige o crédito visível em todo mapa.
export const ATRIBUICAO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Pino em tinta com o furo em branco — o mesmo desenho do ícone de local, sem depender do emoji de cada celular.
const pino = L.divIcon({
  html: '<svg viewBox="0 0 24 24" width="36" height="36" style="display:block;transform:translate(-50%,-100%)" aria-hidden="true"><path d="M12 22.5s-7.5-6.6-7.5-12.3A7.5 7.5 0 0 1 19.5 10.2c0 5.7-7.5 12.3-7.5 12.3z" fill="#0d1b26" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="2.8" fill="#fff"/></svg>',
  className: '',
  iconSize: [0, 0],
})

/**
 * react-leaflet não repassa role/aria-label para o contêiner, e o Leaflet põe tabindex=0 nele
 * (as setas do teclado movem o mapa): sem papel, é um div focável sem significado.
 */
export function RotuloMapa({ rotulo }: { rotulo: string }) {
  const mapa = useMap()
  useEffect(() => {
    const el = mapa.getContainer()
    el.setAttribute('role', 'application')
    el.setAttribute('aria-label', rotulo)
  }, [mapa, rotulo])
  return null
}

function Controle({ pos, onChange }: { pos: [number, number] | null; onChange: (p: [number, number]) => void }) {
  const mapa = useMap()
  useEffect(() => {
    if (pos) mapa.setView(pos, Math.max(mapa.getZoom(), 16))
  }, [pos?.[0], pos?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ click: (e) => onChange([e.latlng.lat, e.latlng.lng]) })
  return null
}

/** Apontar no mapa não é o único caminho: o campo de endereço ao lado resolve sem gesto. */
export default function MapaPino({ pos, onChange }: { pos: [number, number] | null; onChange: (p: [number, number]) => void }) {
  return (
    <MapContainer
      center={pos ?? PATO_BRANCO}
      zoom={pos ? 16 : 14}
      className="h-52 w-full rounded-md"
      attributionControl={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
      <AttributionControl prefix={false} />
      <RotuloMapa rotulo="Mapa de Pato Branco: toque para marcar o local, ou escreva o endereço no campo abaixo." />
      <Controle pos={pos} onChange={onChange} />
      {pos && (
        <Marker
          position={pos}
          icon={pino}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng()
              onChange([ll.lat, ll.lng])
            },
          }}
        />
      )}
    </MapContainer>
  )
}
