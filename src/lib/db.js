const STORAGE_KEY = 'dondehaypena.penas'
const WEB_KEY = 'dondehaypena.web'

function esFicticia(pena) {
  return String(pena?.id || '').startsWith('seed-') || pena?.creadoPor?.uid === 'seed'
}

function leerLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list.filter((pena) => !esFicticia(pena)) : []
  } catch {
    return []
  }
}

export function esMia(pena, usuario) {
  return Boolean(usuario?.uid && pena?.creadoPor?.uid && pena.creadoPor.uid === usuario.uid)
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.detail || 'Error de base de datos')
  }
  return data
}

export function suscribirPenas(callback) {
  let cancel = false
  const refresh = async () => {
    try {
      const data = await api('/api/penas')
      if (!cancel) callback(Array.isArray(data.penas) ? data.penas : [])
    } catch {
      if (!cancel) callback(leerLocal().map((pena) => ({ ...pena, fuente: pena.fuente || 'vecinos' })))
    }
  }
  refresh()
  const timer = setInterval(refresh, 20000)
  window.addEventListener('penas-local-updated', refresh)
  return () => {
    cancel = true
    clearInterval(timer)
    window.removeEventListener('penas-local-updated', refresh)
  }
}

export async function obtenerPena(id) {
  const web = leerWeb().find((pena) => pena.id === id)
  try {
    const data = await api(`/api/penas/${encodeURIComponent(id)}`)
    if (data.pena) return data.pena
  } catch {
    if (web) return web
    return leerLocal().find((pena) => pena.id === id) || null
  }
  return web || null
}

export async function misPenas(uid) {
  const data = await api(`/api/penas?uid=${encodeURIComponent(uid)}`)
  return Array.isArray(data.penas) ? data.penas : []
}

export async function guardarPena(datos, flyerFile, usuario) {
  const flyerUrl = flyerFile ? await archivoADataUrl(flyerFile) : datos.flyerUrl || ''
  const data = await api('/api/penas', {
    method: 'POST',
    body: JSON.stringify({ ...datos, flyerUrl, usuario }),
  })
  window.dispatchEvent(new Event('penas-local-updated'))
  return data.pena
}

export async function actualizarPena(id, datos, flyerFile, usuario) {
  const flyerUrl = flyerFile ? await archivoADataUrl(flyerFile) : datos.flyerUrl || ''
  const data = await api(`/api/penas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...datos, flyerUrl, usuario }),
  })
  window.dispatchEvent(new Event('penas-local-updated'))
  return data.pena
}

export async function borrarPena(id, usuario) {
  await api(`/api/penas/${encodeURIComponent(id)}?uid=${encodeURIComponent(usuario.uid)}`, {
    method: 'DELETE',
    body: JSON.stringify({ usuario, uid: usuario.uid }),
  })
  window.dispatchEvent(new Event('penas-local-updated'))
}

export function recordarWeb(penas) {
  const prev = leerWeb()
  const map = new Map(prev.map((item) => [item.id, item]))
  for (const pena of penas || []) map.set(pena.id, pena)
  sessionStorage.setItem(WEB_KEY, JSON.stringify([...map.values()]))
}

export function leerWeb() {
  try {
    return JSON.parse(sessionStorage.getItem(WEB_KEY) || '[]')
  } catch {
    return []
  }
}

function archivoADataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
