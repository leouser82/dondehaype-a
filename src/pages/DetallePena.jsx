import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { borrarPena, esMia, obtenerPena } from '../lib/db'
import { estaVigente, formatearFecha, formatearPrecio } from '../lib/geo'

export default function DetallePena() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [pena, setPena] = useState(null)
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    obtenerPena(id)
      .then((item) => {
        if (!item) setError('No encontramos esa peña.')
        else setPena(item)
      })
      .catch(() => setError('No se pudo cargar la peña.'))
  }, [id])

  if (!pena && error) return <section className="page">{error}</section>
  if (!pena) return <section className="page">Cargando el fogón…</section>

  const vigente = estaVigente(pena)
  const mia = esMia(pena, usuario)

  async function onBorrar() {
    if (!window.confirm(`¿Borrar “${pena.institucion}”? Esta acción no se puede deshacer.`)) return
    setBorrando(true)
    try {
      await borrarPena(pena.id, usuario)
      navigate('/mis-penas')
    } catch (err) {
      setError(err.message || 'No se pudo borrar la peña.')
      setBorrando(false)
    }
  }

  return (
    <section className="page detalle">
      {pena.flyerUrl ? <img className="detalle-flyer" src={pena.flyerUrl} alt={`Flyer de ${pena.institucion}`} /> : null}
      <p className="kicker">{pena.tipoEvento} {vigente ? '· vigente' : '· ya pasó'}</p>
      <h1>{pena.institucion}</h1>
      <p className="lugar">
        {pena.localidad}
        {pena.ciudad && pena.ciudad !== pena.localidad ? `, ${pena.ciudad}` : ''} · {pena.provincia}
      </p>
      {pena.resumen ? <p className="lead">{pena.resumen}</p> : null}
      <p>
        {formatearFecha(pena.fechaDesde)}
        {pena.fechaHasta !== pena.fechaDesde ? ` al ${formatearFecha(pena.fechaHasta)}` : ''}
        {pena.horario ? ` · ${pena.horario} hs` : ''}
      </p>
      <dl className="ficha">
        <div>
          <dt>Anticipada</dt>
          <dd>{formatearPrecio(pena.valorAnticipada)}</dd>
        </div>
        <div>
          <dt>En puerta</dt>
          <dd>{formatearPrecio(pena.valorPuerta)}</dd>
        </div>
        <div>
          <dt>Reserva de mesa</dt>
          <dd>{pena.reservaMesa ? 'Sí' : 'No'}</dd>
        </div>
      </dl>
      {pena.musicos?.length ? (
        <p>
          <strong>Músicos:</strong> {pena.musicos.join(', ')}
        </p>
      ) : null}
      {pena.gruposBaile?.length ? (
        <p>
          <strong>Grupos de baile:</strong> {pena.gruposBaile.join(', ')}
        </p>
      ) : null}
      {pena.lat != null ? (
        <p>
          <a href={`https://www.google.com/maps?q=${pena.lat},${pena.lng}`} target="_blank" rel="noreferrer">
            Abrir ubicación en Google Maps
          </a>
        </p>
      ) : null}
      <p className="hint">
        {pena.fuente === 'internet'
          ? 'Encontrada en internet y adaptada a este sitio.'
          : `Publicada por ${pena.creadoPor?.nombre || 'un vecino'}.`}
      </p>
      {pena.origenUrl ? (
        <p>
          <a href={pena.origenUrl} target="_blank" rel="noreferrer">
            Ver fuente original
          </a>
        </p>
      ) : null}
      {mia ? (
        <p className="mis-actions">
          <Link className="ghost" to={`/pena/${pena.id}/editar`}>
            Editar
          </Link>
          <button type="button" className="danger" onClick={onBorrar} disabled={borrando}>
            {borrando ? 'Borrando…' : 'Borrar'}
          </button>
        </p>
      ) : null}
      <Link to="/buscar" className="ghost">
        Volver al buscador
      </Link>
    </section>
  )
}
