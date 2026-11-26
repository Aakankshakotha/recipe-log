import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { MealEntry } from '../types'
import { useStore } from '../store'
import { formatDate, todayISO } from '../lib/dates'
import { RATING_LABELS } from '../lib/rating'
import { Photo, PhotoPicker, Stars } from './ui'

export interface CookDetails {
  date: string
  rating: number | null
  notes: string
  photoId: string | null
}

/** A small form for one cook: when, how it went, a note and an optional photo. */
export function CookEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: MealEntry
  onSave: (cook: CookDetails) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [photoId, setPhotoId] = useState<string | null>(initial?.photoId ?? null)

  return (
    <div className="cook-editor">
      <div className="section-head">
        <h3>{initial ? 'Edit this cook' : 'How did it go?'}</h3>
        <div className="rate-inline">
          <span className="muted small">{rating ? RATING_LABELS[rating] : 'Tap to rate'}</span>
          <Stars value={rating} onChange={setRating} />
        </div>
      </div>
      <div className="form-rows">
        <label className="mini">
          <span>Date</span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="A note for next time (optional)" aria-label="Note" />
        <PhotoPicker photoId={photoId} onChange={setPhotoId} label="Add a photo of this cook" />
      </div>
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" onClick={() => onSave({ date, rating, notes: notes.trim(), photoId })}>
          Save
        </button>
      </div>
    </div>
  )
}

/** Every time a recipe was cooked, newest first, with edit and delete. */
export function CookHistory({ cooks }: { cooks: MealEntry[] }) {
  const store = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)

  if (cooks.length === 0) return <p className="muted small">Not cooked yet. Tap “I cooked this” when you do.</p>

  return (
    <ul className="cook-history">
      {cooks.map((c) =>
        editingId === c.id ? (
          <li key={c.id}>
            <CookEditor
              initial={c}
              onCancel={() => setEditingId(null)}
              onSave={(cook) => {
                store.upsert('meals', { ...c, ...cook })
                setEditingId(null)
              }}
            />
          </li>
        ) : (
          <li key={c.id} className="cook-row">
            {c.photoId && <Photo id={c.photoId} alt="" className="cook-thumb" />}
            <div className="cook-body">
              <div className="cook-top">
                <strong>{formatDate(c.date)}</strong>
                {c.rating != null && <Stars value={c.rating} />}
              </div>
              {c.notes && <p className="cook-note">{c.notes}</p>}
            </div>
            <div className="cook-actions">
              <button className="icon-btn small" aria-label="Edit this cook" onClick={() => setEditingId(c.id)}>
                <Pencil size={14} aria-hidden />
              </button>
              <button
                className="icon-btn small"
                aria-label="Delete this cook"
                onClick={() => confirm('Delete this cook from your history?') && store.deleteMeal(c)}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          </li>
        ),
      )}
    </ul>
  )
}
