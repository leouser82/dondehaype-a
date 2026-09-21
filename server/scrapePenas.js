import { fetchJson, fetchText } from './http.js'

const OVERPASS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const SEARCH_ENGINES = [
  (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
  (query) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
]

const FOLK =
  /pe[ñn]a|folklor|tradicionalista|tertulia|doma|jineteada|chamam[eé]|chacarera|zamba|payada|crioll|gauch|fog[oó]n/i

const PREFERRED =
  /eventbrite|passline|plateanet|alternativa|ticketek|entrada|agenda|\.gob\.ar|municipalidad|cultura|folklore|tradicionalista|circuitope|facebook\.com\/events/i

const PHOTO_JUNK = /logo|sprite|pixel|tracking|icon|avatar|emoji|1x1|placeholder|spinner/i

const MESES = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
}

const cache = new Map()
const CACHE_MS = 8 * 60 * 1000

function isoHoy() {
  return new Date().toISOString().slice(0, 10)
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48)
}

function tipoDe(text) {
  const hay = String(text || '')
  if (/doma|jineteada|jinete/i.test(hay)) return 'Doma'
  if (/tertulia|payada|payador/i.test(hay)) return 'Tertulia'
  if (/baile|chamam|chacarera|zamba|malambo/i.test(hay)) return 'Baile'
  return 'Peña'
}

function toIsoDate(y, m, d) {
  const year = String(y).length === 2 ? `20${y}` : String(y)
  const iso = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (Number.isNaN(Date.parse(`${iso}T12:00:00`))) return ''
  return iso
}

function parseFechas(text) {
  const raw = String(text || '')
  const found = []
  for (const match of raw.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g)) {
    const iso = toIsoDate(match[3], match[2], match[1])
    if (iso) found.push(iso)
  }
  for (const match of raw.matchAll(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de?\s*(\d{4}))?/gi,
  )) {
    const year = match[3] || String(new Date().getFullYear())
    const iso = toIsoDate(year, MESES[match[2].toLowerCase()], match[1])
    if (iso) found.push(iso)
  }
  for (const match of raw.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/g)) {
    found.push(`${match[1]}-${match[2]}-${match[3]}`)
  }
  const hoy = isoHoy()
  return [...new Set(found)].filter((iso) => iso >= hoy).sort()
}

function parseHora(text) {
  const match = String(text || '').match(/\b(\d{1,2})[:h](\d{2})\b/i) || String(text || '').match(/\b(\d{1,2})\s*hs\b/i)
  if (!match) return ''
  const hour = match[1].padStart(2, '0')
  const min = match[2] ? match[2] : '00'
  return `${hour}:${min}`
}

function parsePrecios(text) {
  const raw = String(text || '').replace(/\./g, '')
  const anticipada = raw.match(/anticipad\w*.{0,24}\$?\s*(\d{3,7})/i)
  const puerta = raw.match(/(?:en )?puerta.{0,24}\$?\s*(\d{3,7})/i)
  return {
    valorAnticipada: anticipada ? Number(anticipada[1]) : null,
    valorPuerta: puerta ? Number(puerta[1]) : null,
  }
}

function looksLikeArtist(name) {
  const t = String(name || '').replace(/\s+/g, ' ').trim()
  if (t.length < 5 || t.length > 48) return false
  if (!/^[A-ZÁÉÍÓÚÑ]/.test(t)) return false
  if (/(fecha|lugar|entrada|temporada|leer|productor|bailarines|^grupos?$|canciones|disco |música latina)/i.test(t)) {
    return false
  }
  const words = t.split(' ').filter((w) => w.length > 1)
  if (words.length < 2 && !/^Los\s|^Las\s/i.test(t)) return false
  return true
}

function musicosFrom(text, performers = []) {
  const names = performers.filter(looksLikeArtist)
  const blob = String(text || '')
  const patterns = [
    /(?:m[uú]sicos?|artistas?|act[uú]a[n]?|presenta[n]?|con la participaci[oó]n de)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü.]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü.]+){0,4})/g,
    /\bcon\s+(Los\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü.]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñü.]+){0,3})/g,
  ]
  for (const pattern of patterns) {
    for (const match of blob.matchAll(pattern)) {
      if (looksLikeArtist(match[1])) names.push(match[1].trim())
    }
  }
  return [...new Set(names)].slice(0, 5)
}

