import { TriangleAlert } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { MEAL_TYPES, type MealEntry, type MealStatus, type MealType } from '../types'
import { itemKey, newId, useStore } from '../store'
import { addDaysISO, capitalize, eatByLabel, formatDate, todayISO } from '../lib/dates'
import { parseIngredient, sameIngredient } from '../lib/ingredients'
import { avoidWarnings, describeWarnings } from '../lib/derived'
import { Modal, PhotoPicker, Segmented, Stars } from './ui'

interface Props {
  initial: Partial<MealEntry>
  onClose: () => void
}

type Source = 'recipe' | 'leftover' | 'other'

function guessMealType(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  return 'dinner'
}

export function MealForm({ initial, onClose }: Props) {
  const store = useStore()
  const { data } = store
  const isNew = !initial.id
  const today = todayISO()

  const [date, setDate] = useState(initial.date ?? today)
  const [mealType, setMealType] = useState<MealType>(initial.mealType ?? guessMealType())
  const [status, setStatus] = useState<MealStatus>(
    initial.status ?? ((initial.date ?? today) > today ? 'planned' : 'eaten'),
  )
  const [source, setSource] = useState<Source>(
    initial.leftoverId ? 'leftover' : initial.recipeId || isNew ? 'recipe' : 'other',
  )
  const [recipeId, setRecipeId] = useState(initial.recipeId ?? '')
  const [leftoverId, setLeftoverId] = useState(initial.leftoverId ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [rating, setRating] = useState<number | null>(initial.rating ?? null)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [photoId, setPhotoId] = useState<string | null>(initial.photoId ?? null)
  const [eatenBy, setEatenBy] = useState<string[]>(
    initial.eatenBy ?? (isNew ? data.members.map((m) => m.id) : []),
  )
  const [extraPortions, setExtraPortions] = useState(0)
  const [usedPantry, setUsedPantry] = useState<string[]>([])

  const recipes = useMemo(
    () => [...data.recipes].sort((a, b) => a.name.localeCompare(b.name)),
    [data.recipes],
  )
  const recipe = source === 'recipe' ? data.recipes.find((r) => r.id === recipeId) : undefined
  // A new meal may arrive pre-set to "eaten" (e.g. "Log eaten"); it still hasn't been logged yet
  const wasEaten = !isNew && initial.status === 'eaten'
  // Only offer leftovers/pantry follow-ups the first time a recipe meal is marked eaten
  const firstTimeEaten = status === 'eaten' && !wasEaten && !!recipe

  const pantryUsed = useMemo(() => {
    if (!recipe) return []
    const keys = recipe.ingredients.map((l) => parseIngredient(l).key).filter(Boolean)
    return data.pantry.filter((p) => keys.some((k) => sameIngredient(k, itemKey(p.name))))
  }, [recipe, data.pantry])

  const warnings = useMemo(() => {
    if (!recipe) return []
    const members = data.members.filter((m) => eatenBy.includes(m.id))
    return avoidWarnings([recipe.name, ...recipe.ingredients], members)
  }, [recipe, eatenBy, data.members])

  const canSave =
    source === 'recipe' ? !!recipeId : source === 'leftover' ? !!leftoverId : !!description.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    const leftover = data.leftovers.find((l) => l.id === leftoverId)
    const meal: MealEntry = {
      id: initial.id ?? newId(),
      date,
      mealType,
      status,
      recipeId: source === 'recipe' ? recipeId : source === 'leftover' ? (leftover?.recipeId ?? initial.recipeId ?? null) : null,
      leftoverId: source === 'leftover' ? leftoverId : null,
      description:
        source === 'leftover'
          ? description.trim() || `${leftover?.name ?? 'Leftovers'} (leftovers)`
          : description.trim(),
      rating: status === 'eaten' ? rating : null,
      notes: notes.trim(),
      photoId,
      eatenBy,
    }
    store.upsert('meals', meal)

    const nowEaten = status === 'eaten' && !wasEaten
    if (nowEaten && source === 'leftover' && leftover) store.takeLeftoverPortion(leftover.id)
    if (firstTimeEaten && recipe && extraPortions > 0) {
      store.addLeftover({
        name: recipe.name,
        recipeId: recipe.id,
        madeOn: date,
        eatBy: addDaysISO(date, 3),
        portions: extraPortions,
      })
    }
    if (firstTimeEaten && usedPantry.length) store.removePantryItems(usedPantry)
    onClose()
  }

  const remove = () => {
    if (!initial.id || !confirm('Delete this meal?')) return
    store.deleteMeal(initial as MealEntry)
    onClose()
  }

  return (
    <Modal title={isNew ? (status === 'planned' ? 'Plan a meal' : 'Log a meal') : 'Edit meal'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'planned', label: 'Planned' },
            { value: 'eaten', label: 'Eaten' },
          ]}
        />
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

        <div className="field">
          <span>What</span>
          <Segmented
            value={source}
            onChange={setSource}
            options={[
              { value: 'recipe', label: 'My recipe' },
              ...(data.leftovers.length || source === 'leftover'
                ? [{ value: 'leftover' as const, label: `Leftovers (${data.leftovers.length})` }]
                : []),
              { value: 'other', label: 'Something else' },
            ]}
          />
        </div>

        {source === 'recipe' && (
          <label>
            Recipe
            <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} autoFocus={isNew}>
              <option value="">— Choose a recipe —</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.favorite ? '★ ' : ''}
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {source === 'leftover' && (
          <label>
            Which leftovers
            <select value={leftoverId} onChange={(e) => setLeftoverId(e.target.value)}>
              <option value="">— Choose —</option>
              {data.leftovers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} · {l.portions} left · {eatByLabel(l.eatBy)}
                </option>
              ))}
              {initial.leftoverId && !data.leftovers.some((l) => l.id === initial.leftoverId) && (
                <option value={initial.leftoverId}>{initial.description || 'Leftovers'} (used up)</option>
              )}
            </select>
          </label>
        )}
        <label>
          {source === 'other' ? 'What did you have? *' : 'Details'}
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={source === 'other' ? 'e.g. Pizza from Luigi’s' : 'e.g. with rice and raita'}
          />
        </label>

        {data.members.length > 0 && (
          <div className="field">
            <span>Who's eating</span>
            <div className="chips">
              {data.members.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={`chip ${eatenBy.includes(m.id) ? 'on' : ''}`}
                  onClick={() =>
                    setEatenBy(eatenBy.includes(m.id) ? eatenBy.filter((x) => x !== m.id) : [...eatenBy, m.id])
                  }
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {warnings.length > 0 && <p className="warning">
            <TriangleAlert size={15} aria-hidden /> Contains foods to avoid — {describeWarnings(warnings)}</p>}

        {status === 'eaten' && (
          <>
            <div className="field">
              <span>How was it?</span>
              <Stars value={rating} onChange={setRating} />
            </div>
            <PhotoPicker photoId={photoId} onChange={setPhotoId} label="Add a photo of the meal" />
          </>
        )}

        {firstTimeEaten && (
          <div className="followups">
            <label className="inline">
              Made extra? Save
              <input
                type="number"
                min={0}
                max={20}
                value={extraPortions}
                onChange={(e) => setExtraPortions(Math.max(0, Number(e.target.value)))}
                className="tiny"
              />
              portions as leftovers
            </label>
            {pantryUsed.length > 0 && (
              <div className="field">
                <span>Used up anything from the pantry?</span>
                <div className="chips">
                  {pantryUsed.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={`chip ${usedPantry.includes(p.id) ? 'on danger' : ''}`}
                      onClick={() =>
                        setUsedPantry(
                          usedPantry.includes(p.id) ? usedPantry.filter((x) => x !== p.id) : [...usedPantry, p.id],
                        )
                      }
                    >
                      {usedPantry.includes(p.id) ? '✕ ' : ''}
                      {p.name}
                    </button>
                  ))}
                </div>
                <span className="hint">Tap items you finished — they'll be removed from the pantry.</span>
              </div>
            )}
          </div>
        )}

        <label>
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {status === 'planned' && date < today && (
          <p className="hint">This date is in the past — switch to “Eaten” if you had it.</p>
        )}
        <div className="actions">
          {!isNew && (
            <button type="button" className="ghost danger" onClick={remove}>
              Delete
            </button>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSave}>
            {status === 'planned' ? `Plan for ${formatDate(date)}` : 'Save meal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
