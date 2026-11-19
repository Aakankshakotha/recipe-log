import { useState, type FormEvent } from 'react'
import type { Recipe } from '../types'
import { newId } from '../store'

interface Props {
  initial?: Recipe
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))

export function RecipeForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [prep, setPrep] = useState(initial?.prepMinutes?.toString() ?? '')
  const [servings, setServings] = useState(initial?.servings?.toString() ?? '')
  const [ingredients, setIngredients] = useState(initial?.ingredients.join('\n') ?? '')
  const [steps, setSteps] = useState(initial?.steps.join('\n') ?? '')
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      favorite: initial?.favorite ?? false,
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
    <form className="card form" onSubmit={submit}>
      <h2>{initial ? 'Edit recipe' : 'New recipe'}</h2>
      <label>
        Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <div className="row">
        <label>
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Curry, Breakfast, Dessert"
          />
        </label>
        <label>
          Prep time (min)
          <input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </label>
        <label>
          Servings
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </label>
      </div>
      <label>
        Ingredients <span className="hint">one per line</span>
        <textarea rows={6} value={ingredients} onChange={(e) => setIngredients(e.target.value)} />
      </label>
      <label>
        Steps <span className="hint">one per line</span>
        <textarea rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <label>
        Tags <span className="hint">comma separated</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="vegetarian, quick, kids"
        />
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
