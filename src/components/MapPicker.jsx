import L from 'leaflet'
import { useEffect, useRef } from 'react'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export default function MapPicker({ lat, lng, onChange }) {
  const holder = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!holder.current || mapRef.current) return undefined

    const start = lat && lng ? [lat, lng] : [-34.6, -64.2]
    const map = L.map(holder.current, { scrollWheelZoom: true }).setView(start, lat ? 13 : 5)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    if (lat && lng) {
      markerRef.current = L.marker([lat, lng]).addTo(map)
    }

    map.on('click', (event) => {
      const { lat: clickLat, lng: clickLng } = event.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng(event.latlng)
      } else {
        markerRef.current = L.marker(event.latlng).addTo(map)
      }
      onChange(Number(clickLat.toFixed(6)), Number(clickLng.toFixed(6)))
    })

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 80)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  return (
    <div className="map-wrap">
      <div ref={holder} className="map-canvas" />
      <p className="hint">Hacé clic en el mapa para clavar el puntero donde es la peña.</p>
      {lat && lng ? (
        <p className="coords">
          {lat.toFixed(5)}, {lng.toFixed(5)} ·{' '}
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver en Google Maps
          </a>
        </p>
      ) : null}
    </div>
  )
}
