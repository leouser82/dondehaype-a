import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import MapaPenas from '../components/MapaPenas'
import PenaCard from '../components/PenaCard'
import { useAuth } from '../lib/auth'
import { recordarWeb, suscribirPenas } from '../lib/db'
import { distanciaKm, estaVigente, pedirUbicacion } from '../lib/geo'
import { buscarPenasWeb } from '../lib/webPenas'

const RADIO_KM = 100

function mergeUnicas(listas) {
  const seen = new Set()
  const out = []
  for (const pena of listas.flat()) {
    if (!pena?.id || seen.has(pena.id)) continue
    seen.add(pena.id)
    out.push(pena)
  }
  return out
}

export default function Home() {
  const { usuario } = useAuth()
  const [locales, setLocales] = useState([])
  const [web, setWeb] = useState([])
  const [origen, setOrigen] = useState(null)
  const [gps, setGps] = useState('pidiendo')
  const [mensajeGps, setMensajeGps] = useState('Detectando tu ubicación…')
  const [buscandoWeb, setBuscandoWeb] = useState(false)

  useEffect(() => suscribirPenas(setLocales), [])

  useEffect(() => {
    pedirUbicacion()
      .then((coords) => {
        setOrigen(coords)
        setGps('ok')
      })
      .catch(() => {
        setGps('error')
        setMensajeGps('No pudimos usar el GPS. Permití la ubicación o buscá por localidad.')
      })
  }, [])

  useEffect(() => {
    if (!origen) return undefined
    let cancel = false
    setBuscandoWeb(true)
    buscarPenasWeb({ lat: origen.lat, lng: origen.lng, km: RADIO_KM })
      .then((list) => {
        if (cancel) return
        recordarWeb(list)
        setWeb(list)
      })
      .catch(() => {
        if (!cancel) setWeb([])
      })
      .finally(() => {
        if (!cancel) setBuscandoWeb(false)
      })
    return () => {
      cancel = true
    }
  }, [origen])

  const cercanas = useMemo(() => {
    if (!origen) return []
    return mergeUnicas([locales, web])
      .filter((pena) => estaVigente(pena))
      .filter((pena) => distanciaKm(origen, pena) <= RADIO_KM)
      .sort((a, b) => distanciaKm(origen, a) - distanciaKm(origen, b))
  }, [locales, web, origen])

  return (
    <section className="page">
      <div className="hero-rural">
        <p className="kicker">Alrededor del fogón</p>
        <h1>Peñas y eventos cerca tuyo</h1>
        <p className="lead">
          Entrá y mirá qué baile, peña, doma o tertulia sigue vigente cerca tuyo.
        </p>
        {gps === 'error' ? <p className="gps-status error">{mensajeGps}</p> : null}
        {buscandoWeb ? <p className="hint">Buscando peñas reales en internet…</p> : null}
        {usuario ? (
          <p>
            <Link className="primary" to="/nueva">
              Publicar una peña
            </Link>
          </p>
        ) : null}
      </div>

      {origen ? <MapaPenas penas={cercanas} centro={origen} radioKm={RADIO_KM} /> : null}

      {gps === 'ok' && !buscandoWeb && cercanas.length === 0 ? (
        <p className="empty">No hay peñas vigentes a 100 km. Publicá la tuya o buscá en otro pago.</p>
      ) : null}

      <div className="grid-cards">
        {cercanas.map((pena) => (
          <PenaCard key={pena.id} pena={pena} origen={origen} />
        ))}
      </div>
    </section>
  )
}
