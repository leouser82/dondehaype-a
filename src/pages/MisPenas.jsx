import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PenaCard from '../components/PenaCard'
import LoginMenu from '../components/LoginMenu'
import { useAuth } from '../lib/auth'
import { borrarPena, misPenas } from '../lib/db'

export default function MisPenas() {
  const { usuario, cargando } = useAuth()
  const [penas, setPenas] = useState([])
  const [error, setError] = useState('')
  const [cargandoLista, setCargandoLista] = useState(true)

  async function cargar() {
    if (!usuario) {
      setPenas([])
      setCargandoLista(false)
      return
    }
    setCargandoLista(true)
    setError('')
    try {
      setPenas(await misPenas(usuario.uid))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar tus peñas.')
    } finally {
      setCargandoLista(false)
    }
  }

  useEffect(() => {
    if (cargando) return undefined
    cargar()
    return undefined
  }, [usuario, cargando])

  async function onBorrar(pena) {
    if (!window.confirm(`¿Borrar “${pena.institucion}”? Esta acción no se puede deshacer.`)) return
    try {
      await borrarPena(pena.id, usuario)
      setPenas((prev) => prev.filter((item) => item.id !== pena.id))
    } catch (err) {
      setError(err.message || 'No se pudo borrar la peña.')
    }
  }

  if (cargando) return <section className="page">Cargando…</section>

  if (!usuario) {
    return (
      <section className="page">
        <h1>Mis peñas</h1>
        <p className="lead">Entrá con Google para ver, editar o borrar las peñas que cargaste.</p>
        <LoginMenu variant="page" />
      </section>
    )
  }

  return (
    <section className="page">
      <h1>Mis peñas</h1>
      <p className="lead">Acá están las que publicaste vos. Podés editarlas o borrarlas.</p>
      <p>
        <Link className="primary" to="/nueva">
          Publicar una peña
        </Link>
      </p>
      {error ? <p className="error">{error}</p> : null}
      {cargandoLista ? <p className="hint">Cargando tus fogones…</p> : null}
      {!cargandoLista && !error && penas.length === 0 ? (
        <p className="empty">Todavía no cargaste peñas. Publicá la primera.</p>
      ) : null}
      <div className="grid-cards">
        {penas.map((pena) => (
          <div key={pena.id} className="mis-pena">
            <PenaCard pena={pena} />
            <div className="mis-actions">
              <Link className="ghost" to={`/pena/${pena.id}/editar`}>
                Editar
              </Link>
              <button type="button" className="danger" onClick={() => onBorrar(pena)}>
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
