import type { GrocerySection } from '../types'

export interface ParsedIngredient {
  quantity: number | null
  quantityMax: number | null // for ranges like "2-3 cloves"
  unit: string | null // canonical unit, e.g. "tbsp"
  name: string // the rest of the line, as written
  key: string // normalized name for matching, e.g. "red onion"
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}

const UNIT_ALIASES: Record<string, string> = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbl: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  pinch: 'pinch', pinches: 'pinch',
  handful: 'handful', handfuls: 'handful',
  bunch: 'bunch', bunches: 'bunch',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece', pc: 'piece', pcs: 'piece',
  packet: 'packet', packets: 'packet', pack: 'packet', packs: 'packet',
  sprig: 'sprig', sprigs: 'sprig',
  stick: 'stick', sticks: 'stick',
  inch: 'inch', inches: 'inch',
}

// Words that describe preparation or size rather than what to buy.
const DESCRIPTORS = new Set([
  'chopped', 'finely', 'roughly', 'diced', 'minced', 'sliced', 'thinly', 'grated', 'crushed', 'fresh',
  'freshly', 'ground', 'large', 'medium', 'small', 'big', 'ripe', 'peeled', 'boiled', 'cooked', 'raw',
  'whole', 'halved', 'cubed', 'softened', 'melted', 'beaten', 'optional', 'heaped', 'level', 'about',
  'approx', 'of', 'a', 'an', 'the', 'some', 'few', 'and', 'or', 'to', 'taste', 'for', 'garnish', 'needed',
  'as', 'per', 'more', 'extra', 'organic', 'frozen', 'dried', 'dry', 'soaked',
])

function parseNumber(token: string): number | null {
  if (token in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[token]
  // "1½"
  const mixedUnicode = token.match(/^(\d+)([½⅓⅔¼¾⅕⅛⅜⅝⅞])$/)
  if (mixedUnicode) return Number(mixedUnicode[1]) + UNICODE_FRACTIONS[mixedUnicode[2]]
  const frac = token.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token)
  return null
}

