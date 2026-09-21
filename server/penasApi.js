import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool, rowToPena } from './mysql.js'
import { reverseGeo } from './reverseGeo.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

function contentTypeFor(file) {
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.webp')) return 'image/webp'
  if (file.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function saveFlyer(dataUrl, id) {
  if (!dataUrl) return ''
  if (!String(dataUrl).startsWith('data:')) return String(dataUrl)
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!match) return ''
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  const mime = match[1].toLowerCase()
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'jpg'
  const name = `${id}.${ext}`
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(match[2], 'base64'))
  return `/uploads/${name}`
}

async function upsertUser(pool, usuario) {
  const uid = String(usuario?.uid || '').trim()
  if (!uid) throw new Error('Falta el usuario')
  await pool.query(
    `INSERT INTO users (uid, email, display_name, photo_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       display_name = VALUES(display_name),
       photo_url = VALUES(photo_url)`,
    [uid, usuario.email || '', usuario.displayName || usuario.nombre || 'Vecino', usuario.photoURL || ''],
  )
  return uid
}

function payloadFromBody(body) {
  return {
    tipo_evento: String(body.tipoEvento || 'Peña').slice(0, 32),
    musicos: JSON.stringify(Array.isArray(body.musicos) ? body.musicos.filter(Boolean) : []),
    grupos_baile: JSON.stringify(Array.isArray(body.gruposBaile) ? body.gruposBaile.filter(Boolean) : []),
    provincia: String(body.provincia || '').slice(0, 80),
    localidad: String(body.localidad || '').slice(0, 160),
    ciudad: String(body.ciudad || '').slice(0, 160),
    lat: Number(body.lat),
    lng: Number(body.lng),
    valor_anticipada: body.valorAnticipada === '' || body.valorAnticipada == null ? null : Number(body.valorAnticipada),
    valor_puerta: body.valorPuerta === '' || body.valorPuerta == null ? null : Number(body.valorPuerta),
    reserva_mesa: body.reservaMesa ? 1 : 0,
    institucion: String(body.institucion || '').slice(0, 255),
    fecha_desde: String(body.fechaDesde || '').slice(0, 10),
    fecha_hasta: String(body.fechaHasta || '').slice(0, 10),
    horario: String(body.horario || '21:00').slice(0, 8),
  }
}

function validar(payload) {
  if (!payload.provincia || !payload.localidad || !payload.ciudad) {
    throw new Error('Marcá el lugar en el mapa para completar provincia, localidad y ciudad.')
  }
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
    throw new Error('Marcá el punto exacto en el mapa.')
  }
  if (!payload.fecha_desde || !payload.fecha_hasta) {
    throw new Error('Indicá fecha desde y hasta.')
  }
  if (payload.fecha_hasta < payload.fecha_desde) {
    throw new Error('La fecha hasta no puede ser anterior a la fecha desde.')
  }
  if (!payload.institucion) {
    throw new Error('Marcá el lugar en el mapa para completar la institución.')
  }
}

const SELECT = `
  SELECT p.*,
         u.email AS user_email,
         u.display_name AS user_name,
         u.photo_url AS user_photo
  FROM penas p
  LEFT JOIN users u ON u.uid = p.user_uid
`

