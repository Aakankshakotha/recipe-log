import { MEAL_TYPES, type MealEntry, type MealType, type Recipe } from '../types'
import { newId, useStore } from '../store'
import { useNav } from '../nav'
import {
  addDaysISO,
  capitalize,
  daysBetween,
  eatByLabel,
  fromISODate,
  relativeDay,
  shortDay,
  todayISO,
  weekStartISO,
} from '../lib/dates'
import {
  frequentMeals,
  loggingStreak,
  mealTitle,
  usePantryMatches,
  useRecipeStats,
  type PantryMatch,
  type RecipeStats,
} from '../lib/derived'
import { DishImage, Stars } from './ui'

const SLOT_ICONS: Record<MealType, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function currentSlot(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : 'dinner'
}

export function TodayView() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const now = currentSlot()
  const stats = useRecipeStats()
  const matches = usePantryMatches()

  const todays = data.meals.filter((m) => m.date === today)
  const eatenToday = todays.filter((m) => m.status === 'eaten').length
  const yesterday = data.meals.filter((m) => m.date === addDaysISO(today, -1) && m.status === 'eaten')
  const quick = frequentMeals(data, 5)
  const toBuy = data.groceries.filter((g) => !g.checked)

  const eatSoon = [...data.leftovers].sort((a, b) => a.eatBy.localeCompare(b.eatBy))
  const expiring = data.pantry
    .filter((p) => p.expires && daysBetween(today, p.expires) <= 3)
    .sort((a, b) => a.expires!.localeCompare(b.expires!))

  const streak = loggingStreak(data.meals, today)
  const week = weekSummary(data.meals, today)
  // Skip what's already on the menu for today or tomorrow
  const onMenu = new Set(
    data.meals.filter((m) => m.recipeId && m.date >= today && m.date <= addDaysISO(today, 1)).map((m) => m.recipeId),
  )
  const ideas = pickIdeas(
    data.recipes.filter((r) => !onMenu.has(r.id)),
    data.pantry.length > 0,
    stats,
    matches,
    today,
  )

  const logQuick = (q: { recipeId: string | null; description: string }) => {
    store.upsert('meals', {
      id: newId(),
      date: today,
      mealType: now,
      status: 'eaten',
      recipeId: q.recipeId,
      leftoverId: null,
      description: q.description,
      rating: null,
      notes: '',
      photoId: null,
      eatenBy: data.members.map((m) => m.id),
    })
    nav.toast(`Added to ${now} — tap it to rate or add a photo`)
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

  const markEaten = (m: MealEntry) => {
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
    nav.toast('Enjoy! Tap the meal to rate it')
  }

  const summary = [
    eatenToday ? `${eatenToday} meal${eatenToday > 1 ? 's' : ''} logged today` : 'Nothing logged yet today',
    streak > 1 && `🔥 ${streak}-day streak`,
    eatSoon.length > 0 && `🍱 ${eatSoon.length} leftover${eatSoon.length > 1 ? 's' : ''} to eat`,
  ].filter(Boolean)

  const isNewUser = data.recipes.length === 0 && data.meals.length === 0

  return (
    <section className="today">
      <div className="hero-banner">
        <div className="hero-text">
          <p className="hero-date">
            {fromISODate(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="hero-title">{greeting()}</h2>
          <p className="hero-summary">{summary.join('  ·  ')}</p>
        </div>
        <div className="hero-actions">
          <button className="hero-btn" onClick={() => nav.editMeal({ date: today, mealType: now })}>
            + Log {now}
          </button>
          {yesterday.length > 0 && todays.length === 0 && (
            <button className="hero-btn ghost-light" onClick={sameAsYesterday}>
              Same as yesterday
            </button>
          )}
        </div>
        <span className="hero-art" aria-hidden>
          🍲
        </span>
      </div>

      {isNewUser && (
        <div className="steps-row">
          <button className="step-card" onClick={() => nav.go('recipes')}>
            <span className="step-icon">📖</span>
            <strong>Add your recipes</strong>
            <span className="muted small">Type them in or import from a photo</span>
          </button>
          <button className="step-card" onClick={() => nav.go('settings')}>
            <span className="step-icon">👨‍👩‍👧</span>
            <strong>Add your family</strong>
            <span className="muted small">Get warnings for allergies</span>
          </button>
          <button className="step-card" onClick={() => nav.go('week')}>
            <span className="step-icon">📅</span>
            <strong>Plan the week</strong>
            <span className="muted small">Then shop for it in one tap</span>
          </button>
        </div>
      )}

      <div className="today-grid">
        <div className="today-main">
          <div className="section-title">
            <h3>Today's meals</h3>
          </div>
          <div className="slots">
            {MEAL_TYPES.map((type) => {
              const meals = todays.filter((m) => m.mealType === type)
              return (
                <div key={type} className={`slot ${type} ${type === now ? 'now' : ''} ${meals.length ? 'filled' : ''}`}>
                  <div className="slot-head">
                    <span className="slot-name">
                      <span aria-hidden>{SLOT_ICONS[type]}</span> {capitalize(type)}
                    </span>
                    {type === now && <span className="now-badge">Now</span>}
                    {meals.length > 0 && (
                      <button
                        className="icon-btn small slot-add"
                        onClick={() => nav.editMeal({ date: today, mealType: type })}
                        aria-label={`Add another ${type}`}
                      >
                        +
                      </button>
                    )}
                  </div>
                  {meals.length === 0 ? (
                    <button className="slot-empty" onClick={() => nav.editMeal({ date: today, mealType: type })}>
                      + Add {type}
                    </button>
                  ) : (
                    <ul className="slot-meals">
                      {meals.map((m) => {
                        const recipe = data.recipes.find((r) => r.id === m.recipeId)
                        const title = mealTitle(m, data)
                        return (
                          <li key={m.id} className={m.status}>
                            <button className="slot-meal" onClick={() => nav.editMeal(m)}>
                              <DishImage
                                photoId={m.photoId ?? recipe?.photoId}
                                name={title}
                                category={recipe?.category}
                                className="slot-thumb"
                              />
                              <span className="slot-meal-text">
                                <strong>{title}</strong>
                                {m.status === 'planned' ? (
                                  <span className="muted small">Planned</span>
                                ) : m.rating ? (
                                  <Stars value={m.rating} size="sm" />
                                ) : (
                                  <span className="muted small">Tap to rate</span>
                                )}
                              </span>
                            </button>
                            {m.status === 'planned' && (
                              <div className="slot-actions">
                                {m.recipeId && (
                                  <button className="ghost small" onClick={() => nav.cook(m.recipeId!)}>
                                    👩‍🍳 Cook
                                  </button>
                                )}
                                <button className="check-btn" onClick={() => markEaten(m)} title="Mark as eaten">
                                  ✓
                                </button>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          {quick.length > 0 && (
            <div className="quick">
              <span className="muted small">Quick add to {now}:</span>
              <div className="chips">
                {quick.map((q) => (
                  <button key={q.label} className="chip" onClick={() => logQuick(q)}>
                    + {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="today-side">
          <button className="card side-card week-strip" onClick={() => nav.go('week')}>
            <div className="side-head">
              <strong>This week</strong>
              <span className="muted small">Open planner ›</span>
            </div>
            <div className="strip">
              {week.map((d) => (
                <div key={d.date} className={`strip-day ${d.date === today ? 'today' : ''} ${d.date > today ? 'future' : ''}`}>
                  <span className="strip-label">{shortDay(d.date).split(' ')[0].slice(0, 2)}</span>
                  <span className="strip-num">{fromISODate(d.date).getDate()}</span>
                  <span className="strip-dots">
                    {Array.from({ length: Math.min(3, d.eaten) }, (_, i) => (
                      <i key={`e${i}`} className="dot eaten" />
                    ))}
                    {Array.from({ length: Math.min(3 - Math.min(3, d.eaten), d.planned) }, (_, i) => (
                      <i key={`p${i}`} className="dot planned" />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </button>

          {(eatSoon.length > 0 || expiring.length > 0) && (
            <div className="card side-card use-up">
              <div className="side-head">
                <strong>⏰ Use it up</strong>
              </div>
              <ul className="side-list">
                {eatSoon.map((l) => (
                  <li key={l.id}>
                    <DishImage photoId={null} name={l.name} className="side-thumb" />
                    <span className="grow">
                      {l.name}
                      <span className="muted small"> · {l.portions} left</span>
                    </span>
                    <span className={`due ${l.eatBy <= today ? 'urgent' : 'soon'}`}>{eatByLabel(l.eatBy)}</span>
                  </li>
                ))}
                {expiring.map((p) => (
                  <li key={p.id}>
                    <span className="side-thumb pantry-icon">🥫</span>
                    <span className="grow">{p.name}</span>
                    <span className={`due ${p.expires! <= today ? 'urgent' : 'soon'}`}>
                      {p.expires! < today ? 'expired' : `expires ${relativeDay(p.expires!)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="card side-card shop-card" onClick={() => nav.go('kitchen')}>
            <div className="side-head">
              <strong>🛒 Shopping list</strong>
              <span className="muted small">{toBuy.length ? `${toBuy.length} to buy ›` : 'Open ›'}</span>
            </div>
            {toBuy.length === 0 ? (
              <p className="muted small">All stocked up. Plan some meals and add their ingredients in one tap.</p>
            ) : (
              <p className="shop-preview">
                {toBuy
                  .slice(0, 5)
                  .map((g) => capitalize(g.name))
                  .join(', ')}
                {toBuy.length > 5 && ` +${toBuy.length - 5} more`}
              </p>
            )}
          </button>
        </aside>
      </div>

      {ideas.length > 0 && (
        <>
          <div className="section-title">
            <h3>Ideas for your next meal</h3>
            <button className="link small" onClick={() => nav.go('recipes')}>
              All recipes ›
            </button>
          </div>
          <ul className="ideas">
            {ideas.map(({ recipe, reason }) => (
              <li key={recipe.id}>
                <button className="idea-card" onClick={() => nav.openRecipe(recipe.id)}>
                  <DishImage photoId={recipe.photoId} name={recipe.name} category={recipe.category} className="idea-img" />
                  <span className="idea-body">
                    <strong>{recipe.name}</strong>
                    <span className="muted small">
                      {reason}
                      {recipe.prepMinutes != null && ` · ${recipe.prepMinutes} min`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function weekSummary(meals: MealEntry[], today: string) {
  const start = weekStartISO(today)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(start, i)
    const day = meals.filter((m) => m.date === date)
    return {
      date,
      eaten: day.filter((m) => m.status === 'eaten').length,
      planned: day.filter((m) => m.status === 'planned').length,
    }
  })
}

/** Ideas for the next meal: what the pantry covers first, then favorites and dishes not had lately. */
function pickIdeas(
  recipes: Recipe[],
  hasPantry: boolean,
  stats: Map<string, RecipeStats>,
  matches: Map<string, PantryMatch>,
  today: string,
) {
  const daysSince = (r: Recipe) => {
    const last = stats.get(r.id)?.lastCooked
    return last ? daysBetween(last, today) : 999
  }
  return recipes
    .filter((r) => daysSince(r) >= 2)
    .map((r) => {
      const match = matches.get(r.id)!
      const missing = r.ingredients.length && hasPantry ? match.missing.length : 99
      const reason =
        missing === 0
          ? '✓ You have everything'
          : missing === 1
            ? `Just need ${match.missing[0]}`
            : r.favorite
              ? '★ A favorite'
              : daysSince(r) === 999
                ? 'Not tried yet'
                : `Last had ${relativeDay(stats.get(r.id)!.lastCooked!)}`
      const score = (missing <= 1 ? 100 - missing * 10 : 0) + (r.favorite ? 30 : 0) + Math.min(daysSince(r), 60)
      return { recipe: r, reason, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}