function decodeHref(href) {
  const ddg = String(href || '').match(/uddg=([^&]+)/)
  if (ddg) return decodeURIComponent(ddg[1])
  return href
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function flattenLd(node, bag = []) {
  if (!node) return bag
  if (Array.isArray(node)) {
    node.forEach((item) => flattenLd(item, bag))
    return bag
  }
  if (typeof node === 'object') {
    bag.push(node)
    flattenLd(node['@graph'], bag)
    flattenLd(node.itemListElement, bag)
  }
  return bag
}

function extractJsonLd(html) {
  const nodes = []
  for (const match of String(html || '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      flattenLd(JSON.parse(match[1]), nodes)
    } catch {
      /* ignore */
    }
  }
  return nodes
}

function isEventType(node) {
  const type = node?.['@type']
  const values = Array.isArray(type) ? type : [type]
  return values.some((item) => /Event|MusicEvent|Festival/i.test(String(item || '')))
}

function performerNames(node) {
  const list = Array.isArray(node?.performer) ? node.performer : node?.performer ? [node.performer] : []
  return list.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
}

function imagesFrom(html, baseUrl, node) {
  const found = []
  const push = (url) => {
    if (!url) return
    try {
      found.push(new URL(decodeEntities(url), baseUrl).toString())
    } catch {
      /* ignore */
    }
  }
  const image = node?.image
  if (typeof image === 'string') push(image)
  else if (Array.isArray(image)) image.forEach((item) => push(typeof item === 'string' ? item : item?.url))
  else if (image?.url) push(image.url)

  for (const match of String(html || '').matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    push(match[1])
  }
  for (const match of String(html || '').matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi,
  )) {
    push(match[1])
  }
  return [...new Set(found)].filter((url) => /^https?:\/\//.test(url) && !PHOTO_JUNK.test(url) && !/\.svg|\.gif/i.test(url))
}

function ogTitle(html) {
  const match =
    String(html || '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    String(html || '').match(/<title[^>]*>([\s\S]{0,180}?)<\/title>/i)
  return htmlToText(match?.[1] || '')
}

function penaEvento(extra) {
  if (!extra.fechaDesde) return null
  return {
    fuente: 'internet',
    flyerUrl: extra.flyerUrl || '',
    tipoEvento: extra.tipoEvento || 'Peña',
    musicos: extra.musicos || [],
    gruposBaile: extra.gruposBaile || [],
    provincia: extra.provincia || '',
    localidad: extra.localidad || extra.ciudad || '',
    ciudad: extra.ciudad || extra.localidad || '',
    lat: extra.lat ?? null,
    lng: extra.lng ?? extra.lon ?? null,
    valorAnticipada: extra.valorAnticipada ?? null,
    valorPuerta: extra.valorPuerta ?? null,
    reservaMesa: Boolean(extra.reservaMesa),
    institucion: extra.institucion || extra.nombre || 'Evento folklórico',
    fechaDesde: extra.fechaDesde,
    fechaHasta: extra.fechaHasta || extra.fechaDesde,
    horario: extra.horario || '',
    origenUrl: extra.origenUrl || '',
    resumen: extra.resumen || '',
    fechaConfirmada: true,
    creadoPor: { uid: 'internet', nombre: 'Internet', email: '' },
    id: extra.id,
  }
}

async function overpassOnce(url, query) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'DondeHayPena/1.0',
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('http')
    const data = await response.json()
    return data.elements || []
  } finally {
    clearTimeout(timer)
  }
}

async function overpassFolk(lat, lng, km) {
  const radius = Math.round(km * 1000)
  const query = `[out:json][timeout:12];(nwr(around:${radius},${lat},${lng})["name"~"peña|pena folkl|folklor|tradicionalista|tertulia|jineteada|doma criolla",i];);out center tags 30;`
  for (const url of OVERPASS) {
    try {
      return await overpassOnce(url, query)
    } catch {
      /* next */
    }
  }
  return []
}

function osmVenue(el) {
  const tags = el.tags || {}
  const name = tags.name || ''
  if (!FOLK.test(name)) return null
  const lat = Number(el.lat ?? el.center?.lat)
  const lng = Number(el.lon ?? el.center?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    nombre: name,
    lat,
    lng,
    localidad: tags['addr:city'] || tags['addr:suburb'] || '',
    ciudad: tags['addr:city'] || '',
    provincia: tags['addr:state'] || '',
  }
}

