import { describe, expect, it } from 'vitest'
import { normalize } from './store'

const recipe = { id: 'r1', name: 'Dal', notes: 'Less salt', journal: [{ id: 'j1', date: '2026-11-01', text: 'More lemon' }] }

describe('normalize (older saves)', () => {
  it('folds cooking-journal notes into the recipe notes, once', () => {
    const once = normalize({ recipes: [recipe] })
    expect(once.recipes[0].notes).toBe('Less salt\n2026-11-01: More lemon')
    expect('journal' in once.recipes[0]).toBe(false)
    // Saving and loading again must not repeat the lines
    expect(normalize(once).recipes[0].notes).toBe(once.recipes[0].notes)
  })

  it('drops planned meals and meals eaten from leftovers', () => {
    const data = normalize({
      meals: [
        { id: 'a', date: '2026-11-01', recipeId: 'r1' },
        { id: 'b', date: '2026-11-02', recipeId: 'r1', status: 'planned' } as never,
        { id: 'c', date: '2026-11-03', recipeId: 'r1', leftoverId: 'l1' } as never,
      ],
    })
    expect(data.meals.map((m) => m.id)).toEqual(['a'])
  })
})
