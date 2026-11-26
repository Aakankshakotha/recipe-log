import { Download, HardDrive, Palette, Sparkles, Upload, Users } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import type { Member, Theme } from '../types'
import { exportBackup, newId, readBackup, useStore } from '../store'
import { useNav } from '../nav'
import { ListInput, Segmented } from './ui'

export function SettingsView() {
  return (
    <section className="settings">
      <Appearance />
      <Family />
      <AiSettings />
      <Backup />
    </section>
  )
}

function Appearance() {
  const store = useStore()
  return (
    <div className="card">
      <h3 className="settings-title">
        <Palette size={18} aria-hidden /> You & appearance
      </h3>
      <label className="field-row">
        <span>Your name</span>
        <input
          value={store.data.settings.name}
          onChange={(e) => store.updateSettings({ name: e.target.value })}
          placeholder="Shown in the greeting on Home"
        />
      </label>
      <Segmented<Theme>
        value={store.data.settings.theme}
        onChange={(theme) => store.updateSettings({ theme })}
        options={[
          { value: 'system', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
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
      <h3 className="settings-title">
        <Users size={18} aria-hidden /> Family
      </h3>
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

function AiSettings() {
  const store = useStore()
  const key = store.data.settings.anthropicApiKey
  const [draft, setDraft] = useState(key)
  const [show, setShow] = useState(false)

  return (
    <div className="card">
      <h3 className="settings-title">
        <Sparkles size={18} aria-hidden /> AI recipe import
      </h3>
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
      <h3 className="settings-title">
        <HardDrive size={18} aria-hidden /> Backup
      </h3>
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
          <Download size={15} aria-hidden /> Download backup
        </button>
        <button className="ghost" disabled={busy} onClick={() => input.current?.click()}>
          <Upload size={15} aria-hidden /> Restore from file
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
