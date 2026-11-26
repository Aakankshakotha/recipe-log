import { useMemo } from 'react'
import type { AppData, MealEntry, Member } from '../types'
import { useStore } from '../store'
import { findAvoided } from './ingredients'

export interface RecipeStats {
  timesCooked: number
  lastCooked: string | null
  avgRating: number | null
}

export function computeRecipeStats(meals: MealEntry[]): Map<string, RecipeStats> {
  const acc = new Map<string, { count: number; last: string | null; ratings: number[] }>()
  for (const m of meals) {
    if (!m.recipeId) continue
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

export function mealTitle(meal: MealEntry, data: AppData): string {
  if (meal.recipeId) return data.recipes.find((r) => r.id === meal.recipeId)?.name ?? meal.description
  return meal.description
}
