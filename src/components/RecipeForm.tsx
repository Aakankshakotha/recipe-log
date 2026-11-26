import { Check, ChevronRight, Lightbulb, Plus, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { MealType, Recipe } from '../types'
import { newId, useStore } from '../store'
import { splitIngredient } from '../lib/ingredients'
import { todayISO } from '../lib/dates'
import { RATING_LABELS } from '../lib/rating'
import { DishImage, PhotoTile, Stars } from './ui'

/** What the "How was it?" card records when a brand-new recipe is logged as eaten. */
export interface LoggedMeal {
  date: string
  mealType: MealType
  rating: number | null
  notes: string
}

interface Props {
  initial?: Partial<Recipe>
  onSave: (recipe: Recipe, logged?: LoggedMeal) => void
  onCancel: () => void
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim().replace(/^([-*•]|\d+[.)])\s+/, ''))
    .filter(Boolean)

const toNumber = (v: string) => (v.trim() === '' ? null : Number(v))

const STARTER_TAGS = ['weeknight', 'quick', 'comfort food', 'baking', 'vegetarian', 'party', 'kids']

function guessMealType(category: string): MealType {
  const c = category.toLowerCase()
  if (/breakfast|brunch|pancake/.test(c)) return 'breakfast'
  if (/lunch|salad|sandwich/.test(c)) return 'lunch'
  if (/snack|dessert|baking/.test(c)) return 'snack'
  return 'dinner'
}

