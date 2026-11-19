import { useRef, useState } from 'react'
import type { Recipe } from '../types'
import { useStore } from '../store'
import { useNav } from '../nav'
import { resizeImage, saveImage } from '../lib/images'
import { Modal, Segmented } from './ui'

interface Props {
  onClose: () => void
  /** Called with a pre-filled draft; the user reviews it in the recipe form before saving. */
  onImported: (draft: Partial<Recipe>) => void
}

export function ImportRecipe({ onClose, onImported }: Props) {
  const { data } = useStore()
  const nav = useNav()
  const apiKey = data.settings.anthropicApiKey
  const [mode, setMode] = useState<'photo' | 'text'>('photo')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [keepPhoto, setKeepPhoto] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const choose = (f: File | undefined) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  const run = async () => {
    setBusy(true)
    setError('')
    // Loaded on demand: the AI SDK is most of the bundle and only needed here
    const { AiError, extractRecipe } = await import('../lib/ai')
    try {
      const r = await extractRecipe(apiKey, mode === 'photo' ? { image: file! } : { text })
      const photoId = mode === 'photo' && file && keepPhoto ? await saveImage(await resizeImage(file)) : null
      onImported({ ...r, photoId })
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!apiKey) {
    return (
      <Modal title="Import a recipe" onClose={onClose}>
        <p>
          Importing uses Claude AI to read a photo or pasted text and fill in the recipe for you. It needs your own
          Anthropic API key (about a cent per import).
        </p>
        <div className="actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            onClick={() => {
              onClose()
              nav.go('settings')
            }}
          >
            Add API key in Settings
          </button>
        </div>
      </Modal>
    )
  }

  const ready = mode === 'photo' ? !!file : text.trim().length > 20

  return (
    <Modal title="Import a recipe" onClose={onClose}>
      <div className="form">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError('')
          }}
          options={[
            { value: 'photo', label: '📷 From a photo' },
            { value: 'text', label: '📋 From text' },
          ]}
        />
        {mode === 'photo' ? (
          <>
            <p className="muted small">A cookbook page, a handwritten card, or a screenshot of a recipe.</p>
            <button type="button" className="dropzone" onClick={() => input.current?.click()}>
              {preview ? <img src={preview} alt="Selected" /> : <span>Tap to take or choose a photo</span>}
            </button>
            <input
              ref={input}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                choose(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {file && (
              <label className="check">
                <input type="checkbox" checked={keepPhoto} onChange={(e) => setKeepPhoto(e.target.checked)} />
                Also use this as the recipe photo
              </label>
            )}
          </>
        ) : (
          <>
            <p className="muted small">Paste a recipe from a website, WhatsApp message, email…</p>
            <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the recipe here" />
          </>
        )}
        {error && <p className="warning">{error}</p>}
        <div className="actions">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={run} disabled={!ready || busy}>
            {busy ? 'Reading recipe…' : '✨ Import'}
          </button>
        </div>
        <p className="muted small">You'll be able to check and edit everything before saving.</p>
      </div>
    </Modal>
  )
}
