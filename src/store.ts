import { createContext, useContext, useEffect, useState } from 'react'
import type {
  AppData,
  CollectionKey,
  ItemOf,
  MealEntry,
  MealType,
  Recipe,
  Settings,
} from './types'
import { blobToDataURL, dataURLToBlob, deleteImage, getImage, saveImage } from './lib/images'
import { mealTypeNow, todayISO } from './lib/dates'

const STORAGE_KEY = 'recipe-log:v1'

export const newId = () => crypto.randomUUID()

const DEFAULT_SETTINGS: Settings = { name: '', theme: 'system', anthropicApiKey: '' }

/** Fills in fields added since older versions, so old saves and backups keep working. */
type Saved<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? Partial<U>[] : T[K] }

type OldMeal = { status?: string; leftoverId?: string | null }
const isLoggedCook = (m: Partial<MealEntry>) => {
  const old = m as OldMeal
  return old.status !== 'planned' && !old.leftoverId
}

/** Cooking-journal notes now live in the recipe's notes, one dated line each. */
function withOldJournal(notes: string | undefined, journal: { date: string; text: string }[] = []): string {
  return [notes ?? '', ...journal.map((j) => `${j.date}: ${j.text}`)].filter(Boolean).join('\n')
}

export function normalize(raw: Saved<AppData> | null | undefined): AppData {
  const r = raw ?? {}
  return {
    recipes: (r.recipes ?? []).map(({ journal, ...x }: Saved<Recipe> & { journal?: { date: string; text: string }[] }) =>
        ({
          name: 'Untitled recipe',
          category: '',
          prepMinutes: null,
          servings: null,
          ingredients: [],
          steps: [],
          tags: [],
          favorite: false,
          photoId: null,
          createdAt: new Date().toISOString(),
          ...x,
          notes: withOldJournal(x.notes, journal),
        }) as Recipe,
    ),
    // Planned meals and meals eaten from leftovers belonged to features that no longer exist
    meals: (r.meals ?? []).filter(isLoggedCook).map(
      (x) =>
        ({
          mealType: 'dinner',
          recipeId: null,
          description: '',
          rating: null,
          notes: '',
          photoId: null,
          eatenBy: [],
          ...x,
        }) as MealEntry,
    ),
    members: (r.members ?? []) as AppData['members'],
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

export function useAppData() {
  const [data, setData] = useState<AppData>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  // Keep other open tabs (or the installed app next to a browser tab) in sync instead of overwriting each other
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) setData(normalize(JSON.parse(e.newValue)))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

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

  /** Deletes a recipe together with every cook logged for it. */
  const deleteRecipe = (recipe: Recipe) => {
    if (recipe.photoId) deleteImage(recipe.photoId)
    setData((d) => {
      for (const m of d.meals) if (m.recipeId === recipe.id && m.photoId) deleteImage(m.photoId)
      return {
        ...d,
        recipes: d.recipes.filter((r) => r.id !== recipe.id),
        meals: d.meals.filter((m) => m.recipeId !== recipe.id),
      }
    })
  }

  const deleteMeal = (meal: MealEntry) => {
    if (meal.photoId) deleteImage(meal.photoId)
    remove('meals', meal.id)
  }

  /** Records one cook of a recipe: when, how it went, and an optional note or photo. */
  const logCooked = (
    recipeId: string,
    cook: { date?: string; mealType?: MealType; rating?: number | null; notes?: string; photoId?: string | null } = {},
  ) =>
    upsert('meals', {
      id: newId(),
      date: cook.date ?? todayISO(),
      mealType: cook.mealType ?? mealTypeNow(),
      recipeId,
      description: '',
      rating: cook.rating ?? null,
      notes: cook.notes?.trim() ?? '',
      photoId: cook.photoId ?? null,
      eatenBy: data.members.map((m) => m.id),
    })

  const replaceAll = (next: AppData) => setData(next)

  /** For sync: changes arriving from another device. */
  const applyRemoteData = (update: (d: AppData) => AppData) => setData(update)

  return {
    data,
    upsert,
    upsertMany,
    remove,
    updateSettings,
    deleteRecipe,
    deleteMeal,
    logCooked,
    replaceAll,
    applyRemoteData,
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
