import { useState, type ReactNode } from 'react'
import { BookOpen, CalendarCheck, CalendarDays, ChefHat, Check, Plus, RotateCcw, Star, Users } from 'lucide-react'
import { MEAL_TYPES, type MealEntry, type MealType, type Recipe } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { capitalize, daysBetween, fromISODate, todayISO } from '../lib/dates'
import { mealTitle, useRecipeStats, type RecipeStats } from '../lib/derived'
import { DishImage, Segmented } from './ui'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function currentSlot(): MealType {
  const h = new Date().getHours()
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : 'dinner'
}

const SLOT_LABEL: Record<MealType, string> = {
  breakfast: 'This morning',
  lunch: 'Lunchtime',
  dinner: 'Tonight',
  snack: 'Snack time',
}

const shortDate = (iso: string) => fromISODate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

type Filter = 'all' | MealType

export function TodayView() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const now = currentSlot()
  const stats = useRecipeStats()
  const [filter, setFilter] = useState<Filter>('all')
  const name = data.settings.name.trim()

  // The hero is about what's next: a meal planned for today, otherwise an invitation to log one
  const plannedToday = data.meals
    .filter((m) => m.date === today && m.status === 'planned')
    .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType))
  const upNext = plannedToday.find((m) => m.mealType === now) ?? plannedToday[0]
  const upNextRecipe = upNext && data.recipes.find((r) => r.id === upNext.recipeId)

  const eaten = data.meals
    .filter((m) => m.status === 'eaten')
    .sort((a, b) => b.date.localeCompare(a.date) || MEAL_TYPES.indexOf(b.mealType) - MEAL_TYPES.indexOf(a.mealType))
  const latestWithPhoto = eaten.find((m) => m.photoId || data.recipes.find((r) => r.id === m.recipeId)?.photoId)
  const recent = eaten.filter((m) => filter === 'all' || m.mealType === filter).slice(0, 6)

  const monthStart = today.slice(0, 8) + '01'
  const cookedThisMonth = eaten.filter((m) => m.date >= monthStart && m.recipeId && !m.leftoverId).length
  const rated = eaten.filter((m) => m.rating != null)
  const avgRating = rated.length ? rated.reduce((s, m) => s + m.rating!, 0) / rated.length : null

  const cookAgain = pickCookAgain(data.recipes, stats, today)

  const markEaten = (m: MealEntry) => {
    if (m.leftoverId) store.takeLeftoverPortion(m.leftoverId)
    store.upsert('meals', { ...m, status: 'eaten' })
    nav.toast('Enjoy! Tap the meal to rate it or add a photo')
  }

  const isNewUser = data.recipes.length === 0 && data.meals.length === 0

  return (
    <section className="home">
      <header className="home-head">
        <p className="page-eyebrow">
          {fromISODate(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="home-title">
          {greeting()}
          {name && `, ${name}`}
        </h1>
      </header>

      <div className="hero card">
        <div className="hero-copy">
          <span className="hero-pill">{SLOT_LABEL[upNext?.mealType ?? now]}</span>
          {upNext ? (
            <>
              <h2 className="hero-heading">{mealTitle(upNext, data)}</h2>
              <p className="hero-text">
                Planned for {upNext.mealType}
                {upNextRecipe?.prepMinutes ? ` · about ${upNextRecipe.prepMinutes} minutes` : ''}. Ready when you are.
              </p>
              <div className="hero-actions">
                {upNextRecipe && (
                  <button onClick={() => nav.cook(upNextRecipe.id)}>
                    <ChefHat size={17} aria-hidden /> Start cooking
                  </button>
                )}
                <button className="ghost" onClick={() => markEaten(upNext)}>
                  <Check size={16} aria-hidden /> Mark as eaten
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="hero-heading">What did you cook today?</h2>
              <p className="hero-text">
                Snap a photo, pick a recipe or jot down what you ate. It takes less than a minute.
              </p>
              <div className="hero-actions">
                <button onClick={() => nav.editMeal({ date: today, mealType: now })}>
                  <Plus size={17} strokeWidth={2.4} aria-hidden /> Log a meal
                </button>
                {cookAgain && (
                  <button className="ghost" onClick={() => nav.openRecipe(cookAgain.id)}>
                    <RotateCcw size={16} aria-hidden /> Cook one again
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <HeroImage meal={upNext ?? latestWithPhoto} fallbackName={upNextRecipe?.name ?? cookAgain?.name ?? 'Dinner'} />
      </div>

      {isNewUser ? (
        <div className="steps-row">
          <button className="step-card" onClick={() => nav.go('recipes')}>
            <span className="step-icon">
              <BookOpen size={20} />
            </span>
            <strong>Add your recipes</strong>
            <span className="muted small">Type them in or import from a photo</span>
          </button>
          <button className="step-card" onClick={() => nav.go('settings')}>
            <span className="step-icon">
              <Users size={20} />
            </span>
            <strong>Add your family</strong>
            <span className="muted small">Get warnings for allergies</span>
          </button>
          <button className="step-card" onClick={() => nav.go('week')}>
            <span className="step-icon">
              <CalendarDays size={20} />
            </span>
            <strong>Plan the week</strong>
            <span className="muted small">Then shop for it in one tap</span>
          </button>
        </div>
      ) : (
        <div className="home-stats">
          <StatCard icon={<BookOpen size={19} />} value={String(data.recipes.length)} label="Recipes saved" />
          <StatCard icon={<CalendarCheck size={19} />} value={String(cookedThisMonth)} label="Cooked this month" tone="green" />
          <StatCard
            icon={<Star size={19} />}
            value={avgRating != null ? avgRating.toFixed(1) : '—'}
            label="Average rating"
          />
        </div>
      )}

      {eaten.length > 0 && (
        <>
          <div className="section-title recent-head">
            <h2>Recently logged</h2>
            <button className="link small" onClick={() => nav.go('week')}>
              View all
            </button>
          </div>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              ...MEAL_TYPES.map((t) => ({ value: t, label: capitalize(t) })),
            ]}
          />
          {recent.length === 0 ? (
            <p className="muted recent-empty">No {filter} logged yet.</p>
          ) : (
            <ul className="recent">
              {recent.map((m) => {
                const recipe = data.recipes.find((r) => r.id === m.recipeId)
                const title = mealTitle(m, data)
                return (
                  <li key={m.id}>
                    <button className="recent-card" onClick={() => nav.editMeal(m)}>
                      <DishImage
                        photoId={m.photoId ?? recipe?.photoId}
                        name={title}
                        category={recipe?.category}
                        className="recent-img"
                      />
                      <span className="recent-body">
                        <strong className="recent-title">{title}</strong>
                        <span className="recent-meta">
                          <span>
                            {shortDate(m.date)} · {capitalize(m.mealType)}
                          </span>
                          {m.rating != null && (
                            <span className="recent-rating">
                              <Star size={13} fill="currentColor" aria-hidden /> {m.rating}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function StatCard({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone?: 'green' }) {
  return (
    <div className="card stat-card">
      <span className={`stat-card-icon ${tone ?? ''}`} aria-hidden>
        {icon}
      </span>
      <span>
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
      </span>
    </div>
  )
}

function HeroImage({ meal, fallbackName }: { meal: MealEntry | undefined; fallbackName: string }) {
  const { data } = useStore()
  const recipe = meal && data.recipes.find((r) => r.id === meal.recipeId)
  const name = meal ? mealTitle(meal, data) : fallbackName
  return (
    <DishImage
      photoId={meal?.photoId ?? recipe?.photoId}
      name={name}
      category={recipe?.category}
      className="hero-img"
    />
  )
}

/** A recipe worth making again: favorites and well-rated dishes you haven't had for a while. */
function pickCookAgain(recipes: Recipe[], stats: Map<string, RecipeStats>, today: string): Recipe | undefined {
  return recipes
    .filter((r) => stats.has(r.id))
    .map((r) => {
      const s = stats.get(r.id)!
      const since = s.lastCooked ? daysBetween(s.lastCooked, today) : 0
      return { r, score: (r.favorite ? 30 : 0) + (s.avgRating ?? 3) * 5 + Math.min(since, 30) }
    })
    .sort((a, b) => b.score - a.score)[0]?.r
}
