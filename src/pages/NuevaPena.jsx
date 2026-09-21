import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MapPicker from '../components/MapPicker'
import TagInput from '../components/TagInput'
import { TIPOS_EVENTO } from '../data/provincias'
import LoginMenu from '../components/LoginMenu'
import { useAuth } from '../lib/auth'
import { actualizarPena, esMia, guardarPena, obtenerPena } from '../lib/db'

const VACIO = {
  tipoEvento: 'Peña',
  musicos: [],
  gruposBaile: [],
  provincia: '',
  localidad: '',
  ciudad: '',
  lat: null,
  lng: null,
  valorAnticipada: '',
  valorPuerta: '',
  reservaMesa: false,
  institucion: '',
  fechaDesde: '',
  fechaHasta: '',
  horario: '21:00',
}

export default function NuevaPena() {
  const { id } = useParams()
  const { usuario, cargando } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(VACIO)
  const [flyer, setFlyer] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [leyendoLugar, setLeyendoLugar] = useState(false)
  const [cargandoPena, setCargandoPena] = useState(Boolean(id))

  useEffect(() => {
    if (!id) {
      setForm(VACIO)
      setPreview('')
      setCargandoPena(false)
      return undefined
    }
    let cancel = false
    setCargandoPena(true)
    obtenerPena(id)
      .then((pena) => {
        if (cancel) return
        if (!pena || pena.fuente === 'internet') {
          setError('No encontramos esa peña.')
          return
        }
        if (usuario && !esMia(pena, usuario)) {
          setError('Solo podés editar las peñas que cargaste vos.')
          return
        }
        setForm({
          tipoEvento: pena.tipoEvento || 'Peña',
          musicos: pena.musicos || [],
          gruposBaile: pena.gruposBaile || [],
          provincia: pena.provincia || '',
          localidad: pena.localidad || '',
          ciudad: pena.ciudad || '',
          lat: pena.lat,
          lng: pena.lng,
          valorAnticipada: pena.valorAnticipada ?? '',
          valorPuerta: pena.valorPuerta ?? '',
          reservaMesa: Boolean(pena.reservaMesa),
          institucion: pena.institucion || '',
          fechaDesde: pena.fechaDesde || '',
          fechaHasta: pena.fechaHasta || '',
          horario: pena.horario || '21:00',
          flyerUrl: pena.flyerUrl || '',
        })
        setPreview(pena.flyerUrl || '')
      })
      .catch(() => {
        if (!cancel) setError('No se pudo cargar la peña.')
      })
      .finally(() => {
        if (!cancel) setCargandoPena(false)
      })
    return () => {
      cancel = true
    }
  }, [id, usuario])

  if (cargando) return <section className="page">Cargando…</section>

  if (!usuario) {
    return (
      <section className="page">
        <h1>{id ? 'Editar peña' : 'Publicar una peña'}</h1>
        <p className="lead">Para cargar un fogón tenés que hacer login. Elegí Google para entrar.</p>
        <LoginMenu variant="page" />
      </section>
    )
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function onPickMap(lat, lng) {
    setForm((prev) => ({ ...prev, lat, lng }))
    setLeyendoLugar(true)
    setError('')
    try {
      const response = await fetch(`/api/reverse-geo?lat=${lat}&lng=${lng}`)
      const place = await response.json()
      if (!response.ok) throw new Error(place.error || 'No se pudo leer el lugar')
      setForm((prev) => ({
        ...prev,
        lat,
        lng,
        provincia: place.provincia || prev.provincia,
        localidad: place.localidad || prev.localidad,
        ciudad: place.ciudad || prev.ciudad,
        institucion: place.institucion || prev.institucion,
      }))
    } catch (err) {
      setError(err.message || 'No se pudo leer el lugar del mapa.')
    } finally {
      setLeyendoLugar(false)
    }
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.provincia || !form.localidad || !form.ciudad || !form.institucion) {
      setError('Marcá el lugar en el mapa para completar provincia, localidad, ciudad e institución.')
      return
    }
    if (form.lat == null || form.lng == null) {
      setError('Marcá el punto exacto en el mapa.')
      return
    }
    if (!form.fechaDesde || !form.fechaHasta) {
      setError('Indicá fecha desde y hasta.')
      return
    }
    if (form.fechaHasta < form.fechaDesde) {
      setError('La fecha hasta no puede ser anterior a la fecha desde.')
      return
    }
    setEnviando(true)
    try {
      const pena = id
        ? await actualizarPena(id, form, flyer, usuario)
        : await guardarPena(form, flyer, usuario)
      navigate(`/pena/${pena.id}`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la peña.')
    } finally {
      setEnviando(false)
    }
  }

  if (cargandoPena) return <section className="page">Cargando el fogón…</section>

  return (
    <section className="page form-page">
      <h1>{id ? 'Editar peña' : 'Publicar una peña'}</h1>
      <p className="lead">
        {id
          ? 'Actualizá los datos del fogón. El lugar se cambia haciendo clic en el mapa.'
          : 'Completá los datos del fogón. El mapa se ubica donde estás; al marcar el evento se completan los campos de arriba.'}
      </p>
      <form className="pena-form" onSubmit={onSubmit}>
        <label className="field">
          Flyer (imagen)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setFlyer(file || null)
              setPreview(file ? URL.createObjectURL(file) : form.flyerUrl || '')
            }}
          />
        </label>
        {preview ? <img className="flyer-preview" src={preview} alt="Vista previa del flyer" /> : null}

        <fieldset>
          <legend>Tipo de evento</legend>
          <div className="tipo-grid">
            {TIPOS_EVENTO.map((tipo) => (
              <label key={tipo} className={form.tipoEvento === tipo ? 'on' : ''}>
                <input
                  type="radio"
                  name="tipo"
                  value={tipo}
                  checked={form.tipoEvento === tipo}
                  onChange={() => set('tipoEvento', tipo)}
                />
                {tipo}
              </label>
            ))}
          </div>
        </fieldset>

        <TagInput
          label="Músicos / grupos musicales"
          values={form.musicos}
          onChange={(musicos) => set('musicos', musicos)}
          placeholder="Ej: Los Chalchaleros"
        />
        <TagInput
          label="Grupos de baile"
          values={form.gruposBaile}
          onChange={(gruposBaile) => set('gruposBaile', gruposBaile)}
          placeholder="Ej: Ballet El Algarrobo"
        />

        <div className="grid-2">
          <label className="field locked">
            Provincia
            <input value={form.provincia} readOnly placeholder="Se completa con el mapa" />
          </label>
          <label className="field locked">
            Localidad
            <input value={form.localidad} readOnly placeholder="Se completa con el mapa" />
          </label>
          <label className="field locked">
            Ciudad
            <input value={form.ciudad} readOnly placeholder="Se completa con el mapa" />
          </label>
          <label className="field locked">
            Institución organizadora
            <input value={form.institucion} readOnly placeholder="Se completa con el mapa" />
          </label>
        </div>
        {leyendoLugar ? <p className="hint">Leyendo el lugar del mapa…</p> : null}

        <fieldset>
          <legend>Ubicación exacta</legend>
          <MapPicker
            lat={form.lat}
            lng={form.lng}
            locateUser={!id}
            onChange={onPickMap}
          />
        </fieldset>

        <div className="grid-2">
          <label className="field">
            Fecha desde
            <input type="date" value={form.fechaDesde} onChange={(e) => set('fechaDesde', e.target.value)} required />
          </label>
          <label className="field">
            Fecha hasta
            <input type="date" value={form.fechaHasta} onChange={(e) => set('fechaHasta', e.target.value)} required />
          </label>
          <label className="field">
            Horario
            <input type="time" value={form.horario} onChange={(e) => set('horario', e.target.value)} required />
          </label>
          <label className="field">
            ¿Se puede reservar mesa?
            <select
              value={form.reservaMesa ? 'si' : 'no'}
              onChange={(e) => set('reservaMesa', e.target.value === 'si')}
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="field">
            Valor entrada anticipada
            <input
              type="number"
              min="0"
              step="100"
              value={form.valorAnticipada}
              onChange={(e) => set('valorAnticipada', e.target.value)}
            />
          </label>
          <label className="field">
            Valor entrada en puerta
            <input
              type="number"
              min="0"
              step="100"
              value={form.valorPuerta}
              onChange={(e) => set('valorPuerta', e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="primary" disabled={enviando || leyendoLugar}>
          {enviando ? 'Guardando…' : id ? 'Guardar cambios' : 'Publicar peña'}
        </button>
      </form>
    </section>
  )
}
