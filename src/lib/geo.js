const RADIO_TIERRA_KM = 6371

export function distanciaKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return Infinity
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

function toRad(value) {
  return (value * Math.PI) / 180
}

export function pedirUbicacion() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no permite geolocalización'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60_000 },
    )
  })
}

export function finDePena(pena) {
  const hora = pena.horario?.trim() || '23:59'
  return new Date(`${pena.fechaHasta}T${hora}:00`)
}

export function estaVigente(pena, ahora = new Date()) {
  if (!pena?.fechaHasta) return false
  return ahora.getTime() <= finDePena(pena).getTime()
}

export function formatearFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function coincideFiltro(pena, { q = '', tipo = '', provincia = '', localidad = '', musico = '' } = {}) {
  const texto = q.trim().toLowerCase()
  const musicoQ = musico.trim().toLowerCase()
  const locQ = localidad.trim().toLowerCase()
  if (tipo && pena.tipoEvento !== tipo) return false
  if (provincia && pena.provincia !== provincia) return false
  if (locQ && !`${pena.localidad || ''} ${pena.ciudad || ''}`.toLowerCase().includes(locQ)) return false
  if (musicoQ) {
    const enMusicos = (pena.musicos || []).some((item) => String(item).toLowerCase().includes(musicoQ))
    const enNombre = `${pena.institucion || ''}`.toLowerCase().includes(musicoQ)
    if (!enMusicos && !enNombre) return false
  }
  if (texto) {
    const hay = [
      pena.institucion,
      pena.localidad,
      pena.ciudad,
      pena.provincia,
      pena.tipoEvento,
      ...(pena.musicos || []),
      ...(pena.gruposBaile || []),
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(texto)) return false
  }
  return true
}

export function formatearPrecio(valor) {
  if (valor === '' || valor == null || Number.isNaN(Number(valor))) return 'A confirmar'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(valor))
}
