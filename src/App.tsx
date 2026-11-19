import { useRef, useState, type ChangeEvent } from 'react'
import { todayISO, useAppData } from './store'
import type { AppData, MealEntry } from './types'
import { RecipesView } from './components/RecipesView'
import { MealLogView } from './components/MealLogView'
import { InsightsView } from './components/InsightsView'

type Tab = 'meals' | 'recipes' | 'insights'

const TABS: { id: Tab; label: string }[] = [
  { id: 'meals', label: 'Meal log' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'insights', label: 'Insights' },
]

export default function App() {
  const store = useAppData()
  const [tab, setTab] = useState<Tab>('meals')
  const [mealDraft, setMealDraft] = useState<Partial<MealEntry> | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const exportData = () => {
    const blob = new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recipe-log-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as AppData
      if (!Array.isArray(parsed.recipes) || !Array.isArray(parsed.meals)) throw new Error()
      if (confirm('Replace all current recipes and meals with this backup?')) {
        store.replaceAll(parsed)
      }
    } catch {
      alert('That file doesn’t look like a Recipe Log backup.')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🍲 Recipe Log</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="backup">
          <button className="ghost small" onClick={exportData} title="Download a backup file">
            Export
          </button>
          <button
            className="ghost small"
            onClick={() => fileInput.current?.click()}
            title="Restore from a backup file"
          >
            Import
          </button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={importData} />
        </div>
      </header>

      <main>
        {tab === 'meals' && (
          <MealLogView store={store} draft={mealDraft} setDraft={setMealDraft} />
        )}
        {tab === 'recipes' && (
          <RecipesView
            store={store}
            onLogMeal={(recipeId) => {
              setMealDraft({ recipeId, date: todayISO() })
              setTab('meals')
            }}
          />
        )}
        {tab === 'insights' && <InsightsView data={store.data} />}
      </main>
    </div>
  )
}
