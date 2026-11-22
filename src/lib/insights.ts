import type { AppData, MealEntry, Recipe } from '../types'
import { addDaysISO, capitalize, daysBetween, formatDate, weekStartISO, weekdayIndex } from './dates'
import { normalizeName, parseIngredient, sameIngredient } from './ingredients'

// ---- Week-to-date numbers, compared with the same days of last week ----

export interface DayBar {
  date: string
  fromRecipes: number
  other: number
  planned: number
}

export interface WeekStat {
  value: number
  previous: number
}

export interface WeekInsights {
  days: DayBar[]
  meals: WeekStat
  recipeShare: WeekStat // percent of eaten meals made from your recipes (incl. their leftovers)
  dishes: WeekStat // different dishes eaten
  leftovers: WeekStat // meals eaten from leftovers
}

const fromRecipe = (m: MealEntry) => !!m.recipeId || !!m.leftoverId

function summarize(meals: MealEntry[]) {
  const eaten = meals.filter((m) => m.status === 'eaten')
  const dishes = new Set(eaten.map((m) => m.recipeId ?? m.description.trim().toLowerCase()).filter(Boolean))
  return {
    meals: eaten.length,
    recipeShare: eaten.length ? Math.round((eaten.filter(fromRecipe).length / eaten.length) * 100) : 0,
    dishes: dishes.size,
    leftovers: eaten.filter((m) => m.leftoverId).length,
  }
}

export function weekInsights(meals: MealEntry[], today: string): WeekInsights {
  const start = weekStartISO(today)
  const elapsed = weekdayIndex(today) // 0 = Monday
  const lastStart = addDaysISO(start, -7)
  const lastSameDay = addDaysISO(lastStart, elapsed)

  const now = summarize(meals.filter((m) => m.date >= start && m.date <= today))
  const before = summarize(meals.filter((m) => m.date >= lastStart && m.date <= lastSameDay))

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(start, i)
    const day = meals.filter((m) => m.date === date)
    const eaten = day.filter((m) => m.status === 'eaten')
    return {
      date,
      fromRecipes: eaten.filter(fromRecipe).length,
      other: eaten.filter((m) => !fromRecipe(m)).length,
      planned: day.filter((m) => m.status === 'planned').length,
    }
  })

  return {
    days,
    meals: { value: now.meals, previous: before.meals },
    recipeShare: { value: now.recipeShare, previous: before.recipeShare },
    dishes: { value: now.dishes, previous: before.dishes },
    leftovers: { value: now.leftovers, previous: before.leftovers },
  }
}

// ---- Tips: short, specific nudges built from the data ----

export type TipAction =
  | { kind: 'recipe'; recipeId: string; label: string }
  | { kind: 'eatLeftover'; leftoverId: string; label: string }
  | { kind: 'plan'; date: string; label: string }
  | { kind: 'tab'; tab: 'kitchen' | 'week' | 'insights'; label: string }

export type TipIcon =
  | 'leftover'
  | 'expiring'
  | 'milestone'
  | 'variety'
  | 'plan'
  | 'favorite'
  | 'progress'
  | 'untried'
  | 'shopping'

export interface Tip {
  id: string
  icon: TipIcon
  tone: 'urgent' | 'nudge' | 'praise'
  title: string
  detail?: string
  action?: TipAction
}

const MILESTONES = [10, 25, 50, 100, 200, 365, 500, 1000]

function categoryOf(recipe: Recipe | undefined) {
  return recipe?.category.trim() || null
}

