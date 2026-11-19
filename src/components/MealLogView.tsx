import { useMemo, useState } from 'react'
import { MEAL_TYPES, type MealEntry, type MealType } from '../types'
import { capitalize, formatDate, todayISO, toISODate, type Store } from '../store'
import { MealForm } from './MealForm'

interface Props {
  store: Store
  draft: Partial<MealEntry> | null
  setDraft: (draft: Partial<MealEntry> | null) => void
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const offset = (copy.getDay() + 6) % 7 // Monday = 0
  copy.setDate(copy.getDate() - offset)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + n)
  return copy
}

export function MealLogView({ store, draft, setDraft }: Props) {
  const { data, saveMeal, deleteMeal } = store
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  const recipeName = useMemo(() => new Map(data.recipes.map((r) => [r.id, r.name])), [data.recipes])

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i))),
    [weekStart],
  )

  const mealsByDay = useMemo(() => {
    const map = new Map<string, MealEntry[]>()
    for (const m of data.meals) {
      if (!days.includes(m.date)) continue
      map.set(m.date, [...(map.get(m.date) ?? []), m])
    }
    for (const list of map.values()) {
      list.sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType))
    }
    return map
  }, [data.meals, days])

  if (draft) {
    return (
      <MealForm
        recipes={data.recipes}
        initial={draft}
        onCancel={() => setDraft(null)}
        onSave={(m) => {
          saveMeal(m)
          setWeekStart(startOfWeek(new Date(m.date + 'T00:00:00')))
          setDraft(null)
        }}
        onDelete={
          draft.id
            ? () => {
                deleteMeal(draft.id!)
                setDraft(null)
              }
            : undefined
        }
      />
    )
  }

  const today = todayISO()
  const label = `${formatDate(days[0])} – ${formatDate(days[6])}`

  return (
    <section>
      <div className="toolbar">
        <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ←
        </button>
        <strong className="week-label">{label}</strong>
        <button className="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          →
        </button>
        <button className="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          This week
        </button>
        <button className="push" onClick={() => setDraft({})}>
          + Log meal
        </button>
      </div>

      <div className="week">
        {days.map((day) => {
          const meals = mealsByDay.get(day) ?? []
          return (
            <div key={day} className={`card day ${day === today ? 'today' : ''}`}>
              <div className="day-head">
                <strong>{formatDate(day)}</strong>
                <button
                  className="ghost small"
                  onClick={() => setDraft({ date: day })}
                  title="Add meal to this day"
                >
                  +
                </button>
              </div>
              {meals.length === 0 ? (
                <p className="meta">Nothing logged</p>
              ) : (
                <ul className="meals">
                  {meals.map((m) => (
                    <li key={m.id}>
                      <button className="meal" onClick={() => setDraft(m)}>
                        <span className={`pill ${m.mealType}`}>{shortType(m.mealType)}</span>
                        <span className="meal-text">
                          {m.recipeId ? recipeName.get(m.recipeId) : m.description}
                          {m.recipeId && m.description && (
                            <span className="meta"> — {m.description}</span>
                          )}
                        </span>
                        {m.rating != null && <span className="meta">{'★'.repeat(m.rating)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const shortType = (t: MealType) => (t === 'breakfast' ? 'Bkfst' : capitalize(t))
