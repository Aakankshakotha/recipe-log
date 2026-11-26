export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface Recipe {
  id: string
  name: string
  category: string
  prepMinutes: number | null
  servings: number | null
  ingredients: string[]
  steps: string[]
  notes: string
  tags: string[]
  favorite: boolean
  photoId: string | null
  createdAt: string
}

export interface MealEntry {
  id: string
  date: string // YYYY-MM-DD
  mealType: MealType
  recipeId: string | null
  description: string // free text when no recipe, or extra detail
  rating: number | null // 1-5
  notes: string
  photoId: string | null
  eatenBy: string[] // member ids
}

export interface Member {
  id: string
  name: string
  avoid: string[] // allergies / foods they don't eat, lowercase keywords
}

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  name: string
  theme: Theme
  anthropicApiKey: string
}

export interface AppData {
  recipes: Recipe[]
  meals: MealEntry[]
  members: Member[]
  settings: Settings
}

/** The list-shaped parts of AppData, keyed by name — used by the generic upsert/remove helpers. */
export type Collections = {
  [K in keyof AppData as AppData[K] extends { id: string }[] ? K : never]: AppData[K]
}
export type CollectionKey = keyof Collections
export type ItemOf<K extends CollectionKey> = Collections[K][number]
