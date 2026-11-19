import { useState, type FormEvent } from 'react'
import type { Recipe } from '../types'
import { newId } from '../store'
import { PhotoPicker } from './ui'

interface Props {
  initial?: Partial<Recipe>
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean)

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))

export function RecipeForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [prep, setPrep] = useState(initial?.prepMinutes?.toString() ?? '')
  const [servings, setServings] = useState(initial?.servings?.toString() ?? '')
  const [ingredients, setIngredients] = useState(initial?.ingredients?.join('\n') ?? '')
  const [steps, setSteps] = useState(initial?.steps?.join('\n') ?? '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [photoId, setPhotoId] = useState<string | null>(initial?.photoId ?? null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      favorite: initial?.favorite ?? false,
      journal: initial?.journal ?? [],
      photoId,
      name: name.trim(),
      category: category.trim(),
      prepMinutes: toNumber(prep),
      servings: toNumber(servings),
      ingredients: lines(ingredients),
      steps: lines(steps),
      tags: tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      notes: notes.trim(),
    })
  }

  return (
    <form className="card form page-form" onSubmit={submit}>
      <h2>{initial?.id ? 'Edit recipe' : 'New recipe'}</h2>
      <PhotoPicker photoId={photoId} onChange={setPhotoId} />
      <label>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!initial?.name} />
      </label>
      <div className="row">
        <label>
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Curry, Breakfast"
            list="categories"
          />
        </label>
        <label>
          Time (min)
          <input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </label>
        <label>
          Servings
          <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
      </div>
      <label>
        Ingredients <span className="hint">one per line, e.g. “2 cups rice”</span>
        <textarea rows={7} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </label>
      <label>
        Steps <span className="hint">one per line — times like “10 min” become timers in cook mode</span>
        <textarea rows={7} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <label>
        Tags <span className="hint">comma separated</span>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vegetarian, quick, kids" />
      </label>
      <label>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit">Save recipe</button>
      </div>
    </form>
  )
}
