export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface JournalNote {
  id: string
  date: string // YYYY-MM-DD
  text: string
}

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
  journal: JournalNote[]
  createdAt: string
}

export type MealStatus = 'planned' | 'eaten'

export interface MealEntry {
  id: string
  date: string // YYYY-MM-DD
  mealType: MealType
  status: MealStatus
  recipeId: string | null
  leftoverId: string | null // eaten from leftovers
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

export type GrocerySection =
  | 'Produce'
  | 'Dairy & eggs'
  | 'Meat & fish'
  | 'Bakery'
  | 'Grains & pulses'
  | 'Spices & condiments'
  | 'Frozen'
  | 'Snacks & drinks'
  | 'Household'
  | 'Other'

export interface GroceryItem {
  id: string
  name: string
  quantity: string
  section: GrocerySection
  checked: boolean
}

export interface PantryItem {
  id: string
  name: string
  quantity: string
  section: GrocerySection
  expires: string | null // YYYY-MM-DD
}

export interface Leftover {
  id: string
  name: string
  recipeId: string | null
  madeOn: string // YYYY-MM-DD
  eatBy: string // YYYY-MM-DD
  portions: number
}

/** A meal that repeats on a weekday, e.g. "Friday = pizza night". weekday: 0 = Monday. */
export interface RecurringMeal {
  id: string
  weekday: number
  mealType: MealType
  recipeId: string | null
  description: string
}

export interface TemplateMeal {
  weekday: number // 0 = Monday
  mealType: MealType
  recipeId: string | null
  description: string
}

export interface WeekTemplate {
  id: string
  name: string
  meals: TemplateMeal[]
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
  groceries: GroceryItem[]
  pantry: PantryItem[]
  leftovers: Leftover[]
  recurring: RecurringMeal[]
  templates: WeekTemplate[]
  settings: Settings
}

/** The list-shaped parts of AppData, keyed by name — used by the generic upsert/remove helpers. */
export type Collections = {
  [K in keyof AppData as AppData[K] extends { id: string }[] ? K : never]: AppData[K]
}
export type CollectionKey = keyof Collections
export type ItemOf<K extends CollectionKey> = Collections[K][number]
