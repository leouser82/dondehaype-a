import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import LoginMenu from './LoginMenu'

export default function Header() {
  const { usuario, salir, errorAuth } = useAuth()

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          ✦
        </span>
        <span>
          <strong>Donde hay peña</strong>
          <em>el fogón más cercano</em>
        </span>
      </Link>
      <nav>
        <NavLink to="/" end>
          Cerca
        </NavLink>
        <NavLink to="/buscar">Buscar</NavLink>
        {usuario ? <NavLink to="/mis-penas">Mis peñas</NavLink> : null}
        {usuario ? <NavLink to="/nueva">Publicar</NavLink> : null}
      </nav>
      <div className="auth-box">
        {usuario ? (
          <>
            <span className="who">{usuario.displayName || usuario.email}</span>
            <button type="button" className="ghost" onClick={salir}>
              Salir
            </button>
          </>
        ) : (
          <LoginMenu />
        )}
      </div>
      {errorAuth ? <p className="auth-error">{errorAuth}</p> : null}
    </header>
  )
}
