# 🍲 Recipe Log

Keep a journal of everything you cook, with photos, recipes and ratings, and shop for it.

Built with React + TypeScript + Vite. There's no server: everything is stored in your browser (localStorage, and IndexedDB for photos). It can be installed on a phone's home screen and works offline.

## Features

**Home**: a greeting, your recent cooks, a few stats, and a shortcut to log your next recipe.

**Journal**: a photo gallery of your recipes, filterable by category, searchable, and sortable by recently cooked, highest rated, most cooked or A–Z. 🎲 *Surprise me* picks one, favoring favorites and recipes you haven't made in a while. **Favorites** and **Collections** (recipes grouped by tag) are shortcuts into the same gallery.

**Log a recipe**: add a photo, name, time and servings, then ingredients, method steps, a rating and a note. A live preview shows how the card will look. Saving also records your first cook. You can also ✨ import from a photo (cookbook page, handwritten card) or pasted text using Claude (needs your own API key).

**A recipe page**
- Ingredients with checkboxes and a serving scaler that rounds to sensible kitchen amounts; copy them or share the whole recipe
- **Cook history**: every time you cooked it, with date, rating, note and photo. Add one with *I cooked this*, and edit or delete any of them
- Allergy / dislike warnings for each family member
- Notes for next time

**Cook mode**: one step at a time in big text, the screen stays on, ingredient checklist, timers detected from the steps ("simmer 10 minutes" becomes a 10 min timer button), and an option to read steps aloud. When you finish, it opens the recipe so you can rate how it went.

**Settings**: family members and foods they avoid (group words like *nuts, dairy, gluten, non-veg* work), the AI key, light/dark theme, and backup/restore (a JSON file that includes photos).

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
| `npm test` | Unit tests for the ingredient parser, scaler, allergy matching and loading older saves |
| `npm run lint` | Lint |

## AI import

Recipe import calls the Claude API (`claude-opus-5-5`) straight from the browser with an Anthropic API key you paste in Settings. The key stays in that browser's storage and is left out of backups. Each import costs roughly a cent.

## Data & privacy

All data stays on the device you use. To move to another device, or to keep a safety copy, use **Settings → Download backup** and **Restore from file**.
