import { useState } from 'react'
import { useStore } from '../store'
import { useNav } from '../nav'
import { fromISODate, formatDate, todayISO } from '../lib/dates'
import type { DayBar, Tip, WeekInsights, WeekStat } from '../lib/insights'

// ---- "Your week": four stat tiles + meals-per-day chart ----

function Delta({ stat, unit = '' }: { stat: WeekStat; unit?: string }) {
  const diff = stat.value - stat.previous
  if (diff === 0) return <span className="delta flat">same as last week</span>
  if (stat.previous === 0) return <span className="delta up">new this week</span>
  // For every tile here, up is the good direction
  const up = diff > 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'up' : 'down'}</span> {Math.abs(diff)}
      {unit} vs last week
    </span>
  )
}

function StatTile({ label, value, stat, unit }: { label: string; value: string; stat: WeekStat; unit?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <Delta stat={stat} unit={unit} />
    </div>
  )
}

const dayLabel = (iso: string) => fromISODate(iso).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)

function describeDay(d: DayBar) {
  const parts = [
    d.fromRecipes && `${d.fromRecipes} from your recipes`,
    d.other && `${d.other} other`,
    d.planned && `${d.planned} planned`,
  ].filter(Boolean)
  return `${formatDate(d.date)}: ${parts.length ? parts.join(', ') : 'nothing logged'}`
}

function WeekChart({ days }: { days: DayBar[] }) {
  const today = todayISO()
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(3, ...days.map((d) => d.fromRecipes + d.other + d.planned))
  const pct = (n: number) => `${(n / max) * 100}%`
  const hovered = days.find((d) => d.date === hover)

  return (
    <figure className="week-chart">
      <div className="chart-legend" aria-hidden>
        <span>
          <i className="swatch s1" /> From your recipes
        </span>
        <span>
          <i className="swatch s2" /> Other meals
        </span>
        <span>
          <i className="swatch planned" /> Planned
        </span>
      </div>
      <div className="chart-plot" onMouseLeave={() => setHover(null)}>
        <span className="chart-max" aria-hidden>
          {max}
        </span>
        {days.map((d) => (
          <div
            key={d.date}
            className={`chart-col ${d.date === today ? 'today' : ''} ${hover === d.date ? 'hover' : ''}`}
            tabIndex={0}
            aria-label={describeDay(d)}
            onMouseEnter={() => setHover(d.date)}
            onFocus={() => setHover(d.date)}
            onBlur={() => setHover(null)}
          >
            <div className="chart-stack">
              {d.planned > 0 && <span className="seg planned" style={{ height: pct(d.planned) }} />}
              {d.other > 0 && <span className="seg s2" style={{ height: pct(d.other) }} />}
              {d.fromRecipes > 0 && <span className="seg s1" style={{ height: pct(d.fromRecipes) }} />}
            </div>
            <span className="chart-day">{dayLabel(d.date)}</span>
          </div>
        ))}
        {hovered && (
          <div className="chart-tip" role="status" style={{ left: `${((days.indexOf(hovered) + 0.5) / 7) * 100}%` }}>
            <strong>{formatDate(hovered.date)}</strong>
            <span>
              <i className="swatch s1" /> {hovered.fromRecipes} from your recipes
            </span>
            <span>
              <i className="swatch s2" /> {hovered.other} other
            </span>
            {hovered.planned > 0 && (
              <span>
                <i className="swatch planned" /> {hovered.planned} planned
              </span>
            )}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Meals per day this week</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>From your recipes</th>
            <th>Other</th>
            <th>Planned</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatDate(d.date)}</td>
              <td>{d.fromRecipes}</td>
              <td>{d.other}</td>
              <td>{d.planned}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function WeekPulse({ week }: { week: WeekInsights }) {
  const nav = useNav()
  return (
    <div className="card pulse">
      <div className="card-head">
        <h3>Your week so far</h3>
        <button className="link small" onClick={() => nav.go('insights')}>
          All insights ›
        </button>
      </div>
      <div className="stats">
        <StatTile label="Meals logged" value={String(week.meals.value)} stat={week.meals} />
        <StatTile label="From your recipes" value={`${week.recipeShare.value}%`} stat={week.recipeShare} unit=" pts" />
        <StatTile label="Different dishes" value={String(week.dishes.value)} stat={week.dishes} />
        <StatTile label="Leftovers eaten" value={String(week.leftovers.value)} stat={week.leftovers} />
      </div>
      <WeekChart days={week.days} />
    </div>
  )
}

// ---- "For you": tips ----

export function TipsCard({ tips }: { tips: Tip[] }) {
  const { data } = useStore()
  const nav = useNav()

  const run = (tip: Tip) => {
    const a = tip.action
    if (!a) return
    if (a.kind === 'recipe') nav.openRecipe(a.recipeId)
    else if (a.kind === 'tab') nav.go(a.tab)
    else if (a.kind === 'plan') nav.editMeal({ date: a.date, status: 'planned', mealType: 'dinner' })
    else if (a.kind === 'eatLeftover') nav.editMeal({ leftoverId: a.leftoverId, date: todayISO(), status: 'eaten' })
  }

  return (
    <div className="card tips">
      <div className="card-head">
        <h3>For you</h3>
      </div>
      {tips.length === 0 ? (
        <p className="muted small">
          {data.meals.length === 0
            ? 'Log a few meals and tips will show up here — what to use up, what to cook next, how your week is going.'
            : 'All caught up. Nothing needs your attention right now.'}
        </p>
      ) : (
        <ul className="tip-list">
          {tips.map((t) => (
            <li key={t.id} className={`tip ${t.tone}`}>
              <span className="tip-icon" aria-hidden>
                {t.icon}
              </span>
              <span className="tip-text">
                <strong>{t.title}</strong>
                {t.detail && <span className="muted small">{t.detail}</span>}
              </span>
              {t.action && (
                <button className="ghost small tip-action" onClick={() => run(t)}>
                  {t.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
