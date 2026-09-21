import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseReady, googleProvider } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorAuth, setErrorAuth] = useState('')

  useEffect(() => {
    localStorage.removeItem('dondehaypena.usuario')
    if (firebaseReady && auth) {
      return onAuthStateChanged(auth, (user) => {
        setUsuario(user)
        setCargando(false)
      })
    }
    setUsuario(null)
    setCargando(false)
  }, [])

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      firebaseReady,
      errorAuth,
      async entrarConGoogle() {
        setErrorAuth('')
        if (!firebaseReady || !auth) {
          setErrorAuth('Para entrar con Google hay que configurar Firebase en el archivo .env')
          return
        }
        try {
          await signInWithPopup(auth, googleProvider)
        } catch (err) {
          setErrorAuth(err.message || 'No se pudo entrar con Google.')
        }
      },
      async salir() {
        setErrorAuth('')
        if (firebaseReady && auth) await signOut(auth)
        setUsuario(null)
      },
    }),
    [usuario, cargando, errorAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
