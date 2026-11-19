import { createContext, useContext } from 'react'
import type { MealEntry } from './types'

export type Tab = 'today' | 'week' | 'recipes' | 'kitchen' | 'insights' | 'settings'

export interface Nav {
  go: (tab: Tab) => void
  openRecipe: (id: string) => void
  /** Opens the meal form: pass an existing meal to edit, or a partial draft for a new one. */
  editMeal: (draft: Partial<MealEntry>) => void
  cook: (recipeId: string) => void
  toast: (message: string) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('useNav must be used inside NavContext')
  return nav
}
