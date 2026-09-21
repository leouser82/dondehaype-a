export async function buscarPenasWeb(params = {}) {
  const url = new URL('/api/penas-web', window.location.origin)
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url)
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data.penas) ? data.penas : []
}
