import { useMemo, useState } from 'react'
import { MEAL_TYPES, type MealEntry, type MealType, type TemplateMeal } from '../types'
import { newId, useStore } from '../store'
import { useNav } from '../nav'
import {
  addDaysISO,
  capitalize,
  formatDate,
  shortDay,
  todayISO,
  weekdayIndex,
  weekStartISO,
} from '../lib/dates'
import { mealTitle } from '../lib/derived'
import { Modal, Photo, Stars } from './ui'

const mealOrder = (a: { mealType: MealType }, b: { mealType: MealType }) =>
  MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType)

export function WeekView() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const [weekStart, setWeekStart] = useState(() => weekStartISO(today))
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart])
  const weekEnd = days[6]

  const weekMeals = useMemo(
    () => data.meals.filter((m) => m.date >= weekStart && m.date <= weekEnd),
    [data.meals, weekStart, weekEnd],
  )

  // Recurring meals not yet on the calendar show up as suggestions ("ghosts") — only for today onward
  const ghosts = useMemo(
    () =>
      days.flatMap((day) =>
        day < today
          ? []
          : data.recurring
              .filter((r) => r.weekday === weekdayIndex(day))
              .filter(
                (r) =>
                  !weekMeals.some(
                    (m) =>
                      m.date === day &&
                      m.mealType === r.mealType &&
                      (r.recipeId ? m.recipeId === r.recipeId : m.description === r.description),
                  ),
              )
              .map((r) => ({ ...r, date: day })),
      ),
    [days, data.recurring, weekMeals, today],
  )

  const plannedAhead = weekMeals.filter((m) => m.status === 'planned' && m.date >= today && m.recipeId)

  const addGhost = (g: (typeof ghosts)[number]) =>
    store.upsert('meals', {
      id: newId(),
      date: g.date,
      mealType: g.mealType,
      status: 'planned',
      recipeId: g.recipeId,
      leftoverId: null,
      description: g.description,
      rating: null,
      notes: '',
      photoId: null,
      eatenBy: data.members.map((m) => m.id),
    })

  const markEaten = (m: MealEntry) => {
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
    nav.toast('Marked as eaten — tap it to add a rating or photo')
  }

  const applyMeals = (meals: TemplateMeal[], label: string) => {
    const fresh = meals
      .map((t) => ({ ...t, date: addDaysISO(weekStart, t.weekday) }))
      .filter((t) => !weekMeals.some((m) => m.date === t.date && m.mealType === t.mealType))
    store.upsertMany(
      'meals',
      fresh.map((t) => ({
        id: newId(),
        date: t.date,
        mealType: t.mealType,
        status: 'planned' as const,
        recipeId: t.recipeId,
        leftoverId: null,
        description: t.description,
        rating: null,
        notes: '',
        photoId: null,
        eatenBy: data.members.map((m) => m.id),
      })),
    )
    nav.toast(
      fresh.length
        ? `Added ${fresh.length} meals from ${label}`
        : `Nothing to add — those slots are already filled`,
    )
  }

  const copyLastWeek = () => {
    const lastStart = addDaysISO(weekStart, -7)
    const last = data.meals.filter((m) => m.date >= lastStart && m.date < weekStart && !m.leftoverId)
    if (!last.length) return nav.toast('Nothing logged last week to copy')
    applyMeals(
      last.map((m) => ({
        weekday: weekdayIndex(m.date),
        mealType: m.mealType,
        recipeId: m.recipeId,
        description: m.description,
      })),
      'last week',
    )
  }

  const shopForWeek = () => {
    const lines = plannedAhead.flatMap(
      (m) => data.recipes.find((r) => r.id === m.recipeId)?.ingredients ?? [],
    )
    const added = store.addIngredientsToGroceries(lines)
    nav.toast(
      added
        ? `Added ${added} items to your shopping list`
        : 'Everything is already in your pantry or list',
    )
  }

  const isThisWeek = weekStart === weekStartISO(today)

  return (
    <section>
      <div className="toolbar">
        <div className="week-nav">
          <button className="icon-btn" onClick={() => setWeekStart(addDaysISO(weekStart, -7))} aria-label="Previous week">
            ‹
          </button>
          <strong className="week-label">
            {formatDate(weekStart)} – {formatDate(weekEnd)}
          </strong>
          <button className="icon-btn" onClick={() => setWeekStart(addDaysISO(weekStart, 7))} aria-label="Next week">
            ›
          </button>
          {!isThisWeek && (
            <button className="ghost small" onClick={() => setWeekStart(weekStartISO(today))}>
              This week
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <button className="ghost small" onClick={copyLastWeek}>
            ⧉ Copy last week
          </button>
          <button className="ghost small" onClick={() => setTemplatesOpen(true)}>
            ☰ Templates
          </button>
          <button className="ghost small" onClick={shopForWeek} disabled={!plannedAhead.length}>
            🛒 Shop for plan
          </button>
          <button onClick={() => nav.editMeal({ date: today >= weekStart && today <= weekEnd ? today : weekStart })}>
            + Add meal
          </button>
        </div>
      </div>

      <div className="week">
        {days.map((day) => {
          const meals = weekMeals.filter((m) => m.date === day).sort(mealOrder)
          const dayGhosts = ghosts.filter((g) => g.date === day)
          return (
            <div key={day} className={`card day ${day === today ? 'today' : ''} ${day < today ? 'past' : ''}`}>
              <div className="day-head">
                <div>
                  <strong>{shortDay(day)}</strong>
                  {day === today && <span className="today-badge">Today</span>}
                </div>
                <button
                  className="icon-btn small"
                  onClick={() => nav.editMeal({ date: day })}
                  aria-label={`Add meal on ${formatDate(day)}`}
                >
                  +
                </button>
              </div>
              {meals.length === 0 && dayGhosts.length === 0 && <p className="muted small">Nothing yet</p>}
              <ul className="meals">
                {meals.map((m) => (
                  <li key={m.id} className={`meal ${m.status}`}>
                    <button className="meal-main" onClick={() => nav.editMeal(m)}>
                      {m.photoId && <Photo id={m.photoId} alt="" className="meal-thumb" />}
                      <span className={`pill ${m.mealType}`}>{capitalize(m.mealType)}</span>
                      <span className="meal-text">{mealTitle(m, data)}</span>
                      <Stars value={m.rating} size="sm" />
                    </button>
                    {m.status === 'planned' && m.date <= today && (
                      <button className="check-btn" onClick={() => markEaten(m)} title="Mark as eaten">
                        ✓
                      </button>
                    )}
                  </li>
                ))}
                {dayGhosts.map((g) => (
                  <li key={g.id} className="meal ghost-meal">
                    <button className="meal-main" onClick={() => addGhost(g)} title="Add this recurring meal">
                      <span className={`pill ${g.mealType}`}>{capitalize(g.mealType)}</span>
                      <span className="meal-text">
                        {g.recipeId ? data.recipes.find((r) => r.id === g.recipeId)?.name : g.description}
                      </span>
                      <span className="muted small">↻ add</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      <p className="legend muted small">
        <span className="legend-planned" /> planned · <span className="legend-eaten" /> eaten · ↻ recurring
        suggestion (set these up in Settings)
      </p>

      {templatesOpen && (
        <TemplatesModal
          weekMeals={weekMeals}
          onApply={(t) => {
            applyMeals(t.meals, `“${t.name}”`)
            setTemplatesOpen(false)
          }}
          onClose={() => setTemplatesOpen(false)}
        />
      )}
    </section>
  )
}

function TemplatesModal({
  weekMeals,
  onApply,
  onClose,
}: {
  weekMeals: MealEntry[]
  onApply: (t: { name: string; meals: TemplateMeal[] }) => void
  onClose: () => void
}) {
  const store = useStore()
  const nav = useNav()
  const [name, setName] = useState('')
  const usable = weekMeals.filter((m) => !m.leftoverId)

  const save = () => {
    if (!name.trim()) return
    store.upsert('templates', {
      id: newId(),
      name: name.trim(),
      meals: usable.map((m) => ({
        weekday: weekdayIndex(m.date),
        mealType: m.mealType,
        recipeId: m.recipeId,
        description: m.description,
      })),
    })
    setName('')
    nav.toast('Template saved')
  }

  return (
    <Modal title="Week templates" onClose={onClose}>
      <p className="muted">Save a typical week once, then fill any future week with one click.</p>
      {store.data.templates.length === 0 ? (
        <p className="muted small">No templates yet.</p>
      ) : (
        <ul className="list">
          {store.data.templates.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.name}</strong>
                <div className="muted small">{t.meals.length} meals</div>
              </div>
              <div className="row-actions">
                <button className="small" onClick={() => onApply(t)}>
                  Use for this week
                </button>
                <button
                  className="ghost small danger"
                  onClick={() => confirm(`Delete template “${t.name}”?`) && store.remove('templates', t.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h3>Save this week as a template</h3>
      {usable.length === 0 ? (
        <p className="muted small">Add some meals to this week first.</p>
      ) : (
        <div className="inline-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. Usual week (${usable.length} meals)`}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <button onClick={save} disabled={!name.trim()}>
            Save
          </button>
        </div>
      )}
    </Modal>
  )
}
