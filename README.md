# 🍲 Recipe Log

Save your recipes, plan the week, shop for it, and keep track of what the family actually eats.

Built with React + TypeScript + Vite. There's no server: everything is stored in your browser (localStorage, and IndexedDB for photos). It can be installed on a phone's home screen and works offline.

## Features

**Today**: a dashboard with today's meals (tick off planned ones), one-tap quick log of your usual meals, "same as yesterday", leftovers and pantry items to use up, and recipes you can cook right now with what you have.

**Week planner**
- Plan meals ahead (dashed) and mark them eaten (✓), or log after the fact
- Recurring meals ("Friday = pizza night") show up as one-tap suggestions
- Copy last week, or save a week as a template and reuse it
- 🛒 *Shop for plan* turns the planned recipes into a shopping list

**Recipes**
- Photos, ingredients, steps, category, time, servings, tags, favorites
- Search by name, ingredient or tag; sort by A–Z, recent, most cooked, or *can cook now* (pantry match)
- Serving scaler that rounds to sensible kitchen amounts
- Cooking journal: dated notes like "less chili next time"
- Allergy / dislike warnings for each family member
- 🎲 Surprise me, which favors favorites and recipes you haven't made in a while
- ✨ Import from a photo (cookbook page, handwritten card) or pasted text using Claude (needs your own API key)

**Cook mode**: one step at a time in big text, the screen stays on, ingredient checklist, timers detected from the steps ("simmer 10 minutes" becomes a 10 min timer button), and an option to read steps aloud.

**Kitchen**
- Shopping list grouped by aisle, shareable to WhatsApp/Notes; "Done shopping" moves bought items to the pantry
- Pantry with optional expiry dates; "Ran out" sends an item back to the shopping list
- Leftovers with eat-by dates; logging a meal can create them ("made 2 extra portions") and eating them counts portions down

**Insights**: meals logged, % home-cooked, ratings, logging streak, 12-week heatmap, most cooked, category mix, family favorites, and dishes you haven't made in a while.

**Settings**: family members and foods they avoid (group words like *nuts, dairy, gluten, non-veg* work), recurring meals, the AI key, light/dark theme, and backup/restore (a JSON file that includes photos).

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check and production build into `dist/` |
| `npm run preview` | Serve the production build (offline/install support only works here, not in dev) |
| `npm test` | Unit tests for the ingredient parser, scaler, grocery merging and allergy matching |
| `npm run lint` | Lint |

## AI import

Recipe import calls the Claude API (`claude-opus-5-5`) straight from the browser with an Anthropic API key you paste in Settings. The key stays in that browser's storage and is left out of backups. Each import costs roughly a cent.

## Data & privacy

All data stays on the device you use. To move to another device, or to keep a safety copy, use **Settings → Download backup** and **Restore from file**.
