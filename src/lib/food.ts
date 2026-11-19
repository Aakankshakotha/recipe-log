// A picture for dishes that don't have a photo: an emoji plus a tint, guessed from the name and category.

// Order matters: specific dishes (dosa, biryani) come before generic words (masala, curry)
const EMOJI_KEYWORDS: [string, string[]][] = [
  ['🍚', ['rice', 'biryani', 'pulao', 'pilaf', 'khichdi', 'risotto', 'fried rice']],
  ['🥞', ['dosa', 'pancake', 'crepe', 'uttapam', 'chilla', 'waffle']],
  ['🫓', ['roti', 'chapati', 'paratha', 'naan', 'puri', 'flatbread', 'tortilla', 'thepla']],
  ['🍝', ['pasta', 'spaghetti', 'noodle', 'lasagna', 'macaroni', 'penne', 'ramen', 'lo mein', 'chow mein']],
  ['🍕', ['pizza']],
  ['🍔', ['burger', 'slider']],
  ['🌮', ['taco', 'burrito', 'quesadilla', 'wrap', 'kathi', 'frankie']],
  ['🥪', ['sandwich', 'toast', 'panini', 'sub']],
  ['🥗', ['salad', 'bowl', 'slaw', 'raita']],
  ['🍲', ['soup', 'stew', 'rasam', 'chili', 'chowder', 'broth', 'hotpot']],
  ['🍳', ['egg', 'omelette', 'omelet', 'bhurji', 'frittata', 'shakshuka']],
  ['🥣', ['oats', 'porridge', 'upma', 'poha', 'cereal', 'granola', 'muesli', 'idli']],
  ['🍗', ['chicken', 'wings', 'drumstick', 'tandoori']],
  ['🥩', ['steak', 'mutton', 'lamb', 'beef', 'pork', 'keema']],
  ['🐟', ['fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'seafood']],
  ['🥟', ['samosa', 'momo', 'dumpling', 'kachori', 'gyoza', 'pakora', 'bhaji', 'vada']],
  ['🍰', ['cake', 'pastry', 'muffin', 'brownie', 'cupcake']],
  ['🍮', ['kheer', 'halwa', 'pudding', 'custard', 'payasam', 'dessert', 'sweet', 'ladoo', 'barfi']],
  ['🍪', ['cookie', 'biscuit']],
  ['🥤', ['smoothie', 'shake', 'lassi', 'juice']],
  ['☕', ['tea', 'chai', 'coffee']],
  ['🥔', ['potato', 'aloo', 'fries']],
  ['🍆', ['baingan', 'brinjal', 'eggplant']],
  ['🥦', ['broccoli', 'stir fry', 'stir-fry', 'veg', 'vegetable']],
  ['🍎', ['fruit', 'apple', 'banana']],
  ['🍛', ['curry', 'masala', 'korma', 'dal', 'daal', 'sambar', 'rajma', 'chole', 'paneer', 'tikka', 'vindaloo', 'kadhi', 'sabzi', 'sabji']],
  ['🍿', ['snack', 'chips', 'popcorn', 'chaat', 'namkeen']],
]

const TINTS = ['#f6d7c3', '#f3e2b8', '#d8e8cf', '#d6e3f0', '#e6dbf2', '#f4d4dc', '#d9ede8']

export function foodEmoji(...texts: (string | null | undefined)[]): string {
  const hay = ' ' + texts.filter(Boolean).join(' ').toLowerCase() + ' '
  for (const [emoji, words] of EMOJI_KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return emoji
  }
  return '🍽️'
}

/** A soft background color that stays the same for the same dish name. */
export function foodTint(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]
}
