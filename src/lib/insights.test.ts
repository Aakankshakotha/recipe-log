import { describe, expect, it } from 'vitest'
import { normalize } from '../store'
import type { MealEntry } from '../types'
import { buildTips, weekInsights } from './insights'

// Thursday 2026-11-19; the week starts Monday 2026-11-16, last week Monday 2026-11-09
const TODAY = '2026-11-19'

const meal = (date: string, extra: Partial<MealEntry> = {}): MealEntry => ({
  id: crypto.randomUUID(),
  date,
  mealType: 'dinner',
  status: 'eaten',
  recipeId: null,
  leftoverId: null,
  description: 'Takeout',
  rating: null,
  notes: '',
  photoId: null,
  eatenBy: [],
  ...extra,
})

describe('weekInsights', () => {
  it('compares week-to-date with the same days last week', () => {
    const meals = [
      meal('2026-11-16', { recipeId: 'a' }),
      meal('2026-11-17', { recipeId: 'b' }),
      meal('2026-11-19'),
      meal('2026-11-19', { leftoverId: 'l1', recipeId: 'a' }),
      meal('2026-11-20', { status: 'planned', recipeId: 'c' }),
      // last week: Mon–Thu count, Fri does not
      meal('2026-11-10', { recipeId: 'a' }),
      meal('2026-11-13', { recipeId: 'a' }),
    ]
    const w = weekInsights(meals, TODAY)
    expect(w.meals).toEqual({ value: 4, previous: 1 })
    expect(w.recipeShare).toEqual({ value: 75, previous: 100 })
    expect(w.dishes.value).toBe(3) // a, b, takeout
    expect(w.leftovers.value).toBe(1)
    expect(w.days[3]).toEqual({ date: TODAY, fromRecipes: 1, other: 1, planned: 0 })
    expect(w.days[4].planned).toBe(1)
  })
})

describe('buildTips', () => {
  it('puts urgent leftovers and expiring food first, with a recipe that uses it', () => {
    const data = normalize({
      recipes: [{ id: 'r1', name: 'Palak Paneer', category: 'Curry', ingredients: ['200 g paneer', '1 bunch spinach'], createdAt: '2026-11-01T00:00:00Z' }],
      pantry: [{ id: 'p1', name: 'paneer', quantity: '', section: 'Dairy & eggs', expires: '2026-11-20' }],
      leftovers: [{ id: 'l1', name: 'Dal', recipeId: null, madeOn: '2026-11-18', eatBy: TODAY, portions: 2 }],
    })
    const tips = buildTips(data, TODAY)
    expect(tips[0].title).toBe('Eat the Dal leftovers today')
    expect(tips[1]).toMatchObject({ title: 'Paneer expires tomorrow', detail: 'Use it in Palak Paneer' })
  })

  it('nudges for variety when one category dominates', () => {
    const data = normalize({
      recipes: [
        { id: 'r1', name: 'Biryani', category: 'Rice', ingredients: [], createdAt: '2026-11-01T00:00:00Z' },
        { id: 'r2', name: 'Greek Salad', category: 'Salad', ingredients: [], createdAt: '2026-11-01T00:00:00Z' },
      ],
      meals: [meal('2026-11-17', { recipeId: 'r1' }), meal('2026-11-18', { recipeId: 'r1' }), meal(TODAY, { recipeId: 'r1' })],
    })
    const variety = buildTips(data, TODAY, 10).find((t) => t.id === 'variety')
    expect(variety).toMatchObject({ title: 'Rice 3 times this week', detail: 'Mix it up with Greek Salad?' })
  })
})
