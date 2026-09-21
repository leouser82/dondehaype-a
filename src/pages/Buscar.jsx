import { useEffect, useMemo, useState } from 'react'
import PenaCard from '../components/PenaCard'
import { PROVINCIAS, TIPOS_EVENTO } from '../data/provincias'
import { recordarWeb, suscribirPenas } from '../lib/db'
import { coincideFiltro, estaVigente } from '../lib/geo'
import { buscarPenasWeb } from '../lib/webPenas'

export default function Buscar() {
  const [locales, setLocales] = useState([])
  const [web, setWeb] = useState([])
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [provincia, setProvincia] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [musico, setMusico] = useState('')
  const [buscandoWeb, setBuscandoWeb] = useState(false)

  useEffect(() => suscribirPenas(setLocales), [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscandoWeb(true)
      buscarPenasWeb({ q, tipo, provincia, localidad, musico })
        .then((list) => {
          recordarWeb(list)
          setWeb(list)
        })
        .catch(() => setWeb([]))
        .finally(() => setBuscandoWeb(false))
    }, 500)
    return () => clearTimeout(timer)
  }, [q, tipo, provincia, localidad, musico])

  const resultados = useMemo(() => {
    const filtro = { q, tipo, provincia, localidad, musico }
    const seen = new Set()
    return [...locales, ...web].filter((pena) => {
      if (!pena?.id || seen.has(pena.id)) return false
      seen.add(pena.id)
      return estaVigente(pena) && coincideFiltro(pena, filtro)
    })
  }, [locales, web, q, tipo, provincia, localidad, musico])

  return (
    <section className="page">
      <h1>Buscar peñas</h1>
      <p className="lead">Filtrá por localidad, músicos, tipo o el pago que se te ocurra. Sumamos lo cargado por la gente y lo que aparece en internet.</p>
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en todo" />
        <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} placeholder="Localidad o ciudad" />
        <input value={musico} onChange={(e) => setMusico(e.target.value)} placeholder="Músico o grupo" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS_EVENTO.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={provincia} onChange={(e) => setProvincia(e.target.value)}>
          <option value="">Todas las provincias</option>
          {PROVINCIAS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </form>
      <p className="count">
        {buscandoWeb
          ? 'Buscando en internet…'
          : resultados.length === 1
            ? '1 peña vigente'
            : `${resultados.length} peñas vigentes`}
      </p>
      <div className="grid-cards">
        {resultados.map((pena) => (
          <PenaCard key={pena.id} pena={pena} />
        ))}
      </div>
    </section>
  )
}
