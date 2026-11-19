import { useEffect, useState } from 'react'
import type { AppData, MealEntry, Recipe } from './types'

const STORAGE_KEY = 'recipe-log:v1'

const EMPTY: AppData = { recipes: [], meals: [] }

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<AppData>
    return { recipes: parsed.recipes ?? [], meals: parsed.meals ?? [] }
  } catch {
    return EMPTY
  }
}

export const newId = () => crypto.randomUUID()

export const todayISO = () => toISODate(new Date())

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  const saveRecipe = (recipe: Recipe) =>
    setData((d) => {
      const exists = d.recipes.some((r) => r.id === recipe.id)
      return {
        ...d,
        recipes: exists
          ? d.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [recipe, ...d.recipes],
      }
    })

  const deleteRecipe = (id: string) =>
    setData((d) => ({
      recipes: d.recipes.filter((r) => r.id !== id),
      // Keep meal history, but detach it from the deleted recipe
      meals: d.meals.map((m) => {
        if (m.recipeId !== id) return m
        const name = d.recipes.find((r) => r.id === id)?.name ?? ''
        return { ...m, recipeId: null, description: m.description || name }
      }),
    }))

  const toggleFavorite = (id: string) =>
    setData((d) => ({
      ...d,
      recipes: d.recipes.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)),
    }))

  const saveMeal = (meal: MealEntry) =>
    setData((d) => {
      const exists = d.meals.some((m) => m.id === meal.id)
      return {
        ...d,
        meals: exists ? d.meals.map((m) => (m.id === meal.id ? meal : m)) : [...d.meals, meal],
      }
    })

  const deleteMeal = (id: string) =>
    setData((d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }))

  const replaceAll = (next: AppData) => setData(next)

  return { data, saveRecipe, deleteRecipe, toggleFavorite, saveMeal, deleteMeal, replaceAll }
}

export type Store = ReturnType<typeof useAppData>

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
