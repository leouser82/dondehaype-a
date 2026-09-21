import { Link } from 'react-router-dom'
import { distanciaKm, formatearFecha, formatearPrecio } from '../lib/geo'

export default function PenaCard({ pena, origen }) {
  const km =
    origen && pena.lat != null ? distanciaKm(origen, { lat: pena.lat, lng: pena.lng }) : null

  return (
    <article className="pena-card">
      <div
        className="flyer"
        style={pena.flyerUrl ? { backgroundImage: `url(${pena.flyerUrl})` } : undefined}
      >
        <span className="tipo">{pena.tipoEvento}</span>
        <span className={`origen ${pena.fuente === 'internet' ? 'web' : 'vecinos'}`}>
          {pena.fuente === 'internet' ? 'Internet' : 'Vecinos'}
        </span>
      </div>
      <div className="body">
        <h3>{pena.institucion || `${pena.tipoEvento} en ${pena.localidad}`}</h3>
        <p className="lugar">
          {pena.localidad}
          {pena.ciudad && pena.ciudad !== pena.localidad ? ` · ${pena.ciudad}` : ''} · {pena.provincia}
        </p>
        <p className="cuando">
          {formatearFecha(pena.fechaDesde)}
          {pena.fechaHasta !== pena.fechaDesde ? ` al ${formatearFecha(pena.fechaHasta)}` : ''}
          {pena.horario ? ` · ${pena.horario} hs` : ''}
        </p>
        {pena.musicos?.length ? <p className="tags">{pena.musicos.join(' · ')}</p> : null}
        {pena.resumen ? <p className="hint">{pena.resumen}</p> : null}
        {pena.valorAnticipada != null || pena.valorPuerta != null ? (
          <p className="precio">
            Anticipada {formatearPrecio(pena.valorAnticipada)} · Puerta {formatearPrecio(pena.valorPuerta)}
          </p>
        ) : null}
        <div className="card-foot">
          {km != null && Number.isFinite(km) ? <span>{km.toFixed(0)} km</span> : <span />}
          <Link to={`/pena/${pena.id}`}>Ver peña</Link>
        </div>
      </div>
    </article>
  )
}
