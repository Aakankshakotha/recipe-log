import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { daysBetween, formatDate, todayISO } from '../lib/dates'
import { avoidWarnings, usePantryMatches, useRecipeStats } from '../lib/derived'
import { RecipeForm } from './RecipeForm'
import { RecipeDetail } from './RecipeDetail'
import { ImportRecipe } from './ImportRecipe'
import { Empty, Photo, Segmented } from './ui'

interface Props {
  openId: string | null
  setOpenId: (id: string | null) => void
}

type Sort = 'name' | 'recent' | 'most' | 'canCook'

export function RecipesView({ openId, setOpenId }: Props) {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const stats = useRecipeStats()
  const matches = usePantryMatches()
  const [editing, setEditing] = useState<Partial<Recipe> | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('name')

  const categories = useMemo(
    () => [...new Set(data.recipes.map((r) => r.category).filter(Boolean))].sort(),
    [data.recipes],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = data.recipes
      .filter((r) => !favoritesOnly || r.favorite)
      .filter((r) => !category || r.category === category)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.ingredients.some((i) => i.toLowerCase().includes(q)),
      )
    const last = (r: Recipe) => stats.get(r.id)?.lastCooked ?? ''
    const count = (r: Recipe) => stats.get(r.id)?.timesCooked ?? 0
    const missing = (r: Recipe) => matches.get(r.id)?.missing.length ?? 99
    const byName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name)
    const sorters: Record<Sort, (a: Recipe, b: Recipe) => number> = {
      name: byName,
      recent: (a, b) => last(b).localeCompare(last(a)) || byName(a, b),
      most: (a, b) => count(b) - count(a) || byName(a, b),
      canCook: (a, b) => missing(a) - missing(b) || byName(a, b),
    }
    return list.sort(sorters[sort])
  }, [data.recipes, query, category, favoritesOnly, sort, stats, matches])

  const surpriseMe = () => {
    // Weighted toward favorites and recipes not cooked for a while
    const pool = filtered.length ? filtered : data.recipes
    const weights = pool.map((r) => {
      const last = stats.get(r.id)?.lastCooked
      const daysSince = last ? daysBetween(last, todayISO()) : 60
      return (r.favorite ? 2 : 1) * Math.min(60, Math.max(1, daysSince))
    })
    let pick = Math.random() * weights.reduce((a, b) => a + b, 0)
    const idx = weights.findIndex((w) => (pick -= w) <= 0)
    setOpenId(pool[Math.max(0, idx)].id)
  }

  if (editing) {
    return (
      <RecipeForm
        initial={editing}
        onCancel={() => setEditing(null)}
        onSave={(r) => {
          store.upsert('recipes', r)
          setEditing(null)
          setOpenId(r.id)
          nav.toast('Recipe saved')
        }}
      />
    )
  }

  const open = openId ? data.recipes.find((r) => r.id === openId) : undefined
  if (open) {
    return <RecipeDetail recipe={open} onBack={() => setOpenId(null)} onEdit={() => setEditing(open)} />
  }

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search name, ingredient or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="toolbar-actions">
          {data.recipes.length > 1 && (
            <button className="ghost small" onClick={surpriseMe} title="Pick something for me">
              🎲 Surprise me
            </button>
          )}
          <button className="ghost small" onClick={() => setImporting(true)}>
            ✨ Import
          </button>
          <button onClick={() => setEditing({})}>+ Add recipe</button>
        </div>
      </div>
      {data.recipes.length > 0 && (
        <div className="toolbar filters">
          <Segmented
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'A–Z' },
              { value: 'recent', label: 'Recent' },
              { value: 'most', label: 'Most cooked' },
              { value: 'canCook', label: 'Can cook now' },
            ]}
          />
          {categories.length > 0 && (
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <button
            className={`chip ${favoritesOnly ? 'on' : ''}`}
            onClick={() => setFavoritesOnly(!favoritesOnly)}
          >
            ★ Favorites
          </button>
        </div>
      )}
      <datalist id="categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {data.recipes.length === 0 ? (
        <Empty icon="📖" title="No recipes yet">
          <p className="muted">Type one in, or snap a photo of a cookbook page to import it.</p>
          <div className="row-actions center">
            <button onClick={() => setEditing({})}>Add a recipe</button>
            <button className="ghost" onClick={() => setImporting(true)}>
              ✨ Import from photo or text
            </button>
          </div>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty icon="🔍" title="No recipes match your filters" />
      ) : (
        <ul className="grid">
          {filtered.map((r) => {
            const s = stats.get(r.id)
            const m = matches.get(r.id)
            const warn = avoidWarnings([r.name, ...r.ingredients], data.members)
            return (
              <li key={r.id}>
                <button className="card recipe-card" onClick={() => setOpenId(r.id)}>
                  <Photo id={r.photoId} alt="" className="recipe-photo" fallback={<span>🍲</span>} />
                  <div className="recipe-card-body">
                    <div className="recipe-card-head">
                      <strong>{r.name}</strong>
                      {r.favorite && <span className="fav">★</span>}
                    </div>
                    <div className="muted small">
                      {[r.category, r.prepMinutes != null && `${r.prepMinutes} min`].filter(Boolean).join(' · ')}
                    </div>
                    <div className="muted small">
                      {s ? `Cooked ${s.timesCooked}× · last ${formatDate(s.lastCooked!)}` : 'Not cooked yet'}
                    </div>
                    <div className="tags">
                      {sort === 'canCook' && m && r.ingredients.length > 0 && (
                        <span className={`tag ${m.missing.length === 0 ? 'good' : ''}`}>
                          {m.missing.length === 0 ? '✓ have everything' : `missing ${m.missing.length}`}
                        </span>
                      )}
                      {warn.length > 0 && (
                        <span className="tag warn" title={warn.map((w) => w.member.name).join(', ')}>
                          ⚠️ {warn.map((w) => w.member.name).join(', ')}
                        </span>
                      )}
                      {r.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
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
