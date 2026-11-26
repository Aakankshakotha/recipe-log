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

## Sharing one recipe book across phones and laptops (optional)

By default everything stays on the device. To share it with someone else, or keep your own phone and laptop in step, connect a free [Supabase](https://supabase.com) project. Everyone uses **one shared login**.

1. Create a Supabase project (free tier).
2. **SQL Editor** → New query → paste `supabase/schema.sql` → Run. This creates a private table and a private photo bucket.
3. **Authentication → Users → Add user** → create the shared email and password (tick *Auto Confirm*). Then **Authentication → Sign In / Providers**, and turn **off** "Allow new users to sign up" so nobody else can create a login.
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
5. For the deployed site, add them as repository **variables** named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions → Variables), then re-run the deploy. To try it locally, copy `.env.example` to `.env.local`.
6. On each device open **Settings → Sync between devices** and sign in.

How it behaves: changes are sent a moment after you make them and picked up when you reopen the app (and every 30 seconds while it's open). Each recipe and cook syncs separately, and if two devices edit the same item the last edit wins. Anything already on a device is merged in when it first signs in. The theme and the AI key stay local. Restoring a backup replaces your data, and with sync on that replacement is shared too.

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
