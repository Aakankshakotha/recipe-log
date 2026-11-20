import type { MealType, Recipe } from '../types'
import { newId, useStore } from '../store'
import { useNav } from '../nav'
import {
  addDaysISO,
  daysBetween,
  fromISODate,
  relativeDay,
  todayISO,
} from '../lib/dates'
import {
  frequentMeals,
  loggingStreak,
  usePantryMatches,
  useRecipeStats,
  type PantryMatch,
  type RecipeStats,
} from '../lib/derived'
import { buildTips, weekInsights } from '../lib/insights'
import { TipsCard, WeekPulse } from './HomeInsights'
import { MealsByType } from './MealsByType'
import { DishImage } from './ui'

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
  const leftoverCount = data.leftovers.length

  const streak = loggingStreak(data.meals, today)
  const week = weekInsights(data.meals, today)
  const tips = buildTips(data, today)
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



  const summary = [
    eatenToday ? `${eatenToday} meal${eatenToday > 1 ? 's' : ''} logged today` : 'Nothing logged yet today',
    streak > 1 && `🔥 ${streak}-day streak`,
    leftoverCount > 0 && `🍱 ${leftoverCount} leftover${leftoverCount > 1 ? 's' : ''} to eat`,
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

      <div className="today-meals">
        <div>
          <div className="section-title">
            <h3>This week's meals</h3>
            <button className="link small" onClick={() => nav.go('week')}>
              Open planner ›
            </button>
          </div>
          <MealsByType />

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
      </div>

      <div className="insight-row">
        <WeekPulse week={week} />
        <TipsCard tips={tips} />
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
