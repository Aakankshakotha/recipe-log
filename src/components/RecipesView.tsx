import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { formatDate, type Store } from '../store'
import { RecipeForm } from './RecipeForm'

interface Props {
  store: Store
  onLogMeal: (recipeId: string) => void
}

type Mode = { kind: 'list' } | { kind: 'view'; id: string } | { kind: 'edit'; id: string | null }

export function RecipesView({ store, onLogMeal }: Props) {
  const { data, saveRecipe, deleteRecipe, toggleFavorite } = store
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const timesCooked = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of data.meals) {
      if (m.recipeId) counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1)
    }
    return counts
  }, [data.meals])

  const lastCooked = useMemo(() => {
    const last = new Map<string, string>()
    for (const m of data.meals) {
      if (m.recipeId && (last.get(m.recipeId) ?? '') < m.date) last.set(m.recipeId, m.date)
    }
    return last
  }, [data.meals])

  const categories = useMemo(
    () => [...new Set(data.recipes.map((r) => r.category).filter(Boolean))].sort(),
    [data.recipes],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.recipes
      .filter((r) => !favoritesOnly || r.favorite)
      .filter((r) => !category || r.category === category)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q)) ||
          r.ingredients.some((i) => i.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data.recipes, query, category, favoritesOnly])

  if (mode.kind === 'edit') {
    const initial = mode.id ? data.recipes.find((r) => r.id === mode.id) : undefined
    return (
      <RecipeForm
        initial={initial}
        onCancel={() => setMode(mode.id ? { kind: 'view', id: mode.id } : { kind: 'list' })}
        onSave={(r) => {
          saveRecipe(r)
          setMode({ kind: 'view', id: r.id })
        }}
      />
    )
  }

  const recipe = mode.kind === 'view' ? data.recipes.find((r) => r.id === mode.id) : undefined
  if (recipe) {
    return (
      <RecipeDetail
        recipe={recipe}
        timesCooked={timesCooked.get(recipe.id) ?? 0}
        lastCooked={lastCooked.get(recipe.id)}
        onBack={() => setMode({ kind: 'list' })}
        onEdit={() => setMode({ kind: 'edit', id: recipe.id })}
        onToggleFavorite={() => toggleFavorite(recipe.id)}
        onLogMeal={() => onLogMeal(recipe.id)}
        onDelete={() => {
          if (confirm(`Delete "${recipe.name}"? Meals already logged will be kept.`)) {
            deleteRecipe(recipe.id)
            setMode({ kind: 'list' })
          }
        }}
      />
    )
  }

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, ingredient or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
          />
          Favorites
        </label>
        <button onClick={() => setMode({ kind: 'edit', id: null })}>+ Add recipe</button>
      </div>

      {data.recipes.length === 0 ? (
        <div className="empty">
          <p>No recipes yet.</p>
          <button onClick={() => setMode({ kind: 'edit', id: null })}>Add your first recipe</button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="empty">No recipes match your filters.</p>
      ) : (
        <ul className="grid">
          {filtered.map((r) => (
            <li key={r.id}>
              <button className="card recipe-card" onClick={() => setMode({ kind: 'view', id: r.id })}>
                <div className="recipe-card-head">
                  <strong>{r.name}</strong>
                  {r.favorite && <span aria-label="favorite">★</span>}
                </div>
                <div className="meta">
                  {[r.category, r.prepMinutes != null && `${r.prepMinutes} min`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="meta">
                  Cooked {timesCooked.get(r.id) ?? 0}×
                  {lastCooked.get(r.id) && ` · last ${formatDate(lastCooked.get(r.id)!)}`}
                </div>
                {r.tags.length > 0 && (
                  <div className="tags">
                    {r.tags.map((t) => (
                      <span key={t} className="tag">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface DetailProps {
  recipe: Recipe
  timesCooked: number
  lastCooked?: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
  onLogMeal: () => void
}

function RecipeDetail({
  recipe,
  timesCooked,
  lastCooked,
  onBack,
  onEdit,
  onDelete,
  onToggleFavorite,
  onLogMeal,
}: DetailProps) {
  return (
    <article className="card detail">
      <button className="ghost back" onClick={onBack}>
        ← All recipes
      </button>
      <div className="detail-head">
        <h2>{recipe.name}</h2>
        <button className="ghost star" onClick={onToggleFavorite} title="Toggle favorite">
          {recipe.favorite ? '★' : '☆'}
        </button>
      </div>
      <div className="meta">
        {[
          recipe.category,
          recipe.prepMinutes != null && `${recipe.prepMinutes} min`,
          recipe.servings != null && `serves ${recipe.servings}`,
          `cooked ${timesCooked}×`,
          lastCooked && `last on ${formatDate(lastCooked)}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </div>
      {recipe.tags.length > 0 && (
        <div className="tags">
          {recipe.tags.map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      )}

      {recipe.ingredients.length > 0 && (
        <>
          <h3>Ingredients</h3>
          <ul className="ingredients">
            {recipe.ingredients.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </>
      )}
      {recipe.steps.length > 0 && (
        <>
          <h3>Steps</h3>
          <ol className="steps">
            {recipe.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {recipe.notes && (
        <>
          <h3>Notes</h3>
          <p className="notes">{recipe.notes}</p>
        </>
      )}

      <div className="actions">
        <button className="danger ghost" onClick={onDelete}>
          Delete
        </button>
        <button className="ghost" onClick={onEdit}>
          Edit
        </button>
        <button onClick={onLogMeal}>Log as eaten</button>
      </div>
    </article>
  )
}
