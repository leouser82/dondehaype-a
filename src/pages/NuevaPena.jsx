import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MapPicker from '../components/MapPicker'
import TagInput from '../components/TagInput'
import { PROVINCIAS, TIPOS_EVENTO } from '../data/provincias'
import LoginMenu from '../components/LoginMenu'
import { useAuth } from '../lib/auth'
import { guardarPena } from '../lib/db'

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
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(VACIO)
  const [flyer, setFlyer] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!usuario) {
    return (
      <section className="page">
        <h1>Publicar una peña</h1>
        <p className="lead">Para cargar un fogón tenés que hacer login. Elegí Google para entrar.</p>
        <LoginMenu variant="page" />
      </section>
    )
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    if (!form.provincia || !form.localidad || !form.ciudad) {
      setError('Completá provincia, localidad y ciudad.')
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
      const pena = await guardarPena(form, flyer, usuario)
      navigate(`/pena/${pena.id}`)
    } catch (err) {
      setError(err.message || 'No se pudo guardar la peña.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="page form-page">
      <h1>Publicar una peña</h1>
      <p className="lead">Completá los datos del fogón para que la vecindad la encuentre.</p>
      <form className="pena-form" onSubmit={onSubmit}>
        <label className="field">
          Flyer (imagen)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              setFlyer(file || null)
              setPreview(file ? URL.createObjectURL(file) : '')
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
          <label className="field">
            Provincia
            <select value={form.provincia} onChange={(e) => set('provincia', e.target.value)} required>
              <option value="">Elegí provincia</option>
              {PROVINCIAS.map((provincia) => (
                <option key={provincia} value={provincia}>
                  {provincia}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Localidad
            <input value={form.localidad} onChange={(e) => set('localidad', e.target.value)} required />
          </label>
          <label className="field">
            Ciudad
            <input value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} required />
          </label>
          <label className="field">
            Institución organizadora
            <input value={form.institucion} onChange={(e) => set('institucion', e.target.value)} required />
          </label>
        </div>

        <fieldset>
          <legend>Ubicación exacta</legend>
          <MapPicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => setForm((prev) => ({ ...prev, lat, lng }))}
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
        <button type="submit" className="primary" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Publicar peña'}
        </button>
      </form>
    </section>
  )
}
