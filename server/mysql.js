import mysql from 'mysql2/promise'

let pool
let readyPromise

function parseUrl(raw) {
  const url = new URL(raw)
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  }
}

export function config() {
  const fromUrl = process.env.MYSQL_URL ? parseUrl(process.env.MYSQL_URL) : {}
  return {
    host: fromUrl.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: fromUrl.port || Number(process.env.MYSQL_PORT || 3306),
    user: fromUrl.user || process.env.MYSQL_USER || 'pena',
    password: fromUrl.password || process.env.MYSQL_PASSWORD || 'pena',
    database: fromUrl.database || process.env.MYSQL_DATABASE || 'u290440545_dondehaypenia',
    connectTimeout: 12000,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 8,
    dateStrings: true,
  }
}

async function ensureTables(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS users (
      uid VARCHAR(128) NOT NULL,
      email VARCHAR(255) NOT NULL DEFAULT '',
      display_name VARCHAR(255) NOT NULL DEFAULT '',
      photo_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await conn.query(`
    CREATE TABLE IF NOT EXISTS penas (
      id CHAR(36) NOT NULL,
      user_uid VARCHAR(128) NOT NULL,
      tipo_evento VARCHAR(32) NOT NULL,
      musicos JSON,
      grupos_baile JSON,
      provincia VARCHAR(80) NOT NULL DEFAULT '',
      localidad VARCHAR(160) NOT NULL DEFAULT '',
      ciudad VARCHAR(160) NOT NULL DEFAULT '',
      lat DECIMAL(10, 6) NOT NULL,
      lng DECIMAL(10, 6) NOT NULL,
      valor_anticipada DECIMAL(12, 2) NULL,
      valor_puerta DECIMAL(12, 2) NULL,
      reserva_mesa TINYINT(1) NOT NULL DEFAULT 0,
      institucion VARCHAR(255) NOT NULL DEFAULT '',
      fecha_desde DATE NOT NULL,
      fecha_hasta DATE NOT NULL,
      horario VARCHAR(8) NOT NULL DEFAULT '21:00',
      flyer_url MEDIUMTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_penas_user (user_uid),
      KEY idx_penas_fecha (fecha_hasta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function connectOnce(cfg) {
  const next = mysql.createPool(cfg)
  try {
    const conn = await next.getConnection()
    try {
      await ensureTables(conn)
    } finally {
      conn.release()
    }
    return next
  } catch (error) {
    await next.end().catch(() => {})
    throw error
  }
}

async function connectWithRetry() {
  const cfg = config()
  const started = Date.now()
  let lastError
  while (Date.now() - started < 20_000) {
    try {
      pool = await connectOnce(cfg)
      return pool
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  throw lastError || new Error('No se pudo conectar a MySQL')
}

export function getPool() {
  if (pool) return Promise.resolve(pool)
  if (!readyPromise) {
    readyPromise = connectWithRetry().catch((error) => {
      readyPromise = null
      throw error
    })
  }
  return readyPromise
}

export function rowToPena(row) {
  if (!row) return null
  return {
    id: row.id,
    fuente: 'vecinos',
    tipoEvento: row.tipo_evento,
    musicos: asList(row.musicos),
    gruposBaile: asList(row.grupos_baile),
    provincia: row.provincia || '',
    localidad: row.localidad || '',
    ciudad: row.ciudad || '',
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    valorAnticipada: row.valor_anticipada == null ? null : Number(row.valor_anticipada),
    valorPuerta: row.valor_puerta == null ? null : Number(row.valor_puerta),
    reservaMesa: Boolean(row.reserva_mesa),
    institucion: row.institucion || '',
    fechaDesde: asDate(row.fecha_desde),
    fechaHasta: asDate(row.fecha_hasta),
    horario: row.horario || '',
    flyerUrl: row.flyer_url || '',
    createdAt: row.created_at,
    creadoPor: {
      uid: row.user_uid,
      nombre: row.user_name || 'Vecino',
      email: row.user_email || '',
    },
  }
}

function asList(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asDate(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}
