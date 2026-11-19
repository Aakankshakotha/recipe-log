import { useState } from 'react'
import type { Recipe } from '../types'
import { itemKey, newId, useStore } from '../store'
import { useNav } from '../nav'
import { formatDate, todayISO } from '../lib/dates'
import { parseIngredient, sameIngredient, scaleIngredient } from '../lib/ingredients'
import { avoidWarnings, useRecipeStats } from '../lib/derived'
import { Photo } from './ui'

interface Props {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
}

export function RecipeDetail({ recipe, onBack, onEdit }: Props) {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const stats = useRecipeStats().get(recipe.id)
  const base = recipe.servings ?? 0
  const [servings, setServings] = useState(base || 1)
  const [note, setNote] = useState('')
  const factor = base ? servings / base : servings

  const pantryKeys = data.pantry.map((p) => itemKey(p.name))
  const inPantry = (line: string) => {
    const { key } = parseIngredient(line)
    return !!key && pantryKeys.some((k) => sameIngredient(k, key))
  }
  const warnings = avoidWarnings([recipe.name, ...recipe.ingredients], data.members)
  const scaled = recipe.ingredients.map((l) => scaleIngredient(l, factor))

  const addJournal = () => {
    if (!note.trim()) return
    store.upsert('recipes', {
      ...recipe,
      journal: [{ id: newId(), date: todayISO(), text: note.trim() }, ...recipe.journal],
    })
    setNote('')
  }

  const shop = () => {
    const added = store.addIngredientsToGroceries(scaled)
    nav.toast(added ? `Added ${added} items to your shopping list` : 'You already have everything')
  }

  const remove = () => {
    if (confirm(`Delete “${recipe.name}”? Meals already logged will be kept.`)) {
      store.deleteRecipe(recipe)
      onBack()
    }
  }

  return (
    <article className="detail">
      <button className="ghost small back" onClick={onBack}>
        ‹ All recipes
      </button>
      <div className="card detail-card">
        {recipe.photoId && <Photo id={recipe.photoId} alt={recipe.name} className="detail-photo" />}
        <div className="detail-body">
          <div className="detail-head">
            <h2>{recipe.name}</h2>
            <button
              className={`icon-btn fav-btn ${recipe.favorite ? 'on' : ''}`}
              onClick={() => store.upsert('recipes', { ...recipe, favorite: !recipe.favorite })}
              aria-label="Toggle favorite"
            >
              {recipe.favorite ? '★' : '☆'}
            </button>
          </div>
          <div className="muted">
            {[
              recipe.category,
              recipe.prepMinutes != null && `⏱ ${recipe.prepMinutes} min`,
              stats ? `cooked ${stats.timesCooked}×, last ${formatDate(stats.lastCooked!)}` : 'not cooked yet',
              stats?.avgRating != null && `★ ${stats.avgRating.toFixed(1)}`,
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
          {warnings.length > 0 && (
            <p className="warning">
              ⚠️ {warnings.map((w) => `${w.member.name} avoids ${w.matched.join(', ')}`).join(' · ')}
            </p>
          )}

          <div className="primary-actions">
            <button onClick={() => nav.cook(recipe.id)}>👩‍🍳 Start cooking</button>
            <button className="ghost" onClick={() => nav.editMeal({ recipeId: recipe.id, status: 'planned' })}>
              🗓 Plan
            </button>
            <button className="ghost" onClick={() => nav.editMeal({ recipeId: recipe.id, status: 'eaten', date: todayISO() })}>
              ✓ Log eaten
            </button>
            <button className="ghost" onClick={shop} disabled={!recipe.ingredients.length}>
              🛒 Add to list
            </button>
          </div>

          {recipe.ingredients.length > 0 && (
            <>
              <div className="section-head">
                <h3>Ingredients</h3>
                <div className="scaler">
                  <button className="icon-btn small" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings">
                    −
                  </button>
                  <span>
                    {servings} {base ? 'servings' : '×'}
                  </span>
                  <button className="icon-btn small" onClick={() => setServings(servings + 1)} aria-label="More servings">
                    +
                  </button>
                  {servings !== (base || 1) && (
                    <button className="ghost small" onClick={() => setServings(base || 1)}>
                      reset
                    </button>
                  )}
                </div>
              </div>
              <ul className="ingredients">
                {scaled.map((line, idx) => (
                  <li key={idx} className={data.pantry.length && inPantry(line) ? 'have' : ''}>
                    {line}
                    {data.pantry.length > 0 && inPantry(line) && <span className="have-badge">in pantry</span>}
                  </li>
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

          <h3>Cooking journal</h3>
          <p className="muted small">Tweaks and lessons for next time — “less chili”, “double the garlic”…</p>
          <div className="inline-form">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about today's cook"
              onKeyDown={(e) => e.key === 'Enter' && addJournal()}
            />
            <button onClick={addJournal} disabled={!note.trim()}>
              Add
            </button>
          </div>
          {recipe.journal.length > 0 && (
            <ul className="journal">
              {recipe.journal.map((j) => (
                <li key={j.id}>
                  <span className="muted small">{formatDate(j.date)}</span>
                  <span>{j.text}</span>
                  <button
                    className="icon-btn small"
                    aria-label="Delete note"
                    onClick={() =>
                      store.upsert('recipes', { ...recipe, journal: recipe.journal.filter((x) => x.id !== j.id) })
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="actions">
            <button className="ghost danger" onClick={remove}>
              Delete
            </button>
            <button className="ghost" onClick={onEdit}>
              Edit
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