function singular(word: string): string {
  if (word.length <= 3 || word.endsWith('ss')) return word
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (/(tomato|potato|mango)es$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

/** Lowercase, drop parentheticals/notes after commas, strip descriptors, singularize. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[,;]/)[0]
    .replace(/[^a-z\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !DESCRIPTORS.has(w))
    .map(singular)
    .join(' ')
    .trim()
}

export function parseIngredient(line: string): ParsedIngredient {
  // Separate glued numbers/units ("200g", "1½cups") and spaced ranges ("2 - 3", "2 to 3")
  const text = line
    .trim()
    .replace(/^(\d+(?:[./]\d+)?[½⅓⅔¼¾⅕⅛⅜⅝⅞]?)([a-zA-Z])/, '$1 $2')
    .replace(/^(\S+)\s*(?:-|–|to)\s*(\d)/, '$1-$2')
  const tokens = text.split(/\s+/)
  let i = 0
  let quantity: number | null = null
  let quantityMax: number | null = null

  const first = tokens[0] ?? ''
  const range = first.match(/^([\d./½⅓⅔¼¾⅕⅛⅜⅝⅞]+)[-–]([\d./½⅓⅔¼¾⅕⅛⅜⅝⅞]+)$/)
  if (range) {
    quantity = parseNumber(range[1])
    quantityMax = parseNumber(range[2])
    if (quantity != null) i = 1
  } else {
    quantity = parseNumber(first)
    if (quantity != null) {
      i = 1
      // "1 1/2" or "1 ½"
      const next = tokens[1] ? parseNumber(tokens[1]) : null
      if (next != null && next < 1 && Number.isInteger(quantity)) {
        quantity += next
        i = 2
      }
    }
  }

  let unit: string | null = null
  const maybeUnit = tokens[i]?.toLowerCase().replace(/\.$/, '')
  if (quantity != null && maybeUnit && maybeUnit in UNIT_ALIASES) {
    unit = UNIT_ALIASES[maybeUnit]
    i++
  }

  const name = tokens.slice(i).join(' ').replace(/^of\s+/i, '')
  return { quantity, quantityMax, unit, name, key: normalizeName(name) }
}

const NICE_FRACTIONS: [number, string][] = [
  [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'], [0.5, '½'], [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'], [0.875, '⅞'],
]

export function formatQuantity(n: number): string {
  const whole = Math.floor(n)
  const rest = n - whole
  if (rest < 0.04) return String(whole)
  if (rest > 0.96) return String(whole + 1)
  for (const [value, glyph] of NICE_FRACTIONS) {
    if (Math.abs(rest - value) < 0.02) return whole ? `${whole}${glyph}` : glyph
  }
  return String(Math.round(n * 100) / 100)
}

/**
 * Rounds a scaled amount to something you can actually measure: whole items for counts
 * ("3 onions", or halves below 2), nearest ⅛ for small measures, whole grams/ml for big ones.
 */
function roundForKitchen(n: number, unit: string | null): number {
  if (!unit) return n < 2 ? Math.max(0.5, Math.round(n * 2) / 2) : Math.round(n)
  if (['g', 'ml'].includes(unit)) return n >= 50 ? Math.round(n / 5) * 5 : Math.round(n)
  if (['clove', 'can', 'slice', 'piece', 'packet', 'sprig', 'stick', 'bunch'].includes(unit))
    return Math.max(1, Math.round(n))
  return Math.max(0.125, Math.round(n * 8) / 8)
}

function formatAmount(p: ParsedIngredient, factor = 1): string {
  if (p.quantity == null) return ''
  const scale = (n: number) => formatQuantity(factor === 1 ? n : roundForKitchen(n * factor, p.unit))
  const q = scale(p.quantity)
  const max = p.quantityMax != null ? `–${scale(p.quantityMax)}` : ''
  return [q + max, p.unit].filter(Boolean).join(' ')
}

/** Rewrites an ingredient line with its quantity multiplied, e.g. ("2 cups rice", 1.5) → "3 cups rice". */
export function scaleIngredient(line: string, factor: number): string {
  if (factor === 1) return line
  const p = parseIngredient(line)
  if (p.quantity == null) return line
  const amount = formatAmount(p, factor)
  const plural = p.unit && p.quantity * factor > 1 && ['cup', 'clove', 'can', 'slice', 'piece', 'sprig', 'stick'].includes(p.unit)
  return `${amount}${plural ? 's' : ''} ${p.name}`.trim()
}

export interface MergedIngredient {
  key: string
  name: string
  quantity: string
}

/** Combines ingredient lines from several recipes into one shopping list, summing matching units. */
export function mergeIngredients(lines: string[]): MergedIngredient[] {
  const groups = new Map<string, { name: string; amounts: Map<string, number>; loose: number }>()
  for (const line of lines) {
    const p = parseIngredient(line)
    if (!p.key) continue
    const g = groups.get(p.key) ?? { name: p.key, amounts: new Map(), loose: 0 }
    if (p.quantity == null) g.loose++
    else {
      const unit = p.unit ?? ''
      g.amounts.set(unit, (g.amounts.get(unit) ?? 0) + (p.quantityMax ?? p.quantity))
    }
    groups.set(p.key, g)
  }
  return [...groups.entries()].map(([key, g]) => ({
    key,
    name: g.name,
    quantity: [...g.amounts.entries()]
      .map(([unit, q]) => [formatQuantity(q), unit].filter(Boolean).join(' '))
      .join(' + '),
  }))
}

/** True when two normalized names refer to the same thing ("onion" ~ "red onion"). */
export function sameIngredient(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  return new RegExp(`(^|\\s)${short.replace(/[-]/g, '\\-')}($|\\s)`).test(long)
}

// Things nearly every kitchen has; not counted as "missing" when suggesting recipes.
const STAPLES = ['salt', 'water', 'pepper', 'black pepper', 'oil', 'sugar', 'ice']

export const isStaple = (key: string) => STAPLES.includes(key) || key.endsWith(' oil')

const SECTION_KEYWORDS: [GrocerySection, string[]][] = [
  ['Frozen', ['frozen', 'ice cream', 'peas frozen']],
  ['Dairy & eggs', ['milk', 'cheese', 'butter', 'ghee', 'paneer', 'cream', 'yogurt', 'yoghurt', 'curd', 'egg', 'mozzarella', 'parmesan', 'cheddar', 'feta']],
  ['Meat & fish', ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'fish', 'prawn', 'shrimp', 'salmon', 'tuna', 'bacon', 'sausage', 'mince', 'turkey', 'crab']],
  ['Bakery', ['bread', 'bun', 'pav', 'tortilla', 'pita', 'naan', 'bagel', 'croissant', 'roll']],
  ['Grains & pulses', ['rice', 'flour', 'atta', 'maida', 'besan', 'pasta', 'noodle', 'spaghetti', 'oat', 'dal', 'lentil', 'chickpea', 'chana', 'rajma', 'bean', 'quinoa', 'semolina', 'rava', 'sooji', 'poha', 'couscous', 'moong', 'urad', 'toor']],
  ['Spices & condiments', ['salt', 'pepper', 'cumin', 'jeera', 'turmeric', 'haldi', 'masala', 'chili powder', 'chilli powder', 'paprika', 'coriander powder', 'cinnamon', 'cardamom', 'clove', 'bay leaf', 'mustard seed', 'asafoetida', 'hing', 'oregano', 'thyme', 'basil dried', 'sauce', 'ketchup', 'vinegar', 'oil', 'honey', 'sugar', 'jaggery', 'mayonnaise', 'mustard', 'stock', 'bouillon', 'yeast', 'baking', 'vanilla', 'seed', 'fenugreek', 'methi seed', 'saffron']],
  ['Snacks & drinks', ['chips', 'biscuit', 'cookie', 'juice', 'soda', 'tea', 'coffee', 'chocolate', 'nut', 'almond', 'cashew', 'peanut', 'walnut', 'raisin']],
  ['Produce', ['onion', 'tomato', 'potato', 'garlic', 'ginger', 'chili', 'chilli', 'capsicum', 'pepper bell', 'bell pepper', 'carrot', 'spinach', 'palak', 'cabbage', 'cauliflower', 'broccoli', 'pea', 'okra', 'bhindi', 'eggplant', 'brinjal', 'cucumber', 'lettuce', 'lemon', 'lime', 'apple', 'banana', 'mango', 'orange', 'berry', 'grape', 'coriander', 'cilantro', 'mint', 'basil', 'parsley', 'leaf', 'mushroom', 'zucchini', 'pumpkin', 'gourd', 'avocado', 'corn', 'scallion', 'spring onion', 'celery', 'beet', 'radish', 'fruit', 'vegetable', 'herb']],
  ['Household', ['foil', 'paper', 'soap', 'detergent', 'tissue', 'bag', 'wrap']],
]

export function guessSection(name: string): GrocerySection {
  const key = normalizeName(name) || name.toLowerCase()
  for (const [section, words] of SECTION_KEYWORDS) {
    if (words.some((w) => sameIngredient(w, key) || key.includes(w))) return section
  }
  return 'Other'
}

// Words people type in "avoid" lists that stand for a whole family of ingredients.
const AVOID_GROUPS: Record<string, string[]> = {
  nuts: ['nut', 'almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut', 'peanut', 'macadamia'],
  'tree nuts': ['almond', 'cashew', 'walnut', 'pistachio', 'pecan', 'hazelnut', 'macadamia'],
  dairy: ['milk', 'cheese', 'butter', 'ghee', 'paneer', 'cream', 'yogurt', 'yoghurt', 'curd', 'khoya', 'mozzarella', 'parmesan'],
  lactose: ['milk', 'cheese', 'cream', 'yogurt', 'curd', 'paneer', 'ice cream'],
  gluten: ['wheat', 'flour', 'maida', 'atta', 'bread', 'pasta', 'noodle', 'semolina', 'rava', 'sooji', 'barley', 'rye', 'couscous', 'pav', 'naan', 'roti'],
  egg: ['egg', 'mayonnaise'],
  eggs: ['egg', 'mayonnaise'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'],
  seafood: ['fish', 'shrimp', 'prawn', 'crab', 'lobster', 'salmon', 'tuna', 'squid'],
  meat: ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'turkey', 'mince'],
  'non-veg': ['chicken', 'mutton', 'lamb', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'turkey', 'mince', 'fish', 'prawn', 'shrimp', 'crab', 'egg'],
  soy: ['soy', 'tofu', 'edamame', 'tempeh'],
  'onion garlic': ['onion', 'garlic', 'shallot', 'scallion', 'leek'],
}

/** Which of `avoid` keywords appear in the given ingredient lines. Returns the keywords that matched. */
export function findAvoided(ingredients: string[], avoid: string[]): string[] {
  const keys = ingredients.map((l) => ' ' + (normalizeName(l) || l.toLowerCase()) + ' ')
  return avoid.filter((word) => {
    const w = word.toLowerCase().trim()
    const terms = AVOID_GROUPS[w] ?? [singular(w)]
    return terms.some((t) => keys.some((k) => k.includes(' ' + t) || k.includes(t + ' ')))
  })
}

export interface Duration {
  label: string
  seconds: number
}

/** Finds cooking times in a step, e.g. "simmer for 10-12 minutes" → [{label: '12 min', seconds: 720}]. */
export function findDurations(step: string): Duration[] {
  const re = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h\b|minutes?|mins?|m\b|seconds?|secs?)/gi
  const out: Duration[] = []
  for (const m of step.matchAll(re)) {
    const n = Number(m[2] ?? m[1])
    const unit = m[3].toLowerCase()
    const mult = unit.startsWith('h') ? 3600 : unit.startsWith('s') ? 1 : 60
    const short = mult === 3600 ? 'hr' : mult === 1 ? 'sec' : 'min'
    out.push({ label: `${n} ${short}`, seconds: Math.round(n * mult) })
  }
  return out
}
