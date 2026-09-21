const UA =
  'DondeHayPena/1.0 (prototype; folklore events; https://localhost) Mozilla/5.0'

export async function fetchText(url, { timeoutMs = 10000, referer } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = {
      'User-Agent': UA,
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-AR,es;q=0.9,en;q=0.5',
    }
    if (referer) headers.Referer = referer
    const response = await fetch(url, { headers, signal: controller.signal, redirect: 'follow' })
    if (!response.ok) return ''
    return await response.text()
  } catch {
    return ''
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchJson(url, options = {}) {
  const raw = await fetchText(url, options)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
