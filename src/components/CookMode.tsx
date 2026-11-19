import { useEffect, useRef, useState } from 'react'
import type { Recipe } from '../types'
import { todayISO } from '../lib/dates'
import { findDurations } from '../lib/ingredients'
import { useNav } from '../nav'

interface Timer {
  id: number
  label: string
  endsAt: number
  total: number
}

function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () =>
      navigator.wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    request()
    // The lock is released when the tab is hidden; take it again when we come back
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release()
    }
  }, [])
}

function beep() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.frequency.value = 880
      osc.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.4)
      osc.stop(ctx.currentTime + i * 0.4 + 0.2)
    }
  } catch {
    /* audio not available */
  }
  navigator.vibrate?.([300, 150, 300])
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  useWakeLock()
  const nav = useNav()
  const [step, setStep] = useState(-1) // -1 = ingredients overview
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [timers, setTimers] = useState<Timer[]>([])
  const [now, setNow] = useState(() => Date.now())
  const rang = useRef(new Set<number>())
  const [speak, setSpeak] = useState(false)

  const total = recipe.steps.length
  const current = step >= 0 ? recipe.steps[step] : null

  useEffect(() => {
    if (!timers.length) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [timers.length])

  useEffect(() => {
    for (const t of timers) {
      if (t.endsAt <= now && !rang.current.has(t.id)) {
        rang.current.add(t.id)
        beep()
      }
    }
  }, [now, timers])

  useEffect(() => {
    if (!speak || !current || !('speechSynthesis' in window)) return
    speechSynthesis.cancel()
    speechSynthesis.speak(new SpeechSynthesisUtterance(`Step ${step + 1}. ${current}`))
  }, [speak, current, step])

  useEffect(() => () => speechSynthesis?.cancel(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setStep((s) => Math.min(total - 1, s + 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(-1, s - 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total, onClose])

  const startTimer = (label: string, seconds: number) => {
    const start = Date.now()
    setNow(start)
    setTimers((ts) => [...ts, { id: start, label, endsAt: start + seconds * 1000, total: seconds }])
  }

  const finish = () => {
    onClose()
    nav.editMeal({ recipeId: recipe.id, status: 'eaten', date: todayISO() })
  }

  return (
    <div className="cook">
      <header className="cook-head">
        <button className="icon-btn" onClick={onClose} aria-label="Exit cook mode">
          ✕
        </button>
        <div className="cook-title">
          <strong>{recipe.name}</strong>
          <span className="muted small">
            {step < 0 ? 'Gather your ingredients' : `Step ${step + 1} of ${total}`}
          </span>
        </div>
        {'speechSynthesis' in window && (
          <button
            className={`icon-btn ${speak ? 'on' : ''}`}
            onClick={() => setSpeak(!speak)}
            title={speak ? 'Stop reading steps aloud' : 'Read steps aloud'}
          >
            {speak ? '🔊' : '🔈'}
          </button>
        )}
      </header>
      <div className="cook-progress">
        <div style={{ width: `${((step + 1) / Math.max(1, total)) * 100}%` }} />
      </div>

      <main className="cook-body">
        {step < 0 ? (
          <div className="cook-ingredients">
            <h2>Ingredients</h2>
            {recipe.ingredients.length === 0 && <p className="muted">No ingredients listed.</p>}
            <ul>
              {recipe.ingredients.map((line, i) => (
                <li key={i}>
                  <label className={checked.has(i) ? 'done' : ''}>
                    <input
                      type="checkbox"
                      checked={checked.has(i)}
                      onChange={() => {
                        const next = new Set(checked)
                        if (next.has(i)) next.delete(i)
                        else next.add(i)
                        setChecked(next)
                      }}
                    />
                    {line}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="cook-step">
            <div className="cook-step-num">{step + 1}</div>
            <p className="cook-step-text">{current}</p>
            <div className="chips center">
              {findDurations(current!).map((d, i) => (
                <button key={i} className="chip timer-chip" onClick={() => startTimer(`Step ${step + 1}: ${d.label}`, d.seconds)}>
                  ⏲ Start {d.label} timer
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {timers.length > 0 && (
        <div className="timers">
          {timers.map((t) => {
            const left = t.endsAt - now
            const done = left <= 0
            return (
              <div key={t.id} className={`timer ${done ? 'done' : ''}`}>
                <span className="small">{t.label}</span>
                <strong>{done ? 'Done!' : fmt(left)}</strong>
                <button
                  className="icon-btn small"
                  onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))}
                  aria-label="Dismiss timer"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}

      <footer className="cook-foot">
        <button className="ghost big" onClick={() => setStep(step - 1)} disabled={step < 0}>
          ‹ Back
        </button>
        {step < total - 1 ? (
          <button className="big" onClick={() => setStep(step + 1)}>
            {step < 0 ? 'Start cooking ›' : 'Next ›'}
          </button>
        ) : (
          <button className="big" onClick={finish}>
            ✓ Done — log it
          </button>
        )}
      </footer>
    </div>
  )
}
