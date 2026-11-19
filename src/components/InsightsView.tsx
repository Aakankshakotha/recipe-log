import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useNav } from '../nav'
import { addDaysISO, daysAgoISO, formatDate, todayISO, weekStartISO } from '../lib/dates'
import { computeRecipeStats } from '../lib/derived'
import { Empty } from './ui'

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'All time', days: 0 },
]

export function InsightsView() {
  const { data } = useStore()
  const nav = useNav()
  const [rangeDays, setRangeDays] = useState(30)
  const today = todayISO()

  const eaten = useMemo(() => data.meals.filter((m) => m.status === 'eaten'), [data.meals])

  const stats = useMemo(() => {
    const from = rangeDays ? daysAgoISO(rangeDays - 1) : ''
    const meals = eaten.filter((m) => m.date >= from && m.date <= today)
    const recipeStats = computeRecipeStats(meals)
    const fromRecipes = meals.filter((m) => m.recipeId && !m.leftoverId).length
    const leftovers = meals.filter((m) => m.leftoverId).length
    const rated = meals.filter((m) => m.rating != null)
    const avgRating = rated.length ? rated.reduce((s, m) => s + m.rating!, 0) / rated.length : null

    const top = [...recipeStats.entries()]
      .sort((a, b) => b[1].timesCooked - a[1].timesCooked)
      .slice(0, 8)
      .map(([id, s]) => ({ recipe: data.recipes.find((r) => r.id === id), count: s.timesCooked }))
      .filter((x) => x.recipe)

    const bestRated = [...recipeStats.entries()]
      .filter(([, s]) => s.avgRating != null)
      .sort((a, b) => b[1].avgRating! - a[1].avgRating! || b[1].timesCooked - a[1].timesCooked)
      .slice(0, 5)
      .map(([id, s]) => ({ recipe: data.recipes.find((r) => r.id === id), rating: s.avgRating! }))
      .filter((x) => x.recipe)

    const byCategory = new Map<string, number>()
    for (const m of meals) {
      const cat = data.recipes.find((r) => r.id === m.recipeId)?.category || (m.recipeId ? 'Uncategorized' : 'Eating out / other')
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1)
    }

    return {
      total: meals.length,
      fromRecipes,
      leftovers,
      avgRating,
      top,
      bestRated,
      categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      newTried: data.recipes.filter((r) => {
        const s = recipeStats.get(r.id)
        return s && computeFirst(eaten, r.id) >= from
      }).length,
    }
  }, [eaten, data.recipes, rangeDays, today])

  // Every recipe, oldest "last cooked" first
  const forgotten = useMemo(() => {
    const all = computeRecipeStats(eaten)
    return data.recipes
      .map((r) => ({ recipe: r, last: all.get(r.id)?.lastCooked ?? null }))
      .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''))
      .slice(0, 6)
  }, [eaten, data.recipes])

  // Consecutive days with at least one meal logged, ending today (or yesterday)
  const streak = useMemo(() => {
    const days = new Set(eaten.map((m) => m.date))
    let d = days.has(today) ? today : addDaysISO(today, -1)
    let n = 0
    while (days.has(d)) {
      n++
      d = addDaysISO(d, -1)
    }
    return n
  }, [eaten, today])

  const heat = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of eaten) counts.set(m.date, (counts.get(m.date) ?? 0) + 1)
    const start = addDaysISO(weekStartISO(today), -7 * 11)
    return Array.from({ length: 12 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const date = addDaysISO(start, w * 7 + d)
        return { date, count: date > today ? -1 : (counts.get(date) ?? 0) }
      }),
    )
  }, [eaten, today])

  if (eaten.length === 0) {
    return (
      <Empty icon="📊" title="No meals logged yet">
        <p className="muted">Log what you eat for a few days and your stats will show up here.</p>
        <button onClick={() => nav.go('today')}>Log a meal</button>
      </Empty>
    )
  }

  const maxCount = stats.top[0]?.count ?? 1
  const maxCat = stats.categories[0]?.[1] ?? 1
  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0)

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
        <Tile value={stats.total} label="meals logged" />
        <Tile value={`${pct(stats.fromRecipes)}%`} label="home-cooked from your recipes" />
        <Tile value={stats.avgRating != null ? `★ ${stats.avgRating.toFixed(1)}` : '—'} label="average rating" />
        <Tile value={`🔥 ${streak}`} label={`day logging streak`} />
        <Tile value={stats.leftovers} label="meals from leftovers" />
        <Tile value={stats.newTried} label="new recipes tried" />
      </div>

      <div className="card">
        <h3>Last 12 weeks</h3>
        <div className="heatmap" role="img" aria-label="Meals logged per day over the last 12 weeks">
          <div className="heat-labels">
            {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          {heat.map((week, i) => (
            <div key={i} className="heat-col">
              {week.map((d) => (
                <span
                  key={d.date}
                  className={`heat-cell l${Math.min(3, Math.max(0, d.count))} ${d.count < 0 ? 'future' : ''}`}
                  title={d.count >= 0 ? `${formatDate(d.date)}: ${d.count} meal${d.count === 1 ? '' : 's'}` : ''}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Most cooked</h3>
          {stats.top.length === 0 ? (
            <p className="muted small">Log meals from your recipes to see favorites here.</p>
          ) : (
            <ul className="bars">
              {stats.top.map(({ recipe, count }) => (
                <li key={recipe!.id}>
                  <button className="link bar-label" onClick={() => nav.openRecipe(recipe!.id)}>
                    {recipe!.name}
                  </button>
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
          <h3>What you eat</h3>
          <ul className="bars">
            {stats.categories.map(([cat, n]) => (
              <li key={cat}>
                <span className="bar-label">{cat}</span>
                <span className="bar-track">
                  <span className="bar alt" style={{ width: `${(n / maxCat) * 100}%` }} />
                </span>
                <span className="bar-value">{pct(n)}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Family favorites</h3>
          {stats.bestRated.length === 0 ? (
            <p className="muted small">Rate meals when you log them to see your best dishes.</p>
          ) : (
            <ul className="list compact">
              {stats.bestRated.map(({ recipe, rating }) => (
                <li key={recipe!.id}>
                  <button className="link" onClick={() => nav.openRecipe(recipe!.id)}>
                    {recipe!.name}
                  </button>
                  <span className="stars-static sm">★ {rating.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>Haven't made in a while</h3>
          <ul className="list compact">
            {forgotten.map(({ recipe, last }) => (
              <li key={recipe.id}>
                <button className="link" onClick={() => nav.openRecipe(recipe.id)}>
                  {recipe.name}
                </button>
                <span className="muted small">{last ? formatDate(last) : 'never'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function computeFirst(meals: { recipeId: string | null; date: string; leftoverId: string | null }[], id: string) {
  let first = '9999'
  for (const m of meals) if (m.recipeId === id && !m.leftoverId && m.date < first) first = m.date
  return first
}

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card tile">
      <span className="tile-value">{value}</span>
      <span className="muted small">{label}</span>
    </div>
  )
}
