import { useRef, useState, type FormEvent } from 'react'
import { MEAL_TYPES, type MealType, type Member, type Theme } from '../types'
import { exportBackup, newId, readBackup, useStore } from '../store'
import { useNav } from '../nav'
import { WEEKDAYS, capitalize } from '../lib/dates'
import { ListInput, Segmented } from './ui'

export function SettingsView() {
  return (
    <section className="settings">
      <Family />
      <Recurring />
      <AiSettings />
      <Appearance />
      <Backup />
    </section>
  )
}

function Appearance() {
  const store = useStore()
  return (
    <div className="card">
      <h3>Appearance</h3>
      <Segmented<Theme>
        value={store.data.settings.theme}
        onChange={(theme) => store.updateSettings({ theme })}
        options={[
          { value: 'system', label: 'Auto' },
          { value: 'light', label: '☀️ Light' },
          { value: 'dark', label: '🌙 Dark' },
        ]}
      />
    </div>
  )
}

function Family() {
  const store = useStore()
  const [name, setName] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    store.upsert('members', { id: newId(), name: name.trim(), avoid: [] })
    setName('')
  }

  return (
    <div className="card">
      <h3>👨‍👩‍👧 Family</h3>
      <p className="muted small">
        Add who you cook for and what each person can't or won't eat. You'll get a warning on recipes and meals
        that contain those foods. Group words work too: <em>nuts, dairy, gluten, egg, shellfish, meat, non-veg,
        onion garlic</em>.
      </p>
      <ul className="list">
        {store.data.members.map((m) => (
          <MemberRow key={m.id} member={m} />
        ))}
      </ul>
      <form className="inline-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <button type="submit" disabled={!name.trim()}>
          Add person
        </button>
      </form>
    </div>
  )
}

function MemberRow({ member }: { member: Member }) {
  const store = useStore()
  return (
    <li className="member-row">
      <span className="avatar">{member.name.charAt(0).toUpperCase()}</span>
      <input
        className="member-name"
        value={member.name}
        onChange={(e) => store.upsert('members', { ...member, name: e.target.value })}
        aria-label="Name"
      />
      <ListInput
        value={member.avoid}
        onChange={(avoid) => store.upsert('members', { ...member, avoid })}
        placeholder="Avoids… e.g. peanuts, dairy"
      />
      <button
        className="icon-btn small"
        aria-label={`Remove ${member.name}`}
        onClick={() => confirm(`Remove ${member.name}?`) && store.remove('members', member.id)}
      >
        ✕
      </button>
    </li>
  )
}

function Recurring() {
  const store = useStore()
  const { data } = store
  const [weekday, setWeekday] = useState(4)
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [recipeId, setRecipeId] = useState('')
  const [description, setDescription] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!recipeId && !description.trim()) return
    store.upsert('recurring', {
      id: newId(),
      weekday,
      mealType,
      recipeId: recipeId || null,
      description: recipeId ? '' : description.trim(),
    })
    setRecipeId('')
    setDescription('')
  }

  const sorted = [...data.recurring].sort(
    (a, b) => a.weekday - b.weekday || MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType),
  )

  return (
    <div className="card">
      <h3>↻ Recurring meals</h3>
      <p className="muted small">
        Regular things like “Friday = pizza night”. They appear as suggestions on the Week tab — one tap adds them.
      </p>
      {sorted.length > 0 && (
        <ul className="list compact">
          {sorted.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{WEEKDAYS[r.weekday]}</strong> {r.mealType}:{' '}
                {r.recipeId ? data.recipes.find((x) => x.id === r.recipeId)?.name : r.description}
              </span>
              <button className="icon-btn small" onClick={() => store.remove('recurring', r.id)} aria-label="Remove">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="inline-form wrap" onSubmit={add}>
        <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              Every {d}
            </option>
          ))}
        </select>
        <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {capitalize(t)}
            </option>
          ))}
        </select>
        <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
          <option value="">Other (type below)…</option>
          {[...data.recipes]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        {!recipeId && (
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Pizza night" />
        )}
        <button type="submit" disabled={!recipeId && !description.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}

function AiSettings() {
  const store = useStore()
  const key = store.data.settings.anthropicApiKey
  const [draft, setDraft] = useState(key)
  const [show, setShow] = useState(false)

  return (
    <div className="card">
      <h3>✨ AI recipe import</h3>
      <p className="muted small">
        Turn a photo of a cookbook page, a handwritten card or pasted text into a recipe. Uses Claude with your own
        Anthropic API key (get one at{' '}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>
        ; each import costs about a cent). The key is stored only in this browser and is never included in backups.
      </p>
      <div className="inline-form">
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
        <button type="button" className="ghost small" onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button
          type="button"
          disabled={draft.trim() === key}
          onClick={() => store.updateSettings({ anthropicApiKey: draft.trim() })}
        >
          Save
        </button>
      </div>
      {key && <p className="small good-text">✓ Key saved</p>}
    </div>
  )
}

function Backup() {
  const store = useStore()
  const nav = useNav()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const { recipes, meals } = store.data

  const restore = async (file: File | undefined) => {
    if (!file) return
    if (!confirm('Replace everything in the app with this backup?')) return
    setBusy(true)
    try {
      const next = await readBackup(file)
      store.replaceAll({ ...next, settings: { ...next.settings, anthropicApiKey: store.data.settings.anthropicApiKey } })
      nav.toast('Backup restored')
    } catch {
      alert('That file doesn’t look like a Recipe Log backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>💾 Backup</h3>
      <p className="muted small">
        Everything is saved in this browser only ({recipes.length} recipes, {meals.length} meals). Download a backup
        now and then — it includes photos — and use it to restore or move to another device.
      </p>
      <div className="row-actions">
        <button
          className="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await exportBackup(store.data)
            setBusy(false)
          }}
        >
          ⬇ Download backup
        </button>
        <button className="ghost" disabled={busy} onClick={() => input.current?.click()}>
          ⬆ Restore from file
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            restore(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
