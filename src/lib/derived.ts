import { useMemo } from 'react'
import type { AppData, MealEntry, Member, Recipe } from '../types'
import { itemKey, useStore } from '../store'
import { findAvoided, isStaple, parseIngredient, sameIngredient } from './ingredients'
import { addDaysISO, daysAgoISO } from './dates'

export interface RecipeStats {
  timesCooked: number
  lastCooked: string | null
  avgRating: number | null
}

export function computeRecipeStats(meals: MealEntry[]): Map<string, RecipeStats> {
  const acc = new Map<string, { count: number; last: string | null; ratings: number[] }>()
  for (const m of meals) {
    if (!m.recipeId || m.status !== 'eaten' || m.leftoverId) continue
    const s = acc.get(m.recipeId) ?? { count: 0, last: null, ratings: [] }
    s.count++
    if (!s.last || m.date > s.last) s.last = m.date
    if (m.rating != null) s.ratings.push(m.rating)
    acc.set(m.recipeId, s)
  }
  return new Map(
    [...acc].map(([id, s]) => [
      id,
      {
        timesCooked: s.count,
        lastCooked: s.last,
        avgRating: s.ratings.length ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : null,
      },
    ]),
  )
}

export function useRecipeStats() {
  const { data } = useStore()
  return useMemo(() => computeRecipeStats(data.meals), [data.meals])
}

export interface PantryMatch {
  have: string[]
  missing: string[]
}

/** Which of a recipe's ingredients are in the pantry. Staples (salt, oil…) count as "have". */
export function pantryMatch(recipe: Recipe, pantry: AppData['pantry']): PantryMatch {
  const keys = pantry.map((p) => itemKey(p.name))
  const have: string[] = []
  const missing: string[] = []
  for (const line of recipe.ingredients) {
    const { key } = parseIngredient(line)
    if (!key) continue
    if (isStaple(key) || keys.some((k) => sameIngredient(k, key))) have.push(line)
    else missing.push(line)
  }
  return { have, missing }
}

export function usePantryMatches() {
  const { data } = useStore()
  return useMemo(
    () => new Map(data.recipes.map((r) => [r.id, pantryMatch(r, data.pantry)])),
    [data.recipes, data.pantry],
  )
}

export interface AvoidWarning {
  member: Member
  matched: string[]
}

export function avoidWarnings(ingredients: string[], members: Member[]): AvoidWarning[] {
  return members
    .map((member) => ({ member, matched: findAvoided(ingredients, member.avoid) }))
    .filter((w) => w.matched.length > 0)
}

export const describeWarnings = (warnings: AvoidWarning[]) =>
  warnings.map((w) => `${w.member.name}: ${w.matched.join(', ')}`).join(' · ')

export interface QuickMeal {
  label: string
  recipeId: string | null
  description: string
  count: number
}

/** The meals logged most often in the last 60 days — for one-tap logging. */
export function frequentMeals(data: AppData, limit = 6): QuickMeal[] {
  const since = daysAgoISO(60)
  const counts = new Map<string, QuickMeal>()
  for (const m of data.meals) {
    if (m.status !== 'eaten' || m.date < since || m.leftoverId) continue
    const name = m.recipeId ? data.recipes.find((r) => r.id === m.recipeId)?.name : m.description
    if (!name) continue
    const key = m.recipeId ?? 'text:' + m.description.toLowerCase()
    const q = counts.get(key) ?? {
      label: name,
      recipeId: m.recipeId,
      description: m.recipeId ? '' : m.description,
      count: 0,
    }
    q.count++
    counts.set(key, q)
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

export function mealTitle(meal: MealEntry, data: AppData): string {
  if (meal.recipeId) return data.recipes.find((r) => r.id === meal.recipeId)?.name ?? meal.description
  if (meal.leftoverId) {
    const name = data.leftovers.find((l) => l.id === meal.leftoverId)?.name
    return meal.description || (name ? `${name} (leftovers)` : 'Leftovers')
  }
  return meal.description
}

/** Consecutive days with at least one eaten meal, ending today (or yesterday, if today is still empty). */
export function loggingStreak(meals: MealEntry[], today: string): number {
  const days = new Set(meals.filter((m) => m.status === 'eaten').map((m) => m.date))
  let d = days.has(today) ? today : addDaysISO(today, -1)
  let n = 0
  while (days.has(d)) {
    n++
    d = addDaysISO(d, -1)
  }
  return n
}
