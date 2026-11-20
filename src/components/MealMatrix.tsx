import { useEffect, useRef } from 'react'
import { MEAL_TYPES, type MealEntry, type MealType } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { addDaysISO, capitalize, fromISODate, todayISO, weekStartISO } from '../lib/dates'
import { mealTitle } from '../lib/derived'
import { DishImage } from './ui'

const MEAL_ICONS: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }

const dayName = (iso: string) => fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short' })
const dayNum = (iso: string) => fromISODate(iso).getDate()

/**
 * This week's meals grouped by meal type: one row per type (all breakfasts together, all lunches…),
 * one column per day. On phones each row becomes a swipeable strip that opens on today.
 */
export function MealMatrix({ now }: { now: MealType }) {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const start = weekStartISO(today)
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i))
  const rows = useRef<HTMLDivElement>(null)

  // On narrow screens the strips scroll sideways — start each one at today
  useEffect(() => {
    rows.current?.querySelectorAll<HTMLElement>('.mm-cells').forEach((strip) => {
      const cell = strip.querySelector<HTMLElement>('.mm-cell.today')
      if (cell && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = cell.offsetLeft - strip.offsetLeft - 8
    })
  }, [])

  const markEaten = (m: MealEntry) => {
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
    nav.toast('Enjoy! Tap the meal to rate it')
  }

  const mealsAt = (date: string, type: MealType) => data.meals.filter((m) => m.date === date && m.mealType === type)
  const counts = (type: MealType) => days.reduce((n, d) => n + mealsAt(d, type).filter((m) => m.status === 'eaten').length, 0)

  return (
    <div className="card mm" ref={rows}>
      <div className="mm-head-row" aria-hidden>
        <span />
        {days.map((d) => (
          <span key={d} className={`mm-day ${d === today ? 'today' : ''}`}>
            <span className="mm-day-name">{dayName(d)}</span>
            <span className="mm-day-num">{dayNum(d)}</span>
          </span>
        ))}
      </div>

      {MEAL_TYPES.map((type) => (
        <div key={type} className={`mm-row ${type} ${type === now ? 'now' : ''}`}>
          <div className="mm-label">
            <span className="mm-icon" aria-hidden>
              {MEAL_ICONS[type]}
            </span>
            <span className="mm-label-text">
              <strong>
                {capitalize(type)} {type === now && <span className="now-badge">Now</span>}
              </strong>
              <span className="muted small">{counts(type)} this week</span>
            </span>
          </div>

          <div className="mm-cells">
            {days.map((date) => {
              const meals = mealsAt(date, type)
              const isToday = date === today
              return (
                <div
                  key={date}
                  className={`mm-cell ${isToday ? 'today' : ''} ${date < today ? 'past' : ''} ${meals.length ? '' : 'empty'}`}
                >
                  <span className="mm-cell-day">
                    {isToday ? 'Today' : dayName(date)} {dayNum(date)}
                  </span>
                  {meals.map((m) => {
                    const recipe = data.recipes.find((r) => r.id === m.recipeId)
                    const title = mealTitle(m, data)
                    return (
                      <div key={m.id} className={`mm-meal ${m.status}`}>
                        <button className="mm-meal-main" onClick={() => nav.editMeal(m)} title={title}>
                          <DishImage
                            photoId={m.photoId ?? recipe?.photoId}
                            name={title}
                            category={recipe?.category}
                            className="mm-thumb"
                          />
                          <span className="mm-meal-name">{title}</span>
                        </button>
                        {m.status === 'eaten' && m.rating != null && (
                          <span className="mm-stars" aria-label={`${m.rating} stars`}>
                            {'★'.repeat(m.rating)}
                          </span>
                        )}
                        {m.status === 'planned' && date <= today && (
                          <span className="mm-actions">
                            {m.recipeId && isToday && (
                              <button className="ghost small" onClick={() => nav.cook(m.recipeId!)} title="Cook mode">
                                👩‍🍳 Cook
                              </button>
                            )}
                            <button className="check-btn small" onClick={() => markEaten(m)} title="Mark as eaten">
                              ✓
                            </button>
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <button
                    className="mm-add"
                    onClick={() => nav.editMeal({ date, mealType: type })}
                    aria-label={`Add ${type} on ${dayName(date)} ${dayNum(date)}`}
                  >
                    {meals.length ? '+' : date < today ? '+ log' : '+ add'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <p className="mm-legend muted small">
        <span className="legend-eaten" /> eaten · <span className="legend-planned" /> planned · tap any meal to edit
      </p>
    </div>
  )
}