export function RecipeForm({ initial, onSave, onCancel }: Props) {
  const isNew = !initial?.id
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [date, setDate] = useState(todayISO())
  const [prep, setPrep] = useState(initial?.prepMinutes?.toString() ?? '')
  const [servings, setServings] = useState(initial?.servings ?? 2)
  const [ingredients, setIngredients] = useState<[string, string][]>(() => {
    const rows = (initial?.ingredients ?? []).map(splitIngredient)
    return rows.length ? rows : [['', ''], ['', '']]
  })
  const [steps, setSteps] = useState<string[]>(() => (initial?.steps?.length ? initial.steps : ['']))
  const { data } = useStore()
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const addTags = (text: string) => {
    const next = text
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t && !tags.includes(t))
    if (next.length) setTags([...tags, ...new Set(next)])
    setTagDraft('')
  }
  // Tags you already use first, then a few ideas to get started
  const tagIdeas = [...new Set([...data.recipes.flatMap((r) => r.tags), ...STARTER_TAGS])]
    .filter((t) => !tags.includes(t))
    .slice(0, 8)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [rating, setRating] = useState<number | null>(null)
  const [photoId, setPhotoId] = useState<string | null>(initial?.photoId ?? null)

  const setIngredient = (i: number, part: 0 | 1, value: string) =>
    setIngredients(ingredients.map((row, idx) => (idx === i ? (part === 0 ? [value, row[1]] : [row[0], value]) : row)))
  const setStep = (i: number, value: string) => setSteps(steps.map((s, idx) => (idx === i ? value : s)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const recipe: Recipe = {
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      favorite: initial?.favorite ?? false,
      photoId,
      name: name.trim(),
      category: category.trim(),
      prepMinutes: toNumber(prep),
      servings,
      ingredients: ingredients.map(([q, n]) => `${q} ${n}`.trim()).filter(Boolean),
      steps: lines(steps.join('\n')),
      tags: [...new Set([...tags, ...tagDraft.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)])],
      // For a new recipe the note belongs to this first cook; when editing it's the recipe's own note
      notes: isNew ? '' : notes.trim(),
    }
    onSave(recipe, isNew ? { date, mealType: guessMealType(category), rating, notes } : undefined)
  }

  return (
    <form className="recipe-form" onSubmit={submit}>
      <header className="detail-top">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button type="button" className="crumb" onClick={onCancel}>
              Journal
            </button>
            <ChevronRight size={13} aria-hidden />
            <span>{isNew ? 'New entry' : 'Edit'}</span>
          </nav>
          <h2>{isNew ? 'Log a recipe' : 'Edit recipe'}</h2>
        </div>
        <div className="detail-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>
            <Check size={16} aria-hidden /> Save
          </button>
        </div>
      </header>

      <div className="detail-layout form-layout">
        <div className="detail-main">
          <section className="card basics">
            <PhotoTile photoId={photoId} onChange={setPhotoId} />
            <div className="basics-fields">
              <input
                className="name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="What did you make?"
                aria-label="Recipe name"
                autoFocus={!initial?.name}
                required
              />
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category, e.g. Dinner"
                aria-label="Category"
                list="categories"
              />
              <div className="tag-field">
                <div className="tag-input">
                  {tags.map((t) => (
                    <span key={t} className="tag removable">
                      {t}
                      <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                        <X size={11} aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagDraft}
                    onChange={(e) => (e.target.value.endsWith(',') ? addTags(e.target.value) : setTagDraft(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && tagDraft.trim()) {
                        e.preventDefault()
                        addTags(tagDraft)
                      } else if (e.key === 'Backspace' && !tagDraft && tags.length) setTags(tags.slice(0, -1))
                    }}
                    onBlur={() => tagDraft.trim() && addTags(tagDraft)}
                    placeholder={tags.length ? 'Add another…' : 'Tags: weeknight, baking… (groups into Collections)'}
                    aria-label="Tags"
                  />
                </div>
                {tagIdeas.length > 0 && (
                  <div className="tag-ideas">
                    {tagIdeas.map((t) => (
                      <button type="button" key={t} className="chip small" onClick={() => addTags(t)}>
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mini-fields">
                {isNew && (
                  <label className="mini">
                    <span>Date</span>
                    <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
                  </label>
                )}
                <label className="mini">
                  <span>Time</span>
                  <input
                    type="number"
                    min={0}
                    value={prep}
                    onChange={(e) => setPrep(e.target.value)}
                    placeholder="e.g. 30 min"
                  />
                </label>
                <div className="mini">
                  <span>Serves</span>
                  <div className="mini-stepper">
                    <button type="button" aria-label="Fewer servings" onClick={() => setServings(Math.max(1, servings - 1))}>
                      −
                    </button>
                    <output>{servings}</output>
                    <button type="button" aria-label="More servings" onClick={() => setServings(servings + 1)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h3>Ingredients</h3>
              <button type="button" className="link-btn" onClick={() => setIngredients([...ingredients, ['', '']])}>
                <Plus size={14} aria-hidden /> Add
              </button>
            </div>
            <div className="form-rows">
              {ingredients.map(([qty, item], i) => (
                <div key={i} className="ingredient-row">
                  <input value={qty} onChange={(e) => setIngredient(i, 0, e.target.value)} placeholder="Qty" aria-label="Quantity" />
                  <input value={item} onChange={(e) => setIngredient(i, 1, e.target.value)} placeholder="Ingredient" aria-label="Ingredient" />
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn small row-remove"
                      aria-label="Remove ingredient"
                      onClick={() => setIngredients(ingredients.filter((_, idx) => idx !== i))}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h3>Method</h3>
              <button type="button" className="link-btn" onClick={() => setSteps([...steps, ''])}>
                <Plus size={14} aria-hidden /> Add step
              </button>
            </div>
            <div className="form-rows">
              {steps.map((step, i) => (
                <div key={i} className="step-row">
                  <span className="step-num">{i + 1}</span>
                  <input value={step} onChange={(e) => setStep(i, e.target.value)} placeholder="Describe this step…" aria-label={`Step ${i + 1}`} />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn small row-remove"
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <h3>How was it?</h3>
              {isNew && (
                <div className="rate-inline">
                  <span className="muted small">{rating ? RATING_LABELS[rating] : 'Tap to rate'}</span>
                  <Stars value={rating} onChange={setRating} />
                </div>
              )}
            </div>
            <div className="form-rows">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isNew ? 'A note about how it went (optional)' : 'Notes for next time'}
                aria-label="Note for next time"
              />
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <section className="card preview-card">
            <h4>Preview</h4>
            <DishImage photoId={photoId} name={name || 'recipe'} category={category} className="preview-photo" />
            <strong className={`preview-title ${name.trim() ? '' : 'empty'}`}>{name.trim() || 'Untitled recipe'}</strong>
            <div className="journal-meta muted small">
              <span>
                {prep ? `${prep} min` : '— min'} · Serves {servings}
              </span>
              {isNew && <Stars value={rating} />}
            </div>
          </section>
          {isNew && (
            <section className="notes-card">
              <h4>
                <Lightbulb size={13} aria-hidden /> Quick tip
              </h4>
              <p className="notes">Only the name is required. You can add ingredients and steps later.</p>
            </section>
          )}
        </aside>
      </div>
    </form>
  )
}
