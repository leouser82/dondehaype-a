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

export default function MapaPenas({ penas, centro, radioKm = 100 }) {
  const holder = useRef(null)

  useEffect(() => {
    if (!holder.current) return undefined
    const start = centro ? [centro.lat, centro.lng] : [-34.6, -64.2]
    const map = L.map(holder.current).setView(start, centro ? 8 : 5)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    if (centro) {
      L.circle([centro.lat, centro.lng], {
        radius: radioKm * 1000,
        color: '#b84a22',
        fillColor: '#d4743a',
        fillOpacity: 0.12,
        weight: 2,
      }).addTo(map)
      L.circleMarker([centro.lat, centro.lng], {
        radius: 7,
        color: '#4f5d2f',
        fillColor: '#c4a35a',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindPopup('Estás acá')
    }

    penas.forEach((pena) => {
      if (pena.lat == null || pena.lng == null) return
      L.marker([pena.lat, pena.lng])
        .addTo(map)
        .bindPopup(
          `<strong>${pena.tipoEvento}</strong><br/>${pena.localidad}, ${pena.provincia}<br/>${pena.institucion || ''}`,
        )
    })

    setTimeout(() => map.invalidateSize(), 80)
    return () => map.remove()
  }, [penas, centro, radioKm])

  return <div ref={holder} className="map-canvas map-home" />
}
