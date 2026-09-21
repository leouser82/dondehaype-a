import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, firebaseReady, storage } from './firebase'

const STORAGE_KEY = 'dondehaypena.penas'

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

function escribirLocal(penas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(penas.filter((pena) => !esFicticia(pena))))
}

export function suscribirPenas(callback) {
  if (firebaseReady && db) {
    const q = query(collection(db, 'penas'), orderBy('fechaDesde', 'asc'))
    return onSnapshot(
      q,
      (snap) => {
        callback(snap.docs.map((item) => ({ id: item.id, ...item.data(), fuente: 'vecinos' })))
      },
      () => callback(leerLocal().map((pena) => ({ ...pena, fuente: pena.fuente || 'vecinos' }))),
    )
  }

  const refresh = () => callback(leerLocal().map((pena) => ({ ...pena, fuente: pena.fuente || 'vecinos' })))
  refresh()
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) refresh()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('penas-local-updated', refresh)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('penas-local-updated', refresh)
  }
}

export async function obtenerPena(id) {
  const web = leerWeb().find((pena) => pena.id === id)
  if (web) return web
  if (firebaseReady && db) {
    const snap = await getDoc(doc(db, 'penas', id))
    if (snap.exists()) return { id: snap.id, ...snap.data(), fuente: 'vecinos' }
  }
  return leerLocal().find((pena) => pena.id === id) || null
}

export async function guardarPena(datos, flyerFile, usuario) {
  let flyerUrl = datos.flyerUrl || ''
  if (flyerFile) {
    flyerUrl = firebaseReady && storage ? await subirFlyer(flyerFile, usuario.uid) : await archivoADataUrl(flyerFile)
  }

  const payload = {
    fuente: 'vecinos',
    tipoEvento: datos.tipoEvento,
    musicos: datos.musicos.filter(Boolean),
    gruposBaile: datos.gruposBaile.filter(Boolean),
    provincia: datos.provincia,
    localidad: datos.localidad,
    ciudad: datos.ciudad,
    lat: Number(datos.lat),
    lng: Number(datos.lng),
    valorAnticipada: datos.valorAnticipada === '' ? null : Number(datos.valorAnticipada),
    valorPuerta: datos.valorPuerta === '' ? null : Number(datos.valorPuerta),
    reservaMesa: Boolean(datos.reservaMesa),
    institucion: datos.institucion,
    fechaDesde: datos.fechaDesde,
    fechaHasta: datos.fechaHasta,
    horario: datos.horario,
    flyerUrl,
    creadoPor: {
      uid: usuario.uid,
      nombre: usuario.displayName || usuario.nombre || 'Vecino',
      email: usuario.email || '',
    },
  }

  if (firebaseReady && db) {
    const refDoc = await addDoc(collection(db, 'penas'), {
      ...payload,
      createdAt: serverTimestamp(),
    })
    return { id: refDoc.id, ...payload }
  }

  const pena = { id: crypto.randomUUID(), ...payload, createdAt: Date.now() }
  escribirLocal([pena, ...leerLocal()])
  window.dispatchEvent(new Event('penas-local-updated'))
  return pena
}

const WEB_KEY = 'dondehaypena.web'

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

async function subirFlyer(file, uid) {
  const path = `flyers/${uid}/${Date.now()}-${file.name}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}

function archivoADataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
