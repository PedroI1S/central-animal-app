import L from 'leaflet'
import { useEffect } from 'react'
import { AttributionControl, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

export const PATO_BRANCO: [number, number] = [-26.2295, -52.6711]

// A política de uso dos tiles do OpenStreetMap exige o crédito visível em todo mapa.
export const ATRIBUICAO_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const pino = L.divIcon({ html: '<div style="font-size:34px;line-height:1;transform:translate(-50%,-100%)">📍</div>', className: '', iconSize: [0, 0] })

function Controle({ pos, onChange }: { pos: [number, number] | null; onChange: (p: [number, number]) => void }) {
  const mapa = useMap()
  useEffect(() => {
    if (pos) mapa.setView(pos, Math.max(mapa.getZoom(), 16))
  }, [pos?.[0], pos?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  useMapEvents({ click: (e) => onChange([e.latlng.lat, e.latlng.lng]) })
  return null
}

export default function MapaPino({ pos, onChange }: { pos: [number, number] | null; onChange: (p: [number, number]) => void }) {
  return (
    <MapContainer center={pos ?? PATO_BRANCO} zoom={pos ? 16 : 14} className="h-52 w-full rounded-xl" attributionControl={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution={ATRIBUICAO_OSM} />
      <AttributionControl prefix={false} />
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
