import { Check, Package, Refrigerator, Share2, ShoppingBasket } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { GroceryItem, GrocerySection, PantryItem } from '../types'
import { newId, useStore } from '../store'
import { useNav } from '../nav'
import { addDaysISO, daysBetween, formatDate, relativeDay, todayISO } from '../lib/dates'
import { guessSection } from '../lib/ingredients'
import { Empty, Segmented } from './ui'

const SECTIONS: GrocerySection[] = [
  'Produce',
  'Dairy & eggs',
  'Meat & fish',
  'Bakery',
  'Grains & pulses',
  'Spices & condiments',
  'Frozen',
  'Snacks & drinks',
  'Household',
  'Other',
]

type Sub = 'shopping' | 'pantry' | 'leftovers'

export function KitchenView() {
  const { data } = useStore()
  const [sub, setSub] = useState<Sub>('shopping')
  const unchecked = data.groceries.filter((g) => !g.checked).length

  return (
    <section>
      <div className="toolbar">
        <Segmented
          value={sub}
          onChange={setSub}
          options={[
            { value: 'shopping', label: `Shopping list${unchecked ? ` · ${unchecked}` : ''}` },
            { value: 'pantry', label: `Pantry · ${data.pantry.length}` },
            { value: 'leftovers', label: `Leftovers · ${data.leftovers.length}` },
          ]}
        />
      </div>
      {sub === 'shopping' && <Shopping />}
      {sub === 'pantry' && <Pantry />}
      {sub === 'leftovers' && <Leftovers />}
    </section>
  )
}

/** Splits "2 kg onions" into quantity + name so quick-add stays one field. */
function splitQuick(text: string): { name: string; quantity: string } {
  const m = text.trim().match(/^([\d./½¼¾⅓⅔]+\s*(?:kg|g|l|ml|lb|lbs|oz|dozen|pack|packs|x)?)\s+(.+)$/i)
  return m ? { quantity: m[1], name: m[2] } : { quantity: '', name: text.trim() }
}

function groupBySection<T extends { section: GrocerySection }>(items: T[]) {
  return SECTIONS.map((s) => [s, items.filter((i) => i.section === s)] as const).filter(([, list]) => list.length)
}