export async function handlePenasApi(req, res) {
  const url = new URL(req.url || '', 'http://127.0.0.1')
  const pathname = url.pathname
  const method = req.method || 'GET'

  if (pathname.startsWith('/uploads/')) {
    const file = path.join(UPLOAD_DIR, path.basename(pathname))
    if (!file.startsWith(UPLOAD_DIR) || !fs.existsSync(file)) {
      res.statusCode = 404
      res.end('Not found')
      return true
    }
    res.statusCode = 200
    res.setHeader('Content-Type', contentTypeFor(file))
    fs.createReadStream(file).pipe(res)
    return true
  }

  if (pathname === '/api/reverse-geo' && method === 'GET') {
    const lat = Number(url.searchParams.get('lat'))
    const lng = Number(url.searchParams.get('lng'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      json(res, 400, { error: 'Coordenadas inválidas' })
      return true
    }
    const place = await reverseGeo(lat, lng)
    json(res, 200, place)
    return true
  }

  const one = pathname.match(/^\/api\/penas\/([^/]+)$/)
  if (pathname !== '/api/penas' && !one) return false

  let pool
  try {
    pool = await getPool()
  } catch (error) {
    json(res, 503, {
      error: 'No se pudo conectar a MySQL. Abrí Docker Desktop y ejecutá npm run db:up, o cargá el host de la base dondehaypenia en el .env.',
      detail: error.code || error.message,
      penas: [],
    })
    return true
  }

  if (pathname === '/api/penas' && method === 'GET') {
    const uid = String(url.searchParams.get('uid') || '').trim()
    const [rows] = uid
      ? await pool.query(`${SELECT} WHERE p.user_uid = ? ORDER BY p.fecha_desde DESC`, [uid])
      : await pool.query(`${SELECT} ORDER BY p.fecha_desde ASC`)
    json(res, 200, { penas: rows.map(rowToPena) })
    return true
  }

  if (pathname === '/api/penas' && method === 'POST') {
    const body = await readBody(req)
    const uid = await upsertUser(pool, body.usuario || body.creadoPor)
    const payload = payloadFromBody(body)
    validar(payload)
    const id = randomUUID()
    const flyerUrl = saveFlyer(body.flyerUrl, id)
    await pool.query(
      `INSERT INTO penas (
        id, user_uid, tipo_evento, musicos, grupos_baile, provincia, localidad, ciudad,
        lat, lng, valor_anticipada, valor_puerta, reserva_mesa, institucion,
        fecha_desde, fecha_hasta, horario, flyer_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        uid,
        payload.tipo_evento,
        payload.musicos,
        payload.grupos_baile,
        payload.provincia,
        payload.localidad,
        payload.ciudad,
        payload.lat,
        payload.lng,
        payload.valor_anticipada,
        payload.valor_puerta,
        payload.reserva_mesa,
        payload.institucion,
        payload.fecha_desde,
        payload.fecha_hasta,
        payload.horario,
        flyerUrl,
      ],
    )
    const [rows] = await pool.query(`${SELECT} WHERE p.id = ?`, [id])
    json(res, 201, { pena: rowToPena(rows[0]) })
    return true
  }

  if (one && method === 'GET') {
    const [rows] = await pool.query(`${SELECT} WHERE p.id = ?`, [decodeURIComponent(one[1])])
    if (!rows[0]) {
      json(res, 404, { error: 'No encontramos esa peña.' })
      return true
    }
    json(res, 200, { pena: rowToPena(rows[0]) })
    return true
  }

  if (one && method === 'PUT') {
    const id = decodeURIComponent(one[1])
    const body = await readBody(req)
    const uid = await upsertUser(pool, body.usuario || body.creadoPor)
    const [current] = await pool.query('SELECT * FROM penas WHERE id = ?', [id])
    if (!current[0]) {
      json(res, 404, { error: 'No encontramos esa peña.' })
      return true
    }
    if (current[0].user_uid !== uid) {
      json(res, 403, { error: 'Solo podés editar las peñas que cargaste vos.' })
      return true
    }
    const payload = payloadFromBody(body)
    validar(payload)
    const flyerUrl = body.flyerUrl ? saveFlyer(body.flyerUrl, id) : current[0].flyer_url
    await pool.query(
      `UPDATE penas SET
        tipo_evento = ?, musicos = ?, grupos_baile = ?, provincia = ?, localidad = ?, ciudad = ?,
        lat = ?, lng = ?, valor_anticipada = ?, valor_puerta = ?, reserva_mesa = ?, institucion = ?,
        fecha_desde = ?, fecha_hasta = ?, horario = ?, flyer_url = ?
       WHERE id = ? AND user_uid = ?`,
      [
        payload.tipo_evento,
        payload.musicos,
        payload.grupos_baile,
        payload.provincia,
        payload.localidad,
        payload.ciudad,
        payload.lat,
        payload.lng,
        payload.valor_anticipada,
        payload.valor_puerta,
        payload.reserva_mesa,
        payload.institucion,
        payload.fecha_desde,
        payload.fecha_hasta,
        payload.horario,
        flyerUrl,
        id,
        uid,
      ],
    )
    const [rows] = await pool.query(`${SELECT} WHERE p.id = ?`, [id])
    json(res, 200, { pena: rowToPena(rows[0]) })
    return true
  }

  if (one && method === 'DELETE') {
    const id = decodeURIComponent(one[1])
    const body = await readBody(req)
    const uid = String(body?.usuario?.uid || body?.uid || url.searchParams.get('uid') || '').trim()
    if (!uid) {
      json(res, 401, { error: 'Tenés que estar logueado.' })
      return true
    }
    const [current] = await pool.query('SELECT * FROM penas WHERE id = ?', [id])
    if (!current[0]) {
      json(res, 404, { error: 'No encontramos esa peña.' })
      return true
    }
    if (current[0].user_uid !== uid) {
      json(res, 403, { error: 'Solo podés borrar las peñas que cargaste vos.' })
      return true
    }
    await pool.query('DELETE FROM penas WHERE id = ? AND user_uid = ?', [id, uid])
    json(res, 200, { ok: true })
    return true
  }

  return false
}
