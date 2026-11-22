import { useCallback, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ChartColumn,
  CookingPot,
  House,
  Settings,
  ShoppingBasket,
  type LucideIcon,
} from 'lucide-react'
import { StoreContext, useAppData } from './store'
import { NavContext, type Nav, type Tab } from './nav'
import type { MealEntry } from './types'
import { TodayView } from './components/TodayView'
import { WeekView } from './components/WeekView'
import { RecipesView } from './components/RecipesView'
import { KitchenView } from './components/KitchenView'
import { InsightsView } from './components/InsightsView'
import { SettingsView } from './components/SettingsView'
import { MealForm } from './components/MealForm'
import { CookMode } from './components/CookMode'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Home', icon: House },
  { id: 'week', label: 'Planner', icon: CalendarDays },
  { id: 'recipes', label: 'Recipes', icon: BookOpen },
  { id: 'kitchen', label: 'Kitchen', icon: ShoppingBasket },
  { id: 'insights', label: 'Insights', icon: ChartColumn },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function App() {
  const store = useAppData()
  const [tab, setTab] = useState<Tab>('today')
  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [mealDraft, setMealDraft] = useState<Partial<MealEntry> | null>(null)
  const [cookingId, setCookingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<number>(undefined)

  const go = useCallback((t: Tab) => {
    setTab(t)
    if (t === 'recipes') setRecipeId(null)
    window.scrollTo({ top: 0 })
  }, [])

  const nav = useMemo<Nav>(
    () => ({
      go,
      openRecipe: (id) => {
        setTab('recipes')
        setRecipeId(id)
        window.scrollTo({ top: 0 })
      },
      editMeal: setMealDraft,
      cook: setCookingId,
      toast: (message) => {
        setToastMsg(message)
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200)
      },
    }),
    [go],
  )

  const cooking = cookingId ? store.data.recipes.find((r) => r.id === cookingId) : undefined
  const unchecked = store.data.groceries.filter((g) => !g.checked).length

  return (
    <StoreContext.Provider value={store}>
      <NavContext.Provider value={nav}>
        <div className="app">
          <header className="header">
            <button className="brand" onClick={() => go('today')}>
              <span className="brand-icon" aria-hidden>
                <CookingPot size={18} strokeWidth={2.2} />
              </span>
              <span>Recipe Log</span>
            </button>
            <nav className="tabs" aria-label="Main">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? 'tab active' : 'tab'}
                  onClick={() => go(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                >
                  <t.icon className="tab-icon" size={20} strokeWidth={tab === t.id ? 2.2 : 1.8} aria-hidden />
                  <span className="tab-label">{t.label}</span>
                  {t.id === 'kitchen' && unchecked > 0 && <span className="badge">{unchecked}</span>}
                </button>
              ))}
            </nav>
            <button className="profile" onClick={() => go('settings')}>
              <span className="avatar" aria-hidden>
                {(store.data.settings.name.trim() || 'You').charAt(0).toUpperCase()}
              </span>
              <span className="profile-text">
                <strong>{store.data.settings.name.trim() || 'Add your name'}</strong>
                <span>{store.data.meals.filter((m) => m.status === 'eaten').length} meals logged</span>
              </span>
            </button>
          </header>

          <main key={tab} className="view">
            {tab === 'today' && <TodayView />}
            {tab === 'week' && <WeekView />}
            {tab === 'recipes' && <RecipesView openId={recipeId} setOpenId={setRecipeId} />}
            {tab === 'kitchen' && <KitchenView />}
            {tab === 'insights' && <InsightsView />}
            {tab === 'settings' && <SettingsView />}
          </main>
        </div>

        {mealDraft && <MealForm initial={mealDraft} onClose={() => setMealDraft(null)} />}
        {cooking && <CookMode recipe={cooking} onClose={() => setCookingId(null)} />}
        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </NavContext.Provider>
    </StoreContext.Provider>
  )
}
