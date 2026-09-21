const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export const googleClientReady = Boolean(CLIENT_ID)

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google))
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.dataset.googleGis = 'true'
    script.onload = () => resolve(window.google)
    script.onerror = () => reject(new Error('No se pudo cargar Google'))
    document.head.appendChild(script)
  })
}

export async function loginConGoogleId() {
  if (!CLIENT_ID) throw new Error('Falta el Client ID de Google')
  const google = await loadGis()
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: 'openid email profile',
      callback: async (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error))
          return
        }
        try {
          const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          }).then((res) => {
            if (!res.ok) throw new Error('No se pudo leer el perfil de Google')
            return res.json()
          })
          resolve({
            uid: profile.sub,
            displayName: profile.name || 'Cuenta Google',
            email: profile.email || '',
            photoURL: profile.picture || '',
          })
        } catch (error) {
          reject(error)
        }
      },
    })
    client.requestAccessToken({ prompt: 'select_account' })
  })
}
