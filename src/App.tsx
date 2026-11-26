import { useCallback, useMemo, useRef, useState } from 'react'
import { BookOpen, CookingPot, Heart, House, Layers, Settings, SquarePen, type LucideIcon } from 'lucide-react'
import { StoreContext, useAppData } from './store'
import { NavContext, type Nav, type Tab } from './nav'
import { SyncContext, useSync } from './sync'
import { TodayView } from './components/TodayView'
import { JournalView } from './components/JournalView'
import { CollectionsView } from './components/CollectionsView'
import { SettingsView } from './components/SettingsView'
import { CookMode } from './components/CookMode'

type NavItem = { id: Tab | 'log'; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { id: 'today', label: 'Home', icon: House },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'log', label: 'Log a recipe', icon: SquarePen },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function App() {
  const store = useAppData()
  const sync = useSync(store.data, store.applyRemoteData)
  const [tab, setTab] = useState<Tab>('today')
  const [recipeId, setRecipeId] = useState<string | null>(null)
  const [compose, setCompose] = useState(0)
  const [justCookedId, setJustCookedId] = useState<string | null>(null)
  const [cookingId, setCookingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const toastTimer = useRef<number>(undefined)

  const go = useCallback((t: Tab) => {
    setTab(t)
    setCompose(0)
    setRecipeId(null)
    setJustCookedId(null)
    window.scrollTo({ top: 0 })
  }, [])

  const nav = useMemo<Nav>(
    () => ({
      go,
      openRecipe: (id) => {
        setTab('journal')
        setRecipeId(id)
        window.scrollTo({ top: 0 })
      },
      logRecipe: () => {
        setTab('journal')
        setRecipeId(null)
        setCompose((c) => c + 1)
        window.scrollTo({ top: 0 })
      },
      cook: setCookingId,
      finishCooking: (id) => {
        setCookingId(null)
        setTab('journal')
        setRecipeId(id)
        setJustCookedId(id)
        window.scrollTo({ top: 0 })
      },
      toast: (message) => {
        setToastMsg(message)
        window.clearTimeout(toastTimer.current)
        toastTimer.current = window.setTimeout(() => setToastMsg(null), 3200)
      },
    }),
    [go],
  )

  const cooking = cookingId ? store.data.recipes.find((r) => r.id === cookingId) : undefined
  const logging = tab === 'journal' && compose > 0

  return (
    <StoreContext.Provider value={store}>
      <SyncContext.Provider value={sync}>
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
              {NAV_ITEMS.map((t) => {
                const active = t.id === 'log' ? logging : t.id === 'journal' ? tab === 'journal' && !logging : tab === t.id
                return (
                  <button
                    key={t.id}
                    className={active ? 'tab active' : 'tab'}
                    onClick={() => (t.id === 'log' ? nav.logRecipe() : go(t.id))}
                    aria-current={active ? 'page' : undefined}
                  >
                    <t.icon className="tab-icon" size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                    <span className="tab-label">{t.label}</span>
                  </button>
                )
              })}
            </nav>
            <button className="profile" onClick={() => go('settings')}>
              <span className="avatar" aria-hidden>
                {(store.data.settings.name.trim() || 'You').charAt(0).toUpperCase()}
              </span>
              <span className="profile-text">
                <strong>{store.data.settings.name.trim() || 'Add your name'}</strong>
                <span>{store.data.recipes.length} recipes logged</span>
              </span>
            </button>
          </header>

          <main key={tab} className="view">
            {tab === 'today' && <TodayView />}
            {tab === 'journal' && (
              <JournalView
                key={compose}
                title="Journal"
                startInForm={compose > 0}
                onFormDone={() => setCompose(0)}
                openId={recipeId}
                setOpenId={setRecipeId}
                justCookedId={justCookedId}
              />
            )}
            {tab === 'favorites' && (
              <JournalView title="Favorites" onlyFavorites openId={recipeId} setOpenId={setRecipeId} />
            )}
            {tab === 'collections' && <CollectionsView openId={recipeId} setOpenId={setRecipeId} />}
            {tab === 'settings' && <SettingsView />}
          </main>
        </div>

        {cooking && <CookMode recipe={cooking} onClose={() => setCookingId(null)} />}
        {toastMsg && (
          <div className="toast" role="status">
            {toastMsg}
          </div>
        )}
      </NavContext.Provider>
      </SyncContext.Provider>
    </StoreContext.Provider>
  )
}
