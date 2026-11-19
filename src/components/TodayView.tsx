import { useMemo } from 'react'
import { MEAL_TYPES, type MealType } from '../types'
import { newId, useStore } from '../store'
import { useNav } from '../nav'
import { addDaysISO, capitalize, daysBetween, eatByLabel, fromISODate, relativeDay, todayISO } from '../lib/dates'
import { frequentMeals, mealTitle, usePantryMatches, useRecipeStats } from '../lib/derived'
import { Photo, Stars } from './ui'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function nextMealType(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : 'dinner'
}

export function TodayView() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const tomorrow = addDaysISO(today, 1)
  const stats = useRecipeStats()
  const matches = usePantryMatches()

  const todays = data.meals
    .filter((m) => m.date === today)
    .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType))
  const tomorrows = data.meals.filter((m) => m.date === tomorrow)
  const quick = useMemo(() => frequentMeals(data), [data])
  const yesterday = data.meals.filter((m) => m.date === addDaysISO(today, -1) && m.status === 'eaten')

  const eatSoon = [...data.leftovers].sort((a, b) => a.eatBy.localeCompare(b.eatBy))
  const expiring = data.pantry
    .filter((p) => p.expires && daysBetween(today, p.expires) <= 3)
    .sort((a, b) => a.expires!.localeCompare(b.expires!))

  // Recipes you can make now, favoring ones you haven't had recently
  const canCook = useMemo(
    () =>
      data.pantry.length === 0
        ? []
        : data.recipes
            .map((r) => ({ recipe: r, match: matches.get(r.id)! }))
            .filter((x) => x.recipe.ingredients.length > 0 && x.match.missing.length <= 1)
            .sort(
              (a, b) =>
                a.match.missing.length - b.match.missing.length ||
                (stats.get(a.recipe.id)?.lastCooked ?? '').localeCompare(stats.get(b.recipe.id)?.lastCooked ?? ''),
            )
            .slice(0, 4),
    [data.recipes, data.pantry.length, matches, stats],
  )

  const logQuick = (q: { recipeId: string | null; description: string }) => {
    store.upsert('meals', {
      id: newId(),
      date: today,
      mealType: nextMealType(),
      status: 'eaten',
      recipeId: q.recipeId,
      leftoverId: null,
      description: q.description,
      rating: null,
      notes: '',
      photoId: null,
      eatenBy: data.members.map((m) => m.id),
    })
    nav.toast(`Logged for ${nextMealType()} — tap it to change details`)
  }

  const sameAsYesterday = () => {
    store.upsertMany(
      'meals',
      yesterday
        .filter((m) => !m.leftoverId && !todays.some((t) => t.mealType === m.mealType))
        .map((m) => ({ ...m, id: newId(), date: today, rating: null, notes: '', photoId: null })),
    )
    nav.toast('Copied yesterday’s meals')
  }

  const markEaten = (id: string) => {
    const m = data.meals.find((x) => x.id === id)!
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
  }

  const isEmpty = data.recipes.length === 0 && data.meals.length === 0

  return (
    <section className="today">
      <div className="hero">
        <div>
          <p className="muted">
            {fromISODate(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="hero-title">{greeting()} 👋</h2>
        </div>
        <button onClick={() => nav.editMeal({ date: today, mealType: nextMealType() })}>+ Log a meal</button>
      </div>

      {isEmpty && (
        <div className="card onboarding">
          <h3>Let's get you started</h3>
          <ol>
            <li>
              <button className="link" onClick={() => nav.go('recipes')}>Add a few recipes</button> you cook often
              (or import one from a photo).
            </li>
            <li>
              <button className="link" onClick={() => nav.go('settings')}>Add your family</button> and any
              allergies, so you get warnings.
            </li>
            <li>
              <button className="link" onClick={() => nav.go('week')}>Plan your week</button> and turn it into a
              shopping list.
            </li>
          </ol>
        </div>
      )}

      <div className="dash">
        <div className="card">
          <div className="card-head">
            <h3>Today's meals</h3>
            {yesterday.length > 0 && todays.length === 0 && (
              <button className="ghost small" onClick={sameAsYesterday}>
                Same as yesterday
              </button>
            )}
          </div>
          {todays.length === 0 ? (
            <p className="muted">Nothing planned or logged yet.</p>
          ) : (
            <ul className="meals big">
              {todays.map((m) => (
                <li key={m.id} className={`meal ${m.status}`}>
                  <button className="meal-main" onClick={() => nav.editMeal(m)}>
                    {m.photoId && <Photo id={m.photoId} alt="" className="meal-thumb" />}
                    <span className={`pill ${m.mealType}`}>{capitalize(m.mealType)}</span>
                    <span className="meal-text">{mealTitle(m, data)}</span>
                    <Stars value={m.rating} size="sm" />
                  </button>
                  {m.status === 'planned' && (
                    <>
                      {m.recipeId && (
                        <button className="ghost small" onClick={() => nav.cook(m.recipeId!)}>
                          👩‍🍳 Cook
                        </button>
                      )}
                      <button className="check-btn" onClick={() => markEaten(m.id)} title="Mark as eaten">
                        ✓
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {quick.length > 0 && (
            <>
              <p className="muted small quick-label">Quick log — tap to add for {nextMealType()}:</p>
              <div className="chips">
                {quick.map((q) => (
                  <button key={q.label} className="chip" onClick={() => logQuick(q)}>
                    + {q.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {tomorrows.length > 0 && (
            <p className="muted small tomorrow">
              Tomorrow: {tomorrows.map((m) => `${capitalize(m.mealType)} – ${mealTitle(m, data)}`).join(' · ')}
            </p>
          )}
        </div>

        {(eatSoon.length > 0 || expiring.length > 0) && (
          <div className="card attention">
            <h3>⏰ Use it up</h3>
            <ul className="list compact">
              {eatSoon.map((l) => (
                <li key={l.id}>
                  <span>
                    🍱 {l.name} <span className="muted small">· {l.portions} portion{l.portions > 1 ? 's' : ''}</span>
                  </span>
                  <span className={`due ${l.eatBy <= today ? 'urgent' : ''}`}>{eatByLabel(l.eatBy)}</span>
                </li>
              ))}
              {expiring.map((p) => (
                <li key={p.id}>
                  <span>🥫 {p.name}</span>
                  <span className={`due ${p.expires! <= today ? 'urgent' : ''}`}>
                    {p.expires! < today ? 'expired' : 'expires'} {relativeDay(p.expires!)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canCook.length > 0 && (
          <div className="card">
            <h3>🍳 You can cook right now</h3>
            <ul className="mini-recipes">
              {canCook.map(({ recipe, match }) => (
                <li key={recipe.id}>
                  <button className="mini-recipe" onClick={() => nav.openRecipe(recipe.id)}>
                    <Photo id={recipe.photoId} alt="" className="mini-thumb" fallback="🍲" />
                    <span>
                      <strong>{recipe.name}</strong>
                      <span className="muted small">
                        {match.missing.length === 0 ? 'You have everything' : `Missing: ${match.missing[0]}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