/** Up to `limit` tips, most useful first. */
export function buildTips(data: AppData, today: string, limit = 4): Tip[] {
  const tips: Tip[] = []
  const byId = new Map(data.recipes.map((r) => [r.id, r]))
  const eaten = data.meals.filter((m) => m.status === 'eaten')
  const lastCooked = new Map<string, string>()
  for (const m of eaten) {
    if (m.recipeId && !m.leftoverId && (lastCooked.get(m.recipeId) ?? '') < m.date) lastCooked.set(m.recipeId, m.date)
  }

  // 1. Leftovers that need eating today or tomorrow
  for (const l of data.leftovers) {
    const left = daysBetween(today, l.eatBy)
    if (left > 1) continue
    tips.push({
      id: 'leftover-' + l.id,
      icon: 'leftover',
      tone: 'urgent',
      title: left < 0 ? `${l.name} leftovers are past their date` : `Eat the ${l.name} leftovers ${left === 0 ? 'today' : 'by tomorrow'}`,
      detail: `${l.portions} portion${l.portions > 1 ? 's' : ''} left`,
      action: left < 0 ? { kind: 'tab', tab: 'kitchen', label: 'Review' } : { kind: 'eatLeftover', leftoverId: l.id, label: 'Eat now' },
    })
  }

  // 2. Pantry items about to expire, with a recipe that uses them
  for (const p of data.pantry) {
    if (!p.expires) continue
    const left = daysBetween(today, p.expires)
    if (left > 2) continue
    const key = normalizeName(p.name) || p.name.toLowerCase()
    const uses = data.recipes.find((r) => r.ingredients.some((line) => sameIngredient(key, parseIngredient(line).key)))
    tips.push({
      id: 'expiring-' + p.id,
      icon: 'expiring',
      tone: 'urgent',
      title:
        left < 0
          ? `${capitalize(p.name)} has expired`
          : `${capitalize(p.name)} expires ${left === 0 ? 'today' : left === 1 ? 'tomorrow' : 'in 2 days'}`,
      detail: uses ? `Use it in ${uses.name}` : undefined,
      action: uses ? { kind: 'recipe', recipeId: uses.id, label: 'View recipe' } : { kind: 'tab', tab: 'kitchen', label: 'Pantry' },
    })
  }

  // 3. Milestones
  const total = eaten.length
  const milestone = MILESTONES.find((n) => total >= n && total < n + 3)
  if (milestone) {
    tips.push({ id: 'milestone', icon: 'milestone', tone: 'praise', title: `You've logged ${milestone} meals!`, detail: 'Nice habit — keep it going.' })
  }

  // 4. Variety: one category dominating the last 7 days
  const recent = eaten.filter((m) => m.date > addDaysISO(today, -7) && m.recipeId)
  const catCounts = new Map<string, number>()
  for (const m of recent) {
    const cat = categoryOf(byId.get(m.recipeId!))
    if (cat) catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  }
  const [topCat, topCount] = [...catCounts].sort((a, b) => b[1] - a[1])[0] ?? []
  if (topCat && topCount >= 3) {
    const alt = data.recipes
      .filter((r) => r.category && r.category !== topCat)
      .sort((a, b) => (lastCooked.get(a.id) ?? '').localeCompare(lastCooked.get(b.id) ?? ''))[0]
    tips.push({
      id: 'variety',
      icon: 'variety',
      tone: 'nudge',
      title: `${topCat} ${topCount} times this week`,
      detail: alt ? `Mix it up with ${alt.name}?` : 'Try something different next.',
      action: alt ? { kind: 'recipe', recipeId: alt.id, label: 'See it' } : undefined,
    })
  }

  // 5. Nothing planned for tomorrow
  const tomorrow = addDaysISO(today, 1)
  if (data.recipes.length > 0 && !data.meals.some((m) => m.date === tomorrow)) {
    tips.push({
      id: 'plan-tomorrow',
      icon: 'plan',
      tone: 'nudge',
      title: 'Nothing planned for tomorrow',
      detail: 'Planning ahead makes shopping one tap.',
      action: { kind: 'plan', date: tomorrow, label: 'Plan it' },
    })
  }

  // 6. A favorite you haven't had in a while
  const missed = data.recipes
    .filter((r) => r.favorite && lastCooked.has(r.id) && daysBetween(lastCooked.get(r.id)!, today) >= 14)
    .sort((a, b) => lastCooked.get(a.id)!.localeCompare(lastCooked.get(b.id)!))[0]
  if (missed) {
    const weeks = Math.floor(daysBetween(lastCooked.get(missed.id)!, today) / 7)
    tips.push({
      id: 'missed-' + missed.id,
      icon: 'favorite',
      tone: 'nudge',
      title: `You haven't had ${missed.name} in ${weeks} weeks`,
      detail: `A favorite — last made ${formatDate(lastCooked.get(missed.id)!)}`,
      action: { kind: 'recipe', recipeId: missed.id, label: 'Cook it' },
    })
  }

  // 7. Progress compared with last week
  const week = weekInsights(data.meals, today)
  const recipeMeals = (share: number, n: number) => Math.round((share / 100) * n)
  const nowHome = recipeMeals(week.recipeShare.value, week.meals.value)
  const thenHome = recipeMeals(week.recipeShare.previous, week.meals.previous)
  if (nowHome >= 3 && nowHome > thenHome) {
    tips.push({
      id: 'progress',
      icon: 'progress',
      tone: 'praise',
      title: `${nowHome} meals from your recipes this week`,
      detail: thenHome ? `${nowHome - thenHome} more than this time last week` : 'Up from none last week',
      action: { kind: 'tab', tab: 'insights', label: 'Insights' },
    })
  }

  // 8. Saved but never cooked
  const untried = data.recipes.find((r) => !lastCooked.has(r.id) && daysBetween(r.createdAt.slice(0, 10), today) >= 3)
  if (untried) {
    tips.push({
      id: 'untried-' + untried.id,
      icon: 'untried',
      tone: 'nudge',
      title: `Still haven't tried ${untried.name}`,
      detail: untried.prepMinutes ? `Takes about ${untried.prepMinutes} min` : 'Saved a while ago',
      action: { kind: 'recipe', recipeId: untried.id, label: 'Try it' },
    })
  }

  // 9. Shopping list waiting
  const toBuy = data.groceries.filter((g) => !g.checked).length
  if (toBuy > 0) {
    tips.push({
      id: 'shopping',
      icon: 'shopping',
      tone: 'nudge',
      title: `${toBuy} item${toBuy > 1 ? 's' : ''} on your shopping list`,
      action: { kind: 'tab', tab: 'kitchen', label: 'Open list' },
    })
  }

  return tips.slice(0, limit)
}

