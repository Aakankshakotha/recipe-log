import { createContext, useContext, useEffect, useState } from 'react'
import type {
  AppData,
  CollectionKey,
  GroceryItem,
  ItemOf,
  Leftover,
  MealEntry,
  PantryItem,
  Recipe,
  Settings,
} from './types'
import { blobToDataURL, dataURLToBlob, deleteImage, getImage, saveImage } from './lib/images'
import {
  guessSection,
  isStaple,
  mergeIngredients,
  normalizeName,
  sameIngredient,
} from './lib/ingredients'
import { todayISO } from './lib/dates'

const STORAGE_KEY = 'recipe-log:v1'

export const newId = () => crypto.randomUUID()

const DEFAULT_SETTINGS: Settings = { theme: 'system', anthropicApiKey: '' }

/** Fills in fields added since older versions, so old saves and backups keep working. */
type Saved<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? Partial<U>[] : T[K] }

export function normalize(raw: Saved<AppData> | null | undefined): AppData {
  const r = raw ?? {}
  return {
    recipes: (r.recipes ?? []).map((x) => ({ photoId: null, journal: [], tags: [], ...x }) as Recipe),
    meals: (r.meals ?? []).map(
      (x) => ({ status: 'eaten', leftoverId: null, photoId: null, eatenBy: [], ...x }) as MealEntry,
    ),
    members: (r.members ?? []) as AppData['members'],
    groceries: (r.groceries ?? []) as AppData['groceries'],
    pantry: (r.pantry ?? []) as AppData['pantry'],
    leftovers: (r.leftovers ?? []) as AppData['leftovers'],
    recurring: (r.recurring ?? []) as AppData['recurring'],
    templates: (r.templates ?? []) as AppData['templates'],
    settings: { ...DEFAULT_SETTINGS, ...r.settings },
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalize(raw ? JSON.parse(raw) : null)
  } catch {
    return normalize(null)
  }
}

/** Normalized name for matching pantry / shopping items against recipe ingredients. */
export const itemKey = (name: string) => normalizeName(name) || name.toLowerCase().trim()

export function useAppData() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    const root = document.documentElement
    if (data.settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', data.settings.theme)
  }, [data.settings.theme])

  /** Insert or replace by id. New items go to the end. */
  function upsert<K extends CollectionKey>(key: K, item: ItemOf<K>) {
    setData((d) => {
      const list = d[key] as ItemOf<K>[]
      const exists = list.some((x) => x.id === item.id)
      return {
        ...d,
        [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
      }
    })
  }

  function upsertMany<K extends CollectionKey>(key: K, items: ItemOf<K>[]) {
    items.forEach((item) => upsert(key, item))
  }

  function remove<K extends CollectionKey>(key: K, id: string) {
    setData((d) => ({ ...d, [key]: (d[key] as ItemOf<K>[]).filter((x) => x.id !== id) }))
  }

  const updateSettings = (patch: Partial<Settings>) =>
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const deleteRecipe = (recipe: Recipe) => {
    if (recipe.photoId) deleteImage(recipe.photoId)
    setData((d) => ({
      ...d,
      recipes: d.recipes.filter((r) => r.id !== recipe.id),
      // Keep meal history, but detach it from the deleted recipe
      meals: d.meals.map((m) =>
        m.recipeId === recipe.id
          ? { ...m, recipeId: null, description: m.description || recipe.name }
          : m,
      ),
      recurring: d.recurring.filter((x) => x.recipeId !== recipe.id),
    }))
  }

  const deleteMeal = (meal: MealEntry) => {
    if (meal.photoId) deleteImage(meal.photoId)
    remove('meals', meal.id)
  }

  /** Takes one portion from a leftover; removes it when none are left. */
  const takeLeftoverPortion = (leftoverId: string) =>
    setData((d) => ({
      ...d,
      leftovers: d.leftovers
        .map((l) => (l.id === leftoverId ? { ...l, portions: l.portions - 1 } : l))
        .filter((l) => l.portions > 0),
    }))

  /**
   * Adds ingredients to the shopping list, skipping staples, what's in the pantry and what's
   * already listed. Returns how many items were added.
   */
  const addIngredientsToGroceries = (lines: string[]): number => {
    const fresh: GroceryItem[] = []
    for (const m of mergeIngredients(lines)) {
      if (isStaple(m.key)) continue
      if (data.pantry.some((p) => sameIngredient(m.key, itemKey(p.name)))) continue
      if (data.groceries.some((g) => !g.checked && sameIngredient(m.key, itemKey(g.name)))) continue
      fresh.push({
        id: newId(),
        name: m.name,
        quantity: m.quantity,
        section: guessSection(m.name),
        checked: false,
      })
    }
    setData((d) => ({ ...d, groceries: [...d.groceries, ...fresh] }))
    return fresh.length
  }

  /** Moves checked shopping items into the pantry. */
  const moveCheckedToPantry = () =>
    setData((d) => {
      const pantry: PantryItem[] = [...d.pantry]
      for (const g of d.groceries.filter((g) => g.checked)) {
        if (pantry.some((p) => sameIngredient(itemKey(p.name), itemKey(g.name)))) continue
        pantry.push({ id: newId(), name: g.name, quantity: g.quantity, section: g.section, expires: null })
      }
      return { ...d, pantry, groceries: d.groceries.filter((g) => !g.checked) }
    })

  const clearChecked = () =>
    setData((d) => ({ ...d, groceries: d.groceries.filter((g) => !g.checked) }))

  const removePantryItems = (ids: string[]) =>
    setData((d) => ({ ...d, pantry: d.pantry.filter((p) => !ids.includes(p.id)) }))

  const addLeftover = (leftover: Omit<Leftover, 'id'>) =>
    upsert('leftovers', { ...leftover, id: newId() })

  const replaceAll = (next: AppData) => setData(next)

  return {
    data,
    upsert,
    upsertMany,
    remove,
    updateSettings,
    deleteRecipe,
    deleteMeal,
    takeLeftoverPortion,
    addIngredientsToGroceries,
    moveCheckedToPantry,
    clearChecked,
    removePantryItems,
    addLeftover,
    replaceAll,
  }
}

export type Store = ReturnType<typeof useAppData>

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreContext')
  return store
}

// ---- Backup -------------------------------------------------------------

interface Backup extends AppData {
  images?: Record<string, string> // id → data URL
  exportedAt?: string
}

export async function exportBackup(data: AppData) {
  const ids = [...data.recipes, ...data.meals].map((x) => x.photoId).filter((x): x is string => !!x)
  const images: Record<string, string> = {}
  for (const id of ids) {
    const blob = await getImage(id)
    if (blob) images[id] = await blobToDataURL(blob)
  }
  const backup: Backup = {
    ...data,
    settings: { ...data.settings, anthropicApiKey: '' }, // never put the API key in a file
    images,
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `recipe-log-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function readBackup(file: File): Promise<AppData> {
  const parsed = JSON.parse(await file.text()) as Backup
  if (!Array.isArray(parsed.recipes) || !Array.isArray(parsed.meals)) {
    throw new Error('Not a Recipe Log backup')
  }
  for (const [id, dataUrl] of Object.entries(parsed.images ?? {})) {
    await saveImage(await dataURLToBlob(dataUrl), id)
  }
  return normalize(parsed)
}
