import { MEAL_TYPES, type MealEntry, type MealType } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { addDaysISO, capitalize, fromISODate, todayISO, weekStartISO } from '../lib/dates'
import { mealTitle } from '../lib/derived'
import { DishImage } from './ui'

const MEAL_ICONS: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }

function when(date: string, today: string) {
  if (date === today) return 'Today'
  if (date === addDaysISO(today, -1)) return 'Yesterday'
  if (date === addDaysISO(today, 1)) return 'Tomorrow'
  return fromISODate(date).toLocaleDateString(undefined, { weekday: 'short' })
}

/** This week's meals, one simple list per meal type: all breakfasts together, all lunches together… */
export function MealsByType() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const start = weekStartISO(today)
  const end = addDaysISO(start, 6)

  const markEaten = (m: MealEntry) => {
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
    nav.toast('Enjoy! Tap the meal to rate it')
  }

  return (
    <div className="by-type">
      {MEAL_TYPES.map((type) => {
        const meals = data.meals
          .filter((m) => m.mealType === type && m.date >= start && m.date <= end)
          .sort((a, b) => b.date.localeCompare(a.date))
        return (
          <section key={type} className={`type-list ${type}`}>
            <h4 className="type-head">
              <span aria-hidden>{MEAL_ICONS[type]}</span> {capitalize(type)}
              <span className="type-count">{meals.filter((m) => m.status === 'eaten').length}</span>
            </h4>
            {meals.length === 0 ? (
              <p className="muted small type-empty">Nothing yet this week</p>
            ) : (
              <ul>
                {meals.map((m) => {
                  const recipe = data.recipes.find((r) => r.id === m.recipeId)
                  const title = mealTitle(m, data)
                  return (
                    <li key={m.id} className={m.status}>
                      <button
                        className="type-item"
                        onClick={() => nav.editMeal(m)}
                        title={m.status === 'planned' ? `${title} — planned` : title}
                      >
                        <DishImage
                          photoId={m.photoId ?? recipe?.photoId}
                          name={title}
                          category={recipe?.category}
                          className="type-thumb"
                        />
                        <span className="type-name">{title}</span>
                        <span className={`type-when ${m.date === today ? 'today' : ''}`}>
                          {when(m.date, today)}
                          {m.status === 'planned' && <span className="sr-only"> (planned)</span>}
                        </span>
                      </button>
                      {m.status === 'planned' && m.date <= today && (
                        <button className="check-btn small" onClick={() => markEaten(m)} title="Mark as eaten">
                          ✓
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <button className="link small type-add" onClick={() => nav.editMeal({ date: today, mealType: type })}>
              + Add {type}
            </button>
          </section>
        )
      })}
    </div>
  )
}
