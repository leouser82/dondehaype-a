import L from 'leaflet'
import { useEffect, useRef } from 'react'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { pedirUbicacion } from '../lib/geo'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

export default function MapPicker({ lat, lng, onChange, locateUser = true }) {
  const holder = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const youRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!holder.current || mapRef.current) return undefined

    const start = lat && lng ? [lat, lng] : [-34.6, -64.2]
    const map = L.map(holder.current, { scrollWheelZoom: true }).setView(start, lat ? 15 : 5)
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
      onChangeRef.current(Number(clickLat.toFixed(6)), Number(clickLng.toFixed(6)))
    })

    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 80)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
      youRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !locateUser || (lat != null && lng != null)) return undefined
    let cancel = false
    pedirUbicacion()
      .then((coords) => {
        if (cancel || !mapRef.current) return
        mapRef.current.setView([coords.lat, coords.lng], 15)
        if (!youRef.current) {
          youRef.current = L.circleMarker([coords.lat, coords.lng], {
            radius: 9,
            color: '#b84a22',
            fillColor: '#d4743a',
            fillOpacity: 0.85,
            weight: 2,
          })
            .addTo(mapRef.current)
            .bindTooltip('Estás acá')
        } else {
          youRef.current.setLatLng([coords.lat, coords.lng])
        }
        setTimeout(() => mapRef.current?.invalidateSize(), 80)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [locateUser, lat, lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || lat == null || lng == null) return
    map.setView([lat, lng], Math.max(map.getZoom(), 15))
    if (markerRef.current) markerRef.current.setLatLng([lat, lng])
    else markerRef.current = L.marker([lat, lng]).addTo(map)
  }, [lat, lng])

  return (
    <div className="map-wrap">
      <div ref={holder} className="map-canvas" />
      <p className="hint">
        El mapa se centra en tu ubicación. Hacé clic donde es el evento: los campos de arriba se completan solos.
      </p>
      {lat && lng ? (
        <p className="coords">
          {lat.toFixed(5)}, {lng.toFixed(5)} ·{' '}
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
            Ver en Google Maps
          </a>
        </p>
      ) : null}
    </div>
  )
}
