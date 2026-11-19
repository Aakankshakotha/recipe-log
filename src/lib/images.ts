import { useEffect, useState } from 'react'

// Photos live in IndexedDB: localStorage is capped at ~5MB, which a handful of photos would fill.
const DB_NAME = 'recipe-log-images'
const STORE = 'images'

let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(d.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

const urlCache = new Map<string, string>()

export async function saveImage(blob: Blob, id: string = crypto.randomUUID()): Promise<string> {
  await tx('readwrite', (s) => s.put(blob, id))
  return id
}

export async function deleteImage(id: string) {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
  await tx('readwrite', (s) => s.delete(id))
}

export const getImage = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))

export async function getImageURL(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached
  const blob = await getImage(id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export function useImageURL(id: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    getImageURL(id).then((url) => !cancelled && setLoaded({ id, url }))
    return () => {
      cancelled = true
    }
  }, [id])
  return id && loaded?.id === id ? loaded.url : null
}

/** Shrinks a photo to fit within `max` px and re-encodes as JPEG — phone photos are often 4MB+. */
export async function resizeImage(file: Blob, max = 1200, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  )
}

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export const dataURLToBlob = (dataUrl: string) => fetch(dataUrl).then((r) => r.blob())
