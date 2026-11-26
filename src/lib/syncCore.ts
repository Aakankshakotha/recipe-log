import type { AppData } from '../types'

/** The parts of the app that sync. Settings stay on each device (they include the API key). */
export const SYNCED = ['recipes', 'meals', 'members'] as const
export type SyncedCollection = (typeof SYNCED)[number]

/** One synced item as it is stored on the server. */
export interface RemoteRow {
  collection: string
  id: string
  data: Record<string, unknown> | null
  deleted: boolean
}

/** collection + id → the item as text, for spotting what changed since the last sync. */
export type Snapshot = Record<string, string>

/** JSON with sorted keys, because the database does not keep key order and we compare as text. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const keyOf = (collection: string, id: string) => `${collection}:${id}`

export function toSnapshot(data: AppData): Snapshot {
  const snap: Snapshot = {}
  for (const c of SYNCED) for (const item of data[c] as { id: string }[]) snap[keyOf(c, item.id)] = stable(item)
  return snap
}

/** What to send to the server so it matches `data`, given what was last in sync. */
export function diff(prev: Snapshot, data: AppData): RemoteRow[] {
  const rows: RemoteRow[] = []
  const now = toSnapshot(data)
  for (const c of SYNCED) {
    for (const item of data[c] as { id: string }[]) {
      if (prev[keyOf(c, item.id)] !== now[keyOf(c, item.id)]) {
        rows.push({ collection: c, id: item.id, data: item as unknown as Record<string, unknown>, deleted: false })
      }
    }
  }
  for (const key of Object.keys(prev)) {
    if (key in now) continue
    const [collection, ...rest] = key.split(':')
    rows.push({ collection, id: rest.join(':'), data: null, deleted: true })
  }
  return rows
}

/** Snapshot changes after applying server rows: the new text, or null where the item is gone. */
export type SnapshotUpdate = Record<string, string | null>

export function mergeSnapshot(prev: Snapshot, update: SnapshotUpdate): Snapshot {
  const next = { ...prev }
  for (const [key, value] of Object.entries(update)) {
    if (value === null) delete next[key]
    else next[key] = value
  }
  return next
}

/** Applies rows from the server to local data. Returns the new data and what the snapshot should now say. */
export function applyRemote(data: AppData, rows: RemoteRow[]): { data: AppData; snapshot: SnapshotUpdate } {
  const next = { ...data } as Record<SyncedCollection, { id: string }[]> & AppData
  const snapshot: SnapshotUpdate = {}
  for (const row of rows) {
    if (!(SYNCED as readonly string[]).includes(row.collection)) continue
    const c = row.collection as SyncedCollection
    const list = (next[c] as { id: string }[]).filter((x) => x.id !== row.id)
    if (row.deleted || !row.data) {
      next[c] = list as never
      snapshot[keyOf(c, row.id)] = null
    } else {
      next[c] = [...list, row.data as { id: string }] as never
      snapshot[keyOf(c, row.id)] = stable(row.data)
    }
  }
  return { data: next, snapshot }
}

/** Photo ids that recipes and cooks point to. */
export function photoIds(data: AppData): string[] {
  return [...new Set([...data.recipes, ...data.meals].map((x) => x.photoId).filter((x): x is string => !!x))]
}
