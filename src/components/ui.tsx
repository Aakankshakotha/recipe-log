import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Camera, X } from 'lucide-react'
import { deleteImage, resizeImage, saveImage, useImageURL } from '../lib/images'
import { foodIcon, foodTint } from '../lib/food'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

export function Photo({ id, alt, className }: { id: string | null | undefined; alt: string; className?: string }) {
  const url = useImageURL(id)
  if (!url) return null
  return <img src={url} alt={alt} className={className} loading="lazy" />
}

/** A dish's photo, or a tinted emoji tile guessed from its name when there's no photo. */
export function DishImage({
  photoId,
  name,
  category,
  className,
}: {
  photoId: string | null | undefined
  name: string
  category?: string
  className?: string
}) {
  const url = useImageURL(photoId)
  if (url) return <img src={url} alt="" className={`dish-img ${className ?? ''}`} loading="lazy" />
  const tint = foodTint(name)
  return (
    <div
      className={`dish-img dish-icon ${className ?? ''}`}
      style={{ '--tint': tint.bg, '--ink': tint.ink } as CSSProperties}
      aria-hidden
    >
      {createElement(foodIcon(name, category), { strokeWidth: 1.6 })}
    </div>
  )
}

/** Shows the current photo with change/remove buttons. Calls onChange with the new image id. */
export function PhotoPicker({
  photoId,
  onChange,
  label = 'Add photo',
}: {
  photoId: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const id = await saveImage(await resizeImage(file))
      onChange(id)
    } catch {
      alert('Could not read that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="photo-picker">
      {photoId && <Photo id={photoId} alt="" className="photo-preview" />}
      <div className="photo-picker-actions">
        <button type="button" className="ghost small" onClick={() => input.current?.click()} disabled={busy}>
          {!busy && !photoId && <Camera size={15} aria-hidden />}
          {busy ? 'Saving…' : photoId ? 'Change photo' : label}
        </button>
        {photoId && (
          <button
            type="button"
            className="ghost small danger"
            onClick={() => {
              deleteImage(photoId)
              onChange(null)
            }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function Stars({
  value,
  onChange,
  size = 'md',
}: {
  value: number | null
  onChange?: (v: number | null) => void
  size?: 'sm' | 'md'
}) {
  if (!onChange) {
    return value ? <span className={`stars-static ${size}`}>{'★'.repeat(value)}</span> : null
  }
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star ${value != null && n <= value ? 'on' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          {value != null && n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}

/** Comma-separated list input that edits a string[]. */
export function ListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [text, setText] = useState(value.join(', '))
  return (
    <input
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        )
      }}
    />
  )
}
