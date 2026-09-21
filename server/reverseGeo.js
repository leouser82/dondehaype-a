import { fetchJson } from './http.js'

const PROVINCIAS = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

function normalizar(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function matchProvincia(raw) {
  const n = normalizar(raw)
  if (!n) return ''
  if (/(ciudad autonoma|capital federal|\bcaba\b)/.test(n)) return 'CABA'
  if (n.includes('tierra del fuego')) return 'Tierra del Fuego'
  const hit = PROVINCIAS.find((item) => {
    const p = normalizar(item)
    return n === p || n.includes(p)
  })
  return hit || String(raw || '').trim()
}

export async function reverseGeo(lat, lng) {
  const nominatim = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&zoom=18&accept-language=es`,
    { timeoutMs: 8000 },
  )
  if (nominatim?.address) {
    const a = nominatim.address
    const institucion =
      String(nominatim.name || '').trim() ||
      a.amenity ||
      a.tourism ||
      a.leisure ||
      a.club ||
      [a.road, a.house_number].filter(Boolean).join(' ') ||
      a.suburb ||
      a.neighbourhood ||
      ''
    return {
      institucion: String(institucion).trim(),
      localidad: a.suburb || a.neighbourhood || a.town || a.village || a.city_district || a.city || '',
      ciudad: a.city || a.town || a.village || a.municipality || '',
      provincia: matchProvincia(a.state || a.province || ''),
    }
  }

  const photon = await fetchJson(
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=es`,
    { timeoutMs: 8000 },
  )
  const props = photon?.features?.[0]?.properties || {}
  return {
    institucion: String(props.name || [props.street, props.housenumber].filter(Boolean).join(' ') || '').trim(),
    localidad: props.district || props.locality || props.city || '',
    ciudad: props.city || props.town || '',
    provincia: matchProvincia(props.state || ''),
  }
}