function Shopping() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const [text, setText] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const { name, quantity } = splitQuick(text)
    store.upsert('groceries', { id: newId(), name, quantity, section: guessSection(name), checked: false })
    setText('')
  }

  const toggle = (g: GroceryItem) => store.upsert('groceries', { ...g, checked: !g.checked })
  const checked = data.groceries.filter((g) => g.checked)
  const open = data.groceries.filter((g) => !g.checked)

  const share = async () => {
    const body = groupBySection(open)
      .map(([s, items]) => `${s}\n${items.map((i) => `☐ ${[i.quantity, i.name].filter(Boolean).join(' ')}`).join('\n')}`)
      .join('\n\n')
    const textOut = `🛒 Shopping list\n\n${body}`
    if (navigator.share) {
      navigator.share({ text: textOut }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(textOut)
      nav.toast('Copied — paste it into WhatsApp or Notes')
    }
  }

  return (
    <div className="card">
      <form className="inline-form" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add item, e.g. “2 kg onions”" />
        <button type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      <p className="muted small">
        Tip: plan meals in the Planner, then press “Shop for plan” to fill this list automatically.
      </p>

      {data.groceries.length === 0 ? (
        <Empty icon={<ShoppingBasket size={28} />} title="Your shopping list is empty" />
      ) : (
        <>
          {groupBySection(open).map(([section, items]) => (
            <div key={section} className="aisle">
              <h4>{section}</h4>
              <ul className="checklist">
                {items.map((g) => (
                  <GroceryRow key={g.id} item={g} onToggle={() => toggle(g)} />
                ))}
              </ul>
            </div>
          ))}
          {checked.length > 0 && (
            <div className="aisle">
              <h4>In the cart ({checked.length})</h4>
              <ul className="checklist">
                {checked.map((g) => (
                  <GroceryRow key={g.id} item={g} onToggle={() => toggle(g)} />
                ))}
              </ul>
            </div>
          )}
          <div className="actions">
            {open.length > 0 && (
              <button className="ghost small" onClick={share}>
                <Share2 size={15} aria-hidden /> Share list
              </button>
            )}
            {checked.length > 0 && (
              <>
                <button className="ghost small" onClick={store.clearChecked}>
                  Clear checked
                </button>
                <button
                  className="small"
                  onClick={() => {
                    store.moveCheckedToPantry()
                    nav.toast(`Moved ${checked.length} items to the pantry`)
                  }}
                >
                  <Check size={15} aria-hidden /> Done shopping, move to pantry
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function GroceryRow({ item, onToggle }: { item: GroceryItem; onToggle: () => void }) {
  const store = useStore()
  return (
    <li className={item.checked ? 'done' : ''}>
      <label>
        <input type="checkbox" checked={item.checked} onChange={onToggle} />
        <span>
          {item.name}
          {item.quantity && <span className="muted small"> · {item.quantity}</span>}
        </span>
      </label>
      <select
        className="section-select"
        value={item.section}
        onChange={(e) => store.upsert('groceries', { ...item, section: e.target.value as GrocerySection })}
        aria-label="Section"
      >
        {SECTIONS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <button className="icon-btn small" onClick={() => store.remove('groceries', item.id)} aria-label="Remove">
        ✕
      </button>
    </li>
  )
}

function Pantry() {
  const store = useStore()
  const { data } = store
  const today = todayISO()
  const [text, setText] = useState('')
  const [expires, setExpires] = useState('')
  const [filter, setFilter] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const { name, quantity } = splitQuick(text)
    store.upsert('pantry', { id: newId(), name, quantity, section: guessSection(name), expires: expires || null })
    setText('')
    setExpires('')
  }

  const items = data.pantry.filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="card">
      <form className="inline-form" onSubmit={add}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you have? e.g. “paneer”" />
        <input
          type="date"
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          title="Expiry date (optional)"
          className="date-input"
        />
        <button type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      <p className="muted small">
        Recipes show what you already have, and “Can cook now” on the Recipes tab sorts by it. Expiry dates are
        optional — items expiring soon show up on Today.
      </p>
      {data.pantry.length > 8 && (
        <input className="search" type="search" placeholder="Filter pantry…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      {data.pantry.length === 0 ? (
        <Empty icon={<Refrigerator size={28} />} title="Pantry is empty">
          <p className="muted">Add what's in your fridge and cupboards, or tick items off the shopping list.</p>
        </Empty>
      ) : (
        groupBySection(items).map(([section, list]) => (
          <div key={section} className="aisle">
            <h4>{section}</h4>
            <ul className="checklist">
              {list.map((p) => (
                <PantryRow key={p.id} item={p} today={today} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}

function PantryRow({ item, today }: { item: PantryItem; today: string }) {
  const store = useStore()
  const nav = useNav()
  const days = item.expires ? daysBetween(today, item.expires) : null
  return (
    <li>
      <span className="grow">
        {item.name}
        {item.quantity && <span className="muted small"> · {item.quantity}</span>}
      </span>
      {days != null && (
        <span className={`due ${days <= 0 ? 'urgent' : days <= 3 ? 'soon' : ''}`}>
          {days < 0 ? 'expired' : 'exp.'} {relativeDay(item.expires!)}
        </span>
      )}
      <button
        className="ghost small"
        title="Ran out — add to shopping list"
        onClick={() => {
          store.remove('pantry', item.id)
          store.upsert('groceries', {
            id: newId(),
            name: item.name,
            quantity: '',
            section: item.section,
            checked: false,
          })
          nav.toast(`${item.name} moved to the shopping list`)
        }}
      >
        Ran out
      </button>
      <button className="icon-btn small" onClick={() => store.remove('pantry', item.id)} aria-label="Remove">
        ✕
      </button>
    </li>
  )
}

function Leftovers() {
  const store = useStore()
  const { data } = store
  const nav = useNav()
  const today = todayISO()
  const [name, setName] = useState('')
  const [portions, setPortions] = useState(2)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    store.addLeftover({ name: name.trim(), recipeId: null, madeOn: today, eatBy: addDaysISO(today, 3), portions })
    setName('')
  }

  const sorted = [...data.leftovers].sort((a, b) => a.eatBy.localeCompare(b.eatBy))

  return (
    <div className="card">
      <form className="inline-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What's left over?" />
        <input
          type="number"
          min={1}
          value={portions}
          onChange={(e) => setPortions(Math.max(1, Number(e.target.value)))}
          className="tiny"
          title="Portions"
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      <p className="muted small">
        Tip: when you log a meal as eaten, you can say how many extra portions you made — they land here
        automatically with a 3-day “eat by” date.
      </p>
      {sorted.length === 0 ? (
        <Empty icon={<Package size={28} />} title="No leftovers" />
      ) : (
        <ul className="list">
          {sorted.map((l) => {
            const days = daysBetween(today, l.eatBy)
            return (
              <li key={l.id}>
                <div className="grow">
                  <strong>{l.name}</strong>
                  <div className="muted small">
                    Made {formatDate(l.madeOn)} · {l.portions} portion{l.portions > 1 ? 's' : ''}
                  </div>
                </div>
                <label className="inline small">
                  Eat by
                  <input
                    type="date"
                    value={l.eatBy}
                    onChange={(e) => e.target.value && store.upsert('leftovers', { ...l, eatBy: e.target.value })}
                    className={`date-input ${days < 0 ? 'urgent' : days <= 1 ? 'soon' : ''}`}
                  />
                </label>
                <div className="row-actions">
                  <button className="small" onClick={() => nav.editMeal({ leftoverId: l.id, date: today, status: 'eaten' })}>
                    Eat
                  </button>
                  <button
                    className="ghost small danger"
                    onClick={() => store.remove('leftovers', l.id)}
                    title="Threw it away / finished"
                  >
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
