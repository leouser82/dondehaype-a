import { useState } from 'react'

export default function TagInput({ label, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('')

  function add() {
    const value = draft.trim()
    if (!value) return
    onChange([...values, value])
    setDraft('')
  }

  return (
    <label className="field">
      {label}
      <div className="tag-row">
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="ghost" onClick={add}>
          Sumar
        </button>
      </div>
      <ul className="chips">
        {values.map((item, index) => (
          <li key={`${item}-${index}`}>
            {item}
            <button
              type="button"
              aria-label={`Quitar ${item}`}
              onClick={() => onChange(values.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </label>
  )
}
