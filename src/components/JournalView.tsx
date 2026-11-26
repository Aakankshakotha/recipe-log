import { NotebookPen, Plus, Search, Shuffle, Sparkles, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { daysBetween, formatDate, todayISO } from '../lib/dates'
import { useRecipeStats } from '../lib/derived'
import { RecipeForm } from './RecipeForm'
import { RecipeDetail } from './RecipeDetail'
import { ImportRecipe } from './ImportRecipe'
import { DishImage, Empty } from './ui'

interface Props {
  title: string
  openId: string | null
  setOpenId: (id: string | null) => void
  /** Show only favorites. */
  onlyFavorites?: boolean
  /** Show only recipes with this tag (a collection). */
  tag?: string
  startInForm?: boolean
  onFormDone?: () => void
  /** A recipe just finished in cook mode: open its "How did it go?" card. */
  justCookedId?: string | null
}

type Sort = 'recent' | 'rating' | 'most' | 'name'

/** A photo gallery of recipes, most recently cooked first. Also hosts the recipe page and the log form. */
export function JournalView({ title, openId, setOpenId, onlyFavorites, tag, startInForm, onFormDone, justCookedId }: Props) {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const stats = useRecipeStats()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [notCooked, setNotCooked] = useState(false)
  const [editing, setEditing] = useState<Partial<Recipe> | null>(startInForm ? {} : null)
  const [importing, setImporting] = useState(false)

  const scoped = useMemo(
    () => data.recipes.filter((r) => (!onlyFavorites || r.favorite) && (!tag || r.tags.includes(tag))),
    [data.recipes, onlyFavorites, tag],
  )
  const categories = useMemo(() => [...new Set(scoped.map((r) => r.category).filter(Boolean))].sort(), [scoped])

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const last = (r: Recipe) => stats.get(r.id)?.lastCooked ?? ''
    const rating = (r: Recipe) => stats.get(r.id)?.avgRating ?? 0
    const count = (r: Recipe) => stats.get(r.id)?.timesCooked ?? 0
    const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name)
    const sorters: Record<Sort, (a: Recipe, b: Recipe) => number> = {
      recent: (a, b) => last(b).localeCompare(last(a)) || byName(a, b),
      rating: (a, b) => rating(b) - rating(a) || byName(a, b),
      most: (a, b) => count(b) - count(a) || byName(a, b),
      name: byName,
    }
    return scoped
      .filter((r) => !category || r.category === category)
      .filter((r) => !notCooked || !stats.has(r.id))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)))
      .sort(sorters[sort])
  }, [scoped, stats, query, category, sort, notCooked])

  const surpriseMe = () => {
    // Weighted toward favorites and recipes not cooked for a while
    const pool = entries.length ? entries : scoped
    const weights = pool.map((r) => {
      const last = stats.get(r.id)?.lastCooked
      const daysSince = last ? daysBetween(last, todayISO()) : 60
      return (r.favorite ? 2 : 1) * Math.min(60, Math.max(1, daysSince))
    })
    let pick = Math.random() * weights.reduce((a, b) => a + b, 0)
    const idx = weights.findIndex((w) => (pick -= w) <= 0)
    setOpenId(pool[Math.max(0, idx)].id)
  }

  const closeForm = () => {
    setEditing(null)
    onFormDone?.()
  }

  if (editing) {
    return (
      <>
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <RecipeForm
          initial={editing}
          onCancel={closeForm}
          onSave={(r, logged) => {
            store.upsert('recipes', r)
            if (logged) store.logCooked(r.id, logged)
            closeForm()
            setOpenId(r.id)
            nav.toast('Recipe saved')
          }}
        />
      </>
    )
  }

  const open = openId ? data.recipes.find((r) => r.id === openId) : undefined
  if (open) {
    return (
      <RecipeDetail
        key={open.id}
        recipe={open}
        startLogging={justCookedId === open.id}
        onBack={() => setOpenId(null)}
        onEdit={() => setEditing(open)}
      />
    )
  }

  const filtering = !!query || !!category || notCooked

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">{title}</h1>
        <div className="toolbar-actions">
          {scoped.length > 1 && (
            <button className="ghost small" onClick={surpriseMe} title="Pick something for me">
              <Shuffle size={15} aria-hidden /> Surprise me
            </button>
          )}
          <button className="ghost small" onClick={() => setImporting(true)}>
            <Sparkles size={15} aria-hidden /> Import
          </button>
          <button onClick={() => setEditing({})}>
            <Plus size={17} aria-hidden /> Log a recipe
          </button>
        </div>
      </header>

      {scoped.length > 0 && (
        <div className="toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search your recipes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
            <option value="recent">Recently cooked</option>
            <option value="rating">Highest rated</option>
            <option value="most">Most cooked</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      )}

      {scoped.length > 0 && (
        <div className="chips journal-filters">
          {['', ...categories].map((c) => (
            <button key={c} className={`chip ${category === c ? 'on' : ''}`} onClick={() => setCategory(c)}>
              {c || 'All'}
            </button>
          ))}
          <button className={`chip ${notCooked ? 'on' : ''}`} onClick={() => setNotCooked(!notCooked)}>
            Not cooked yet
          </button>
        </div>
      )}

      {scoped.length === 0 ? (
        onlyFavorites ? (
          <Empty icon={<NotebookPen size={28} />} title="No favorites yet">
            <p className="muted">Tap the heart on a recipe to keep it here.</p>
          </Empty>
        ) : tag ? (
          <Empty icon={<NotebookPen size={28} />} title="Nothing in this collection" />
        ) : (
          <Empty icon={<NotebookPen size={28} />} title="Your journal is empty">
            <p className="muted">Log a recipe, or snap a photo of a cookbook page to import it.</p>
            <div className="row-actions center">
              <button onClick={() => setEditing({})}>Log a recipe</button>
              <button className="ghost" onClick={() => setImporting(true)}>
                <Sparkles size={15} aria-hidden /> Import from photo or text
              </button>
            </div>
          </Empty>
        )
      ) : entries.length === 0 ? (
        <Empty icon={<Search size={28} />} title={filtering ? 'Nothing matches your filters' : 'Nothing here'} />
      ) : (
        <ul className="grid journal-grid">
          {entries.map((r) => {
            const s = stats.get(r.id)
            const meta = [
              s?.lastCooked ? formatDate(s.lastCooked) : 'Not cooked yet',
              r.prepMinutes != null && `${r.prepMinutes} min`,
            ].filter(Boolean)
            return (
              <li key={r.id}>
                <button className="card recipe-card journal-card" onClick={() => setOpenId(r.id)}>
                  <div className="journal-photo">
                    <DishImage photoId={r.photoId} name={r.name} category={r.category} className="recipe-photo" />
                    {r.category && <span className="journal-badge">{r.category}</span>}
                  </div>
                  <div className="recipe-card-body">
                    <strong className="journal-title">{r.name}</strong>
                    <div className="journal-meta muted small">
                      <span>{meta.join(' · ')}</span>
                      {s?.avgRating != null && (
                        <span className="journal-rating">
                          <Star size={13} fill="currentColor" aria-hidden /> {Math.round(s.avgRating * 10) / 10}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {importing && (
        <ImportRecipe
          onClose={() => setImporting(false)}
          onImported={(draft) => {
            setImporting(false)
            setEditing(draft)
          }}
        />
      )}
    </section>
  )
}
