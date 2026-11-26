import { describe, expect, it } from 'vitest'
import { normalize } from '../store'
import { applyRemote, diff, mergeSnapshot, photoIds, stable, toSnapshot } from './syncCore'

const base = () =>
  normalize({
    recipes: [{ id: 'r1', name: 'Dal', photoId: 'p1' }],
    meals: [{ id: 'm1', recipeId: 'r1', date: '2026-11-01', photoId: 'p2' }],
  })

describe('stable', () => {
  it('ignores key order', () => {
    expect(stable({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(stable({ a: [{ c: 2, d: 1 }], b: 1 }))
  })
})

describe('diff', () => {
  it('sends only new, changed and deleted items', () => {
    const data = base()
    const synced = toSnapshot(data)
    expect(diff(synced, data)).toEqual([])

    const edited = { ...data, recipes: [{ ...data.recipes[0], name: 'Dal tadka' }], meals: [] }
    const rows = diff(synced, edited)
    expect(rows).toHaveLength(2)
    expect(rows).toContainEqual(expect.objectContaining({ collection: 'recipes', id: 'r1', deleted: false }))
    expect(rows).toContainEqual({ collection: 'meals', id: 'm1', data: null, deleted: true })
  })

  it('sends everything on a first sync', () => {
    expect(diff({}, base())).toHaveLength(2)
  })
})

describe('applyRemote', () => {
  it('adds, replaces and removes items, and records what now matches the server', () => {
    const data = base()
    const { data: next, snapshot } = applyRemote(data, [
      { collection: 'recipes', id: 'r1', data: { ...data.recipes[0], name: 'Renamed' }, deleted: false },
      { collection: 'recipes', id: 'r2', data: { ...data.recipes[0], id: 'r2', name: 'New' }, deleted: false },
      { collection: 'meals', id: 'm1', data: null, deleted: true },
    ])
    expect(next.recipes.map((r) => r.name).sort()).toEqual(['New', 'Renamed'])
    expect(next.meals).toEqual([])
    // Nothing received from the server should be sent straight back
    expect(diff(mergeSnapshot(toSnapshot(data), snapshot), next)).toEqual([])
  })

  it('ignores collections it does not sync', () => {
    const data = base()
    expect(applyRemote(data, [{ collection: 'settings', id: 'x', data: {}, deleted: false }]).data).toEqual(data)
  })
})

describe('photoIds', () => {
  it('lists each photo once', () => {
    expect(photoIds(base()).sort()).toEqual(['p1', 'p2'])
  })
})
