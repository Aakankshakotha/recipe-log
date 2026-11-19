import { useState, type FormEvent } from 'react'
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe } from '../types'
import { capitalize, newId, todayISO } from '../store'

interface Props {
  recipes: Recipe[]
  initial?: Partial<MealEntry>
  onSave: (meal: MealEntry) => void
  onCancel: () => void
  onDelete?: () => void
}

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  return 'dinner'
}

export function MealForm({ recipes, initial, onSave, onCancel, onDelete }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayISO())
  const [mealType, setMealType] = useState<MealType>(initial?.mealType ?? guessMealType())
  const [recipeId, setRecipeId] = useState(initial?.recipeId ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const sorted = [...recipes].sort((a, b) => a.name.localeCompare(b.name))
  const canSave = Boolean(recipeId || description.trim())

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    onSave({
      id: initial?.id ?? newId(),
      date,
      mealType,
      recipeId: recipeId || null,
      description: description.trim(),
      rating,
      notes: notes.trim(),
    })
  }

  return (
    <form className="card form" onSubmit={submit}>
      <h2>{initial?.id ? 'Edit meal' : 'Log a meal'}</h2>
      <div className="row">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Meal
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {capitalize(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Recipe
        <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          <option value="">— Not from a saved recipe —</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {recipeId ? 'Extra details' : 'What did you eat? *'}
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={recipeId ? 'e.g. with rice and salad' : 'e.g. Pizza from Luigi’s'}
        />
      </label>
      <div className="field">
        <span>Rating</span>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              className={`ghost star ${rating != null && n <= rating ? 'on' : ''}`}
              onClick={() => setRating(rating === n ? null : n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
            >
              {rating != null && n <= rating ? '★' : '☆'}
            </button>
          ))}
        </div>
      </div>
      <label>
        Notes
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="actions">
        {onDelete && (
          <button type="button" className="danger ghost" onClick={onDelete}>
            Delete
          </button>
        )}
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" disabled={!canSave}>
          Save meal
        </button>
      </div>
    </form>
  )
}
