import { createContext, useContext } from 'react'

export type Tab = 'today' | 'journal' | 'collections' | 'favorites' | 'settings'

export interface Nav {
  go: (tab: Tab) => void
  openRecipe: (id: string) => void
  /** Opens the Journal straight on the "Log a recipe" form. */
  logRecipe: () => void
  cook: (recipeId: string) => void
  /** Leaves cook mode and opens the recipe on its "How did it go?" card. */
  finishCooking: (recipeId: string) => void
  toast: (message: string) => void
}

export const NavContext = createContext<Nav | null>(null)

export function useNav(): Nav {
  const nav = useContext(NavContext)
  if (!nav) throw new Error('useNav must be used inside NavContext')
  return nav
}
