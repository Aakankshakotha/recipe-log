import { useMemo, useState } from 'react'
import type { AppData } from '../types'
import { daysAgoISO, formatDate } from '../store'

interface Props {
  data: AppData
}

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 0 },
]

export function InsightsView({ data }: Props) {
  const [rangeDays, setRangeDays] = useState(30)

  const stats = useMemo(() => {
    const from = rangeDays ? daysAgoISO(rangeDays - 1) : ''
    const meals = data.meals.filter((m) => m.date >= from)

    const byRecipe = new Map<string, number>()
    let homeCooked = 0
    for (const m of meals) {
      if (!m.recipeId) continue
      homeCooked++
      byRecipe.set(m.recipeId, (byRecipe.get(m.recipeId) ?? 0) + 1)
    }
    const top = [...byRecipe.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ recipe: data.recipes.find((r) => r.id === id), count }))
      .filter((x) => x.recipe)

    const rated = meals.filter((m) => m.rating != null)
    const avgRating = rated.length
      ? rated.reduce((s, m) => s + (m.rating ?? 0), 0) / rated.length
      : null

    // Recipes you haven't made in a while (or ever) — good for "what should we cook?"
    const lastMade = new Map<string, string>()
    for (const m of data.meals) {
      if (m.recipeId && (lastMade.get(m.recipeId) ?? '') < m.date) lastMade.set(m.recipeId, m.date)
    }
    const forgotten = data.recipes
      .map((r) => ({ recipe: r, last: lastMade.get(r.id) }))
      .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))
      .slice(0, 6)

    return { total: meals.length, homeCooked, top, avgRating, forgotten }
  }, [data, rangeDays])

  const maxCount = stats.top[0]?.count ?? 1

  return (
    <section>
      <div className="toolbar">
        <select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))}>
          {RANGES.map((r) => (
            <option key={r.days} value={r.days}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="tiles">
        <div className="card tile">
          <span className="tile-value">{stats.total}</span>
          <span className="meta">meals logged</span>
        </div>
        <div className="card tile">
          <span className="tile-value">
            {stats.total ? Math.round((stats.homeCooked / stats.total) * 100) : 0}%
          </span>
          <span className="meta">from your recipes</span>
        </div>
        <div className="card tile">
          <span className="tile-value">
            {stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
          </span>
          <span className="meta">average rating</span>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Most cooked</h3>
          {stats.top.length === 0 ? (
            <p className="meta">Log meals from your recipes to see favorites here.</p>
          ) : (
            <ul className="bars">
              {stats.top.map(({ recipe, count }) => (
                <li key={recipe!.id}>
                  <span className="bar-label">{recipe!.name}</span>
                  <span className="bar-track">
                    <span className="bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </span>
                  <span className="bar-value">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>Haven't made in a while</h3>
          {stats.forgotten.length === 0 ? (
            <p className="meta">Add some recipes first.</p>
          ) : (
            <ul className="plain">
              {stats.forgotten.map(({ recipe, last }) => (
                <li key={recipe.id}>
                  <span>{recipe.name}</span>
                  <span className="meta">{last ? formatDate(last) : 'never'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
