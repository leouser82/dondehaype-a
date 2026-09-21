import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseReady, googleProvider } from './firebase'
import { googleClientReady, loginConGoogleId } from './googleAuth'

const AuthContext = createContext(null)
const LOCAL_USER_KEY = 'dondehaypena.google'

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [errorAuth, setErrorAuth] = useState('')

  useEffect(() => {
    if (firebaseReady && auth) {
      return onAuthStateChanged(auth, (user) => {
        setUsuario(user)
        setCargando(false)
      })
    }
    try {
      const saved = localStorage.getItem(LOCAL_USER_KEY)
      setUsuario(saved ? JSON.parse(saved) : null)
    } catch {
      setUsuario(null)
    }
    setCargando(false)
  }, [])

  const value = useMemo(
    () => ({
      usuario,
      cargando,
      firebaseReady,
      googleClientReady,
      errorAuth,
      async entrarConGoogle() {
        setErrorAuth('')
        try {
          if (firebaseReady && auth) {
            await signInWithPopup(auth, googleProvider)
            return
          }
          if (!googleClientReady) {
            setErrorAuth('Falta el Client ID de Google en el archivo .env')
            return
          }
          const profile = await loginConGoogleId()
          localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(profile))
          setUsuario(profile)
        } catch (err) {
          setErrorAuth(err.message || 'No se pudo entrar con Google.')
        }
      },
      async salir() {
        setErrorAuth('')
        if (firebaseReady && auth) await signOut(auth)
        localStorage.removeItem(LOCAL_USER_KEY)
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
