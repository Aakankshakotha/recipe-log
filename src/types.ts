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
}

export interface AppData {
  recipes: Recipe[]
  meals: MealEntry[]
}
