import { describe, expect, it } from 'vitest'
import {
  findAvoided,
  findDurations,
  formatQuantity,
  normalizeName,
  parseIngredient,
  scaleIngredient,
} from './ingredients'

describe('parseIngredient', () => {
  it.each([
    ['2 cups basmati rice', 2, null, 'cup', 'basmati rice'],
    ['1 1/2 tbsp oil', 1.5, null, 'tbsp', 'oil'],
    ['½ tsp turmeric', 0.5, null, 'tsp', 'turmeric'],
    ['1½ cups milk', 1.5, null, 'cup', 'milk'],
    ['200g paneer, cubed', 200, null, 'g', 'paneer'],
    ['2-3 cloves garlic', 2, 3, 'clove', 'garlic'],
    ['2 to 3 green chillies', 2, 3, null, 'green chilly'],
    ['3 large tomatoes, chopped', 3, null, null, 'tomato'],
    ['Salt to taste', null, null, null, 'salt'],
  ])('%s', (line, q, qMax, unit, key) => {
    const p = parseIngredient(line)
    expect(p.quantity).toBe(q)
    expect(p.quantityMax).toBe(qMax)
    expect(p.unit).toBe(unit)
    expect(p.key).toBe(key)
  })
})

describe('scaleIngredient', () => {
  it('scales and formats fractions', () => {
    expect(scaleIngredient('1 cup rice', 1.5)).toBe('1½ cups rice')
    expect(scaleIngredient('2 tbsp ghee', 0.5)).toBe('1 tbsp ghee')
    expect(scaleIngredient('2-3 cloves garlic', 2)).toBe('4–6 cloves garlic')
    expect(scaleIngredient('Salt to taste', 2)).toBe('Salt to taste')
    // 4 → 5 servings: counts round to whole items, measures snap to kitchen fractions
    expect(scaleIngredient('10 cashews', 1.25)).toBe('13 cashews')
    expect(scaleIngredient('2 onions', 1.25)).toBe('3 onions')
    expect(scaleIngredient('½ cup cream', 1.25)).toBe('⅝ cup cream')
    expect(scaleIngredient('1 onion', 0.5)).toBe('½ onion')
    expect(scaleIngredient('3 cloves garlic', 0.5)).toBe('2 cloves garlic')
    expect(scaleIngredient('200 g paneer', 1.25)).toBe('250 g paneer')
  })
})

describe('formatQuantity', () => {
  it('uses nice fractions', () => {
    expect(formatQuantity(0.333)).toBe('⅓')
    expect(formatQuantity(2.25)).toBe('2¼')
    expect(formatQuantity(3)).toBe('3')
    expect(formatQuantity(1.1)).toBe('1.1')
  })
})

describe('matching', () => {
  it('normalizes ingredient names', () => {
    expect(normalizeName('Fresh coriander leaves (for garnish)')).toBe('coriander leave')
  })

  it('finds avoided foods including groups', () => {
    const lines = ['200g paneer', '10 cashews', '1 tbsp butter', '2 onions']
    expect(findAvoided(lines, ['nuts', 'dairy', 'egg'])).toEqual(['nuts', 'dairy'])
    expect(findAvoided(lines, ['onion'])).toEqual(['onion'])
  })
})

describe('findDurations', () => {
  it('finds times in steps', () => {
    expect(findDurations('Simmer for 10-12 minutes, then rest 1 hour')).toEqual([
      { label: '12 min', seconds: 720 },
      { label: '1 hr', seconds: 3600 },
    ])
    expect(findDurations('Add 2 cups water')).toEqual([])
  })
})
