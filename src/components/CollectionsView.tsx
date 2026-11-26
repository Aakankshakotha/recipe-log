import { Layers } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useNav } from '../nav'
import { DishImage, Empty } from './ui'
import { JournalView } from './JournalView'

/** Recipes grouped by tag: "weeknight", "baking", "kids"… Tap one to see what's in it. */
export function CollectionsView({ openId, setOpenId }: { openId: string | null; setOpenId: (id: string | null) => void }) {
  const { data } = useStore()
  const nav = useNav()
  const [tag, setTag] = useState<string | null>(null)

  const collections = useMemo(() => {
    const byTag = new Map<string, typeof data.recipes>()
    for (const r of data.recipes) for (const t of r.tags) byTag.set(t, [...(byTag.get(t) ?? []), r])
    return [...byTag].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  }, [data])

  if (tag) {
    return (
      <>
        {!openId && (
          <button className="ghost small back" onClick={() => setTag(null)}>
            ‹ All collections
          </button>
        )}
        <JournalView title={tag.charAt(0).toUpperCase() + tag.slice(1)} tag={tag} openId={openId} setOpenId={setOpenId} />
      </>
    )
  }

  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">Collections</h1>
      </header>
      {collections.length === 0 ? (
        <Empty icon={<Layers size={28} />} title="No collections yet">
          <p className="muted">
            Add tags like “weeknight” or “baking” when you log or edit a recipe, and they'll group here.
          </p>
          <div className="row-actions center">
            <button onClick={nav.logRecipe}>Log a recipe</button>
          </div>
        </Empty>
      ) : (
        <ul className="grid journal-grid">
          {collections.map(([name, recipes]) => {
            const cover = recipes.find((r) => r.photoId) ?? recipes[0]
            return (
              <li key={name}>
                <button className="card recipe-card journal-card" onClick={() => setTag(name)}>
                  <div className="journal-photo">
                    <DishImage photoId={cover.photoId} name={cover.name} category={cover.category} className="recipe-photo" />
                  </div>
                  <div className="recipe-card-body">
                    <strong className="journal-title">{name.charAt(0).toUpperCase() + name.slice(1)}</strong>
                    <span className="muted small">
                      {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
