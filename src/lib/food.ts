import {
  Apple,
  Beef,
  CakeSlice,
  Coffee,
  Cookie,
  CookingPot,
  Croissant,
  CupSoda,
  Drumstick,
  EggFried,
  Fish,
  Hamburger,
  IceCreamCone,
  Leaf,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  Wheat,
  type LucideIcon,
} from 'lucide-react'

// A picture for dishes that don't have a photo: a line icon on a soft tint, guessed from the name and category.
// Order matters: specific dishes (dosa, biryani) come before generic words (masala, curry).
const ICON_KEYWORDS: [LucideIcon, string[]][] = [
  [CookingPot, ['rice', 'biryani', 'pulao', 'pilaf', 'khichdi', 'risotto']],
  [Wheat, ['roti', 'chapati', 'paratha', 'naan', 'puri', 'flatbread', 'thepla', 'dosa', 'idli', 'upma', 'poha', 'oats', 'porridge', 'cereal', 'granola', 'muesli']],
  [Croissant, ['pancake', 'crepe', 'waffle', 'croissant', 'pastry', 'bread', 'toast']],
  [Utensils, ['pasta', 'spaghetti', 'noodle', 'lasagna', 'macaroni', 'penne', 'ramen', 'lo mein', 'chow mein']],
  [Pizza, ['pizza']],
  [Hamburger, ['burger', 'slider']],
  [Sandwich, ['sandwich', 'panini', 'wrap', 'taco', 'burrito', 'quesadilla', 'kathi', 'frankie']],
  [Salad, ['salad', 'bowl', 'slaw', 'raita']],
  [Soup, ['soup', 'stew', 'rasam', 'chowder', 'broth', 'hotpot']],
  [EggFried, ['egg', 'omelette', 'omelet', 'bhurji', 'frittata', 'shakshuka']],
  [Drumstick, ['chicken', 'wings', 'drumstick', 'tandoori']],
  [Beef, ['steak', 'mutton', 'lamb', 'beef', 'pork', 'keema']],
  [Fish, ['fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'seafood']],
  [CakeSlice, ['cake', 'muffin', 'brownie', 'cupcake', 'kheer', 'halwa', 'pudding', 'custard', 'payasam', 'dessert', 'sweet', 'ladoo', 'barfi']],
  [IceCreamCone, ['ice cream', 'kulfi', 'gelato']],
  [Cookie, ['cookie', 'biscuit']],
  [CupSoda, ['smoothie', 'shake', 'lassi', 'juice']],
  [Coffee, ['tea', 'chai', 'coffee']],
  [Apple, ['fruit', 'apple', 'banana']],
  [Leaf, ['veg', 'vegetable', 'broccoli', 'stir fry', 'stir-fry', 'spinach', 'palak', 'sabzi', 'sabji']],
  [CookingPot, ['curry', 'masala', 'korma', 'dal', 'daal', 'sambar', 'rajma', 'chole', 'paneer', 'tikka', 'kadhi']],
  [Popcorn, ['snack', 'chips', 'popcorn', 'chaat', 'namkeen', 'samosa', 'pakora', 'bhaji', 'vada', 'momo']],
]

// Soft tints, each paired with a darker ink for the icon
// Warm, earthy tints that sit well with the terracotta theme
const TINTS: [string, string][] = [
  ['#f8e3d6', '#b0502c'], // peach / terracotta
  ['#f3e7d3', '#8a5a1c'], // sand / caramel
  ['#e4ecdc', '#4f6e3b'], // sage / olive
  ['#fbe7cf', '#b0661a'], // apricot / amber
  ['#f4e0dc', '#9c4537'], // blush / brick
  ['#ece6da', '#6b5a45'], // oat / walnut
]

export function foodIcon(...texts: (string | null | undefined)[]): LucideIcon {
  const hay = ' ' + texts.filter(Boolean).join(' ').toLowerCase() + ' '
  for (const [icon, words] of ICON_KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return icon
  }
  return CookingPot
}

/** A soft background + icon color that stays the same for the same dish name. */
export function foodTint(name: string): { bg: string; ink: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [bg, ink] = TINTS[h % TINTS.length]
  return { bg, ink }
}