async function photonSearch(query, lat, lng) {
  const near = Number.isFinite(lat) && Number.isFinite(lng) ? `&lat=${lat}&lon=${lng}` : ''
  const data = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}${near}&limit=15`, {
    timeoutMs: 8000,
  })
  return data?.features || []
}

function photonVenue(feat) {
  const props = feat.properties || {}
  const coords = feat.geometry?.coordinates
  const name = String(props.name || '').trim()
  if (!name || !FOLK.test(name)) return null
  if (!Array.isArray(coords) || coords.length < 2) return null
  const [lng, lat] = coords
  return {
    nombre: name,
    lat: Number(lat),
    lng: Number(lng),
    localidad: props.city || props.locality || '',
    ciudad: props.city || '',
    provincia: props.state || '',
  }
}

async function geocode(query) {
  if (!query) return null
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${encodeURIComponent(query)}`,
    { timeoutMs: 8000 },
  )
  const hit = data?.[0]
  if (!hit) return null
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    localidad: hit.address?.town || hit.address?.city || hit.address?.village || '',
    ciudad: hit.address?.city || hit.address?.town || '',
    provincia: hit.address?.state || '',
  }
}

async function reverseGeo(lat, lng) {
  const data = await fetchJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`,
    { timeoutMs: 8000 },
  )
  const a = data?.address || {}
  return {
    ciudad: a.city || a.town || a.village || a.municipality || '',
    localidad: a.suburb || a.town || a.village || a.city || '',
    provincia: a.state || '',
  }
}

function linksFromSearch(html) {
  const links = []
  for (const match of String(html || '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const url = decodeHref(match[1])
    const title = htmlToText(match[2])
    if (!/^https?:\/\//.test(url)) continue
    if (/duckduckgo|mojeek|google\.|facebook\.com\/login|instagram\.com\/accounts/i.test(url)) continue
    if (title.length < 8 || /^https?:|^www\./i.test(title)) continue
    links.push({ url, title, rank: PREFERRED.test(url) ? 6 : FOLK.test(title) ? 3 : 1 })
  }
  return links.sort((a, b) => b.rank - a.rank)
}

async function searchLinks(query, limit = 4) {
  const html =
    (await fetchText(SEARCH_ENGINES[0](query), { timeoutMs: 9000, referer: 'https://duckduckgo.com/' })) ||
    (await fetchText(SEARCH_ENGINES[1](query), { timeoutMs: 8000 }))
  if (!html) return []
  return linksFromSearch(html)
    .filter((item) => FOLK.test(`${item.title} ${query}`) || PREFERRED.test(item.url))
    .slice(0, limit)
}

function eventFromPage(html, url, venue = {}) {
  const nodes = extractJsonLd(html)
  const eventNode = nodes.find(isEventType)
  const text = htmlToText(html).slice(0, 6000)
  const title = ogTitle(html) || eventNode?.name || venue.nombre || ''
  const blob = `${title} ${text}`
  if (!FOLK.test(blob)) return null
  if (venue.nombre) {
    const tokens = String(venue.nombre)
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
    const hay = blob.toLowerCase()
    const hits = tokens.filter((token) => hay.includes(token.toLowerCase())).length
    if (tokens.length && hits < Math.min(2, tokens.length)) return null
  }

  const ldStart = String(eventNode?.startDate || '').slice(0, 10)
  const ldEnd = String(eventNode?.endDate || eventNode?.startDate || '').slice(0, 10)
  const ldHour = String(eventNode?.startDate || '').match(/T(\d{2}:\d{2})/)?.[1] || ''
  const fechas = ldStart && ldStart >= isoHoy() ? [ldStart] : parseFechas(`${title} ${text}`)
  if (!fechas.length) return null

  const precios = parsePrecios(text)
  const fotos = imagesFrom(html, url, eventNode)
  const resumen = String(eventNode?.description || text)
    .replace(/\s+/g, ' ')
    .slice(0, 220)

  const loc = eventNode?.location
  const locName = typeof loc === 'string' ? loc : loc?.name || loc?.address?.addressLocality || ''

  return penaEvento({
    id: `web-ev-${slug(title)}-${fechas[0]}`,
    institucion: venue.nombre || title.slice(0, 90),
    tipoEvento: tipoDe(`${title} ${text}`),
    musicos: musicosFrom(text, performerNames(eventNode)),
    fechaDesde: fechas[0],
    fechaHasta: ldEnd && ldEnd >= fechas[0] ? ldEnd.slice(0, 10) : fechas[1] || fechas[0],
    horario: ldHour || parseHora(`${title} ${text}`),
    flyerUrl: fotos[0] || '',
    lat: venue.lat ?? null,
    lng: venue.lng ?? null,
    localidad: venue.localidad || locName,
    ciudad: venue.ciudad || '',
    provincia: venue.provincia || '',
    origenUrl: url,
    resumen,
    ...precios,
    reservaMesa: /reserv\w* mesa/i.test(text),
  })
}

async function mapLimit(items, limit, fn) {
  const out = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()))
  return out.filter(Boolean)
}

async function eventsFromLinks(links, venue) {
  return mapLimit(links.slice(0, 3), 3, async (link) => {
    const html = await fetchText(link.url, { timeoutMs: 10000, referer: 'https://duckduckgo.com/' })
    if (!html) return null
    return eventFromPage(html, link.url, venue)
  })
}

async function crawlAgenda(queries, venue) {
  const found = []
  for (const query of queries.slice(0, 2)) {
    const links = await searchLinks(query, 4)
    const events = await eventsFromLinks(links, venue)
    found.push(...events)
    if (found.length >= 3) break
  }
  return found
}

async function enrichVenues(venues, lugar) {
  const year = new Date().getFullYear()
  return (
    await mapLimit(venues.slice(0, 6), 2, async (venue) => {
      const where = venue.ciudad || venue.localidad || lugar.ciudad || ''
      const events = await crawlAgenda(
        [`"${venue.nombre}" peña ${where} ${year}`, `${venue.nombre} folklore agenda ${year}`],
        venue,
      )
      return events
    })
  ).flat()
}

function folkTerms(filters = {}) {
  const tipo = filters.tipo ? String(filters.tipo).toLowerCase() : 'peña folklórica'
  const where = [filters.localidad, filters.provincia, filters.ciudad].filter(Boolean).join(' ')
  const year = new Date().getFullYear()
  return [
    `${tipo === 'peña' ? 'peña folklórica' : tipo} ${where} ${year} agenda`.trim(),
    `peña folklórica ${where} ${filters.musico || ''} ${year}`.trim(),
    `${filters.q || 'evento folklore'} ${where} peña ${year}`.trim(),
  ].filter((item, index, list) => item.length > 10 && list.indexOf(item) === index)
}

function kmDist(a, b) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export async function scrapePenas(params = {}) {
  const key = `eventos-v2:${JSON.stringify(params)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data

  const lat = Number(params.lat)
  const lng = Number(params.lng)
  const km = Number(params.km) || 0
  const near = Number.isFinite(lat) && Number.isFinite(lng)
  const origin = near ? { lat, lng } : null

  let lugar = {
    ciudad: params.ciudad || params.localidad || '',
    localidad: params.localidad || '',
    provincia: params.provincia || '',
  }
  if (near && !lugar.ciudad) lugar = { ...lugar, ...(await reverseGeo(lat, lng)) }

  const [osm, photonLists, agenda] = await Promise.all([
    near ? overpassFolk(lat, lng, km || 100).catch(() => []) : Promise.resolve([]),
    Promise.all(
      [`peña folklórica ${lugar.ciudad || ''}`.trim(), `centro tradicionalista ${lugar.ciudad || lugar.provincia || ''}`.trim()].map(
        (q) => photonSearch(q, near ? lat : undefined, near ? lng : undefined).catch(() => []),
      ),
    ),
    crawlAgenda(folkTerms({ ...params, ...lugar }), {}).catch(() => []),
  ])

  let venues = [...osm.map(osmVenue), ...photonLists.flat().map(photonVenue)].filter(Boolean)
  if (origin) {
    venues = venues
      .filter((item) => kmDist(origin, item) <= (km || 100))
      .sort((a, b) => kmDist(origin, a) - kmDist(origin, b))
  }
  const seenVenue = new Set()
  venues = venues.filter((item) => {
    const keyName = slug(item.nombre)
    if (seenVenue.has(keyName)) return false
    seenVenue.add(keyName)
    return true
  })

  const fromVenues = await enrichVenues(venues, lugar).catch(() => [])
  const list = [...fromVenues, ...agenda].filter((item) => item?.fechaConfirmada && item.fechaDesde >= isoHoy())

  const unique = []
  const seen = new Set()
  for (const item of list) {
    if (near && Number.isFinite(item.lat) && Number.isFinite(item.lng) && kmDist(origin, item) > (km || 100)) continue
    const stamp = `${slug(item.institucion)}-${item.fechaDesde}-${item.origenUrl}`
    if (seen.has(stamp) || seen.has(item.origenUrl)) continue
    seen.add(stamp)
    if (item.origenUrl) seen.add(item.origenUrl)
    unique.push(item)
  }

  unique.sort((a, b) => String(a.fechaDesde).localeCompare(String(b.fechaDesde)))
  cache.set(key, { at: Date.now(), data: unique })
  return unique
}
