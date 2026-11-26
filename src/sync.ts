import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { AppData } from './types'
import { normalize } from './store'
import { getImage, saveImage } from './lib/images'
import { applyRemote, diff, mergeSnapshot, photoIds, stable, type RemoteRow, type Snapshot } from './lib/syncCore'
import { getClient, syncAvailable } from './lib/syncClient'

export type SyncStatus = 'unavailable' | 'signed-out' | 'syncing' | 'synced' | 'error'

export interface SyncState {
  status: SyncStatus
  email: string | null
  lastSynced: Date | null
  error: string | null
}

export interface Sync {
  state: SyncState
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  syncNow: () => void
}

export const SyncContext = createContext<Sync | null>(null)

export function useSyncState(): Sync {
  const sync = useContext(SyncContext)
  if (!sync) throw new Error('useSyncState must be used inside SyncContext')
  return sync
}

// What this device already sent to / received from the server, so only changes travel.
const KEY = 'recipe-log:sync'
interface Saved {
  owner: string | null
  cursor: string | null // newest server timestamp we have seen
  snapshot: Snapshot
  uploaded: string[] // photo ids already in the cloud
}
const EMPTY: Saved = { owner: null, cursor: null, snapshot: {}, uploaded: [] }

function loadSaved(): Saved {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return EMPTY
  }
}

const PUSH_DELAY = 800
const POLL_MS = 30_000
const CHUNK = 200

/** Keeps recipes, cooks, family members and photos in step with the shared Supabase project. */
export function useSync(data: AppData, applyRemoteData: (update: (d: AppData) => AppData) => void): Sync {
  const [state, setState] = useState<SyncState>({
    status: syncAvailable ? 'signed-out' : 'unavailable',
    email: null,
    lastSynced: null,
    error: null,
  })
  const dataRef = useRef(data)
  dataRef.current = data
  const saved = useRef<Saved>(loadSaved())
  const owner = useRef<string | null>(null) // set while signed in
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const pushTimer = useRef<number>(undefined)

  const persist = () => localStorage.setItem(KEY, JSON.stringify(saved.current))

  async function uploadPhotos(ownerId: string) {
    const client = await getClient()
    for (const id of photoIds(dataRef.current)) {
      if (saved.current.uploaded.includes(id)) continue
      const blob = await getImage(id)
      if (!blob) continue
      const { error } = await client.storage.from('photos').upload(`${ownerId}/${id}`, blob, { upsert: true, contentType: blob.type })
      if (error) throw error
      saved.current.uploaded.push(id)
      persist()
    }
  }

  async function downloadPhotos(ownerId: string) {
    const client = await getClient()
    for (const id of photoIds(dataRef.current)) {
      if (await getImage(id)) continue
      const { data: blob, error } = await client.storage.from('photos').download(`${ownerId}/${id}`)
      if (error || !blob) continue // not uploaded yet from the other device
      await saveImage(blob, id)
      if (!saved.current.uploaded.includes(id)) saved.current.uploaded.push(id)
    }
    persist()
  }

  async function push(ownerId: string) {
    const client = await getClient()
    const rows = diff(saved.current.snapshot, dataRef.current)
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK)
      const { error } = await client
        .from('records')
        .upsert(chunk.map((r) => ({ ...r, owner_id: ownerId })), { onConflict: 'owner_id,collection,id' })
      if (error) throw error
      saved.current.snapshot = mergeSnapshot(
        saved.current.snapshot,
        Object.fromEntries(chunk.map((r) => [`${r.collection}:${r.id}`, r.deleted ? null : stable(r.data)])),
      )
      persist()
    }
    await uploadPhotos(ownerId)
  }

  async function pull(ownerId: string) {
    const client = await getClient()
    for (;;) {
      let query = client.from('records').select('collection,id,data,deleted,updated_at').order('updated_at').limit(1000)
      if (saved.current.cursor) query = query.gt('updated_at', saved.current.cursor)
      const { data: rows, error } = await query
      if (error) throw error
      if (!rows?.length) break
      const { snapshot } = applyRemote(dataRef.current, rows as RemoteRow[])
      saved.current.snapshot = mergeSnapshot(saved.current.snapshot, snapshot)
      saved.current.cursor = rows[rows.length - 1].updated_at as string
      persist()
      applyRemoteData((d) => normalize(applyRemote(d, rows as RemoteRow[]).data))
      if (rows.length < 1000) break
    }
    await downloadPhotos(ownerId)
  }

  /** Runs sync steps one at a time and reports progress. */
  const run = useCallback((task: (ownerId: string) => Promise<void>) => {
    const next = queue.current.then(async () => {
      const ownerId = owner.current
      if (!ownerId || !navigator.onLine) return
      setState((s) => ({ ...s, status: 'syncing', error: null }))
      try {
        await task(ownerId)
        setState((s) => ({ ...s, status: 'synced', lastSynced: new Date(), error: null }))
      } catch (e) {
        const message = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Sync failed'
        setState((s) => ({ ...s, status: 'error', error: message }))
      }
    })
    queue.current = next
    return next
  }, [])
  // The functions above only read refs, so a stable wrapper is safe
  const fullSync = useRef<() => Promise<void>>(async () => {})
  fullSync.current = () =>
    run(async (ownerId) => {
      // First time on this device: take what is already there before sending ours
      if (!saved.current.cursor) await pull(ownerId)
      await push(ownerId)
      await pull(ownerId)
    })

  const begin = useCallback(
    (ownerId: string, email: string) => {
      if (saved.current.owner !== ownerId) saved.current = { ...EMPTY, owner: ownerId }
      owner.current = ownerId
      setState((s) => ({ ...s, email, status: 'syncing' }))
      void fullSync.current()
    },
    [],
  )

  // Restore an existing session when the app opens
  useEffect(() => {
    if (!syncAvailable) return
    let cancelled = false
    void getClient().then(async (client) => {
      const { data: s } = await client.auth.getSession()
      if (!cancelled && s.session) begin(s.session.user.id, s.session.user.email ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [begin])

  // Send changes shortly after they happen
  useEffect(() => {
    if (!owner.current) return
    window.clearTimeout(pushTimer.current)
    pushTimer.current = window.setTimeout(() => void run((id) => push(id)), PUSH_DELAY)
    return () => window.clearTimeout(pushTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, run])

  // Pick up the other person's changes when you come back to the app, and every so often
  useEffect(() => {
    if (!syncAvailable) return
    const check = () => document.visibilityState === 'visible' && owner.current && void run((id) => pull(id))
    document.addEventListener('visibilitychange', check)
    window.addEventListener('online', check)
    const timer = window.setInterval(check, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('online', check)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = await getClient()
      const { data: s, error } = await client.auth.signInWithPassword({ email, password })
      if (error || !s.user) return error?.message ?? 'Could not sign in'
      begin(s.user.id, s.user.email ?? email)
      return null
    },
    [begin],
  )

  const signOut = useCallback(async () => {
    const client = await getClient()
    await client.auth.signOut()
    owner.current = null
    setState({ status: 'signed-out', email: null, lastSynced: null, error: null })
  }, [])

  const syncNow = useCallback(() => void fullSync.current(), [])

  return { state, signIn, signOut, syncNow }
}
