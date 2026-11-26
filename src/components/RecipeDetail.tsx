import {
  Check,
  ChefHat,
  ChevronRight,
  Copy,
  Heart,
  Lightbulb,
  Pencil,
  Share2,
  Star,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import type { Recipe } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { formatDate } from '../lib/dates'
import { scaleIngredient } from '../lib/ingredients'
import { avoidWarnings, useRecipeStats } from '../lib/derived'
import { CookEditor, CookHistory } from './CookLog'
import { RATING_LABELS } from '../lib/rating'
import { DishImage } from './ui'

interface Props {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
  /** Open straight on the "How did it go?" card, e.g. right after finishing cook mode. */
  startLogging?: boolean
}

export function RecipeDetail({ recipe, onBack, onEdit, startLogging }: Props) {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const stats = useRecipeStats().get(recipe.id)
  const cooks = data.meals.filter((m) => m.recipeId === recipe.id).sort((a, b) => b.date.localeCompare(a.date))
  const base = recipe.servings ?? 0
  const [servings, setServings] = useState(base || 1)
  const [logging, setLogging] = useState(!!startLogging)
  const factor = base ? servings / base : servings

  const warnings = avoidWarnings([recipe.name, ...recipe.ingredients], data.members)
  const scaled = recipe.ingredients.map((l) => scaleIngredient(l, factor))

  const copyIngredients = async () => {
    try {
      await navigator.clipboard.writeText(scaled.join('\n'))
      nav.toast('Ingredients copied')
    } catch {
      nav.toast('Could not copy the ingredients')
    }
  }

  const share = async () => {
    const text = [
      recipe.name,
      '',
      'Ingredients',
      ...recipe.ingredients.map((i) => `- ${i}`),
      '',
      'Method',
      ...recipe.steps.map((st, i) => `${i + 1}. ${st}`),
    ].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: recipe.name, text })
      else {
        await navigator.clipboard.writeText(text)
        nav.toast('Recipe copied')
      }
    } catch {
      // The share sheet was dismissed
    }
  }

  const remove = () => {
    if (confirm(`Delete “${recipe.name}” and its ${cooks.length} logged cook${cooks.length === 1 ? '' : 's'}?`)) {
      store.deleteRecipe(recipe)
      onBack()
    }
  }

  const rating = stats?.avgRating ?? null
  const ratingLabel = rating == null ? '' : RATING_LABELS[Math.round(rating)]

  return (
    <article className="detail">
      <header className="detail-top">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button className="crumb" onClick={onBack}>
              Journal
            </button>
            {recipe.category && (
              <>
                <ChevronRight size={13} aria-hidden />
                <span>{recipe.category}</span>
              </>
            )}
          </nav>
          <h2>{recipe.name}</h2>
        </div>
        <div className="detail-actions">
          <button
            className={`ghost icon-only ${recipe.favorite ? 'on' : ''}`}
            onClick={() => store.upsert('recipes', { ...recipe, favorite: !recipe.favorite })}
            aria-label={recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={recipe.favorite}
          >
            <Heart size={17} fill={recipe.favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
          <button className="ghost" onClick={share}>
            <Share2 size={15} aria-hidden /> Share
          </button>
          <button onClick={onEdit}>
            <Pencil size={15} aria-hidden /> Edit
          </button>
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-main">
          <DishImage photoId={recipe.photoId} name={recipe.name} category={recipe.category} className="detail-photo" />

          {recipe.steps.length > 0 && (
            <section className="card method">
              <h3>Method</h3>
              <ol>
                {recipe.steps.map((step, idx) => (
                  <li key={idx}>
                    <span className="step-num">{idx + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card">
            <div className="section-head">
              <h3>Cook history</h3>
              <span className="muted small">
                {cooks.length ? `Cooked ${cooks.length} time${cooks.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>
            <CookHistory cooks={cooks} />
          </section>
        </div>

        <aside className="detail-side">
          <section className="card">
            <div className="stat-strip">
              <div>
                <strong>{recipe.prepMinutes != null ? `${recipe.prepMinutes}m` : '–'}</strong>
                <span>Total</span>
              </div>
              <div>
                <strong>{recipe.servings ?? '–'}</strong>
                <span>Serves</span>
              </div>
              <div>
                <strong>{stats?.lastCooked ? formatDate(stats.lastCooked) : '–'}</strong>
                <span>Cooked</span>
              </div>
            </div>
            <div className="rating-row">
              <span className="stars-row" aria-label={rating != null ? `Rated ${rating.toFixed(1)} out of 5` : 'Not rated yet'}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={15} fill={rating != null && n <= Math.round(rating) ? 'currentColor' : 'none'} aria-hidden />
                ))}
              </span>
              <span className="muted small">{rating != null ? ratingLabel : 'Not rated yet'}</span>
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
                <TriangleAlert size={16} aria-hidden /> {warnings.map((w) => `${w.member.name} avoids ${w.matched.join(', ')}`).join(' · ')}
              </p>
            )}
            <div className="primary-actions">
              <button onClick={() => nav.cook(recipe.id)}>
                <ChefHat size={17} aria-hidden /> Start cooking
              </button>
              <button className="ghost" onClick={() => setLogging(true)} disabled={logging}>
                <Check size={16} aria-hidden /> I cooked this
              </button>
            </div>
          </section>

          {logging && (
            <section className="card">
              <CookEditor
                onCancel={() => setLogging(false)}
                onSave={(cook) => {
                  store.logCooked(recipe.id, cook)
                  setLogging(false)
                  nav.toast('Added to your cook history')
                }}
              />
            </section>
          )}

          {recipe.ingredients.length > 0 && (
            <section className="card">
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
                  <li key={idx}>
                    <label>
                      <input type="checkbox" />
                      <span>{line}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button className="link-btn" onClick={copyIngredients}>
                <Copy size={14} aria-hidden /> Copy ingredients
              </button>
            </section>
          )}

          {recipe.notes && (
            <section className="notes-card">
              <h4>
                <Lightbulb size={13} aria-hidden /> Notes for next time
              </h4>
              <p className="notes">{recipe.notes}</p>
            </section>
          )}

          <button className="ghost danger small delete-btn" onClick={remove}>
            Delete recipe
          </button>
        </aside>
      </div>
    </article>
  )
}
