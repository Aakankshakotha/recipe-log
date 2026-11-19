# 🍲 Recipe Log

A simple app to save your recipes and keep track of what you eat.

Built with React + TypeScript + Vite. No backend — everything is saved in your browser (localStorage).

## Features

- **Meal log** — week-by-week view of breakfast, lunch, dinner and snacks. Log a saved recipe or just type what you ate (e.g. takeout), add a 1–5 star rating and notes. Click any meal to edit or delete it.
- **Recipes** — ingredients, steps, category, prep time, servings, tags and notes. Search by name, ingredient or tag; filter by category or favorites. Each recipe shows how often and when you last cooked it, and has a "Log as eaten" button.
- **Insights** — meals logged, % from your own recipes, average rating, most-cooked recipes, and recipes you haven't made in a while.
- **Export / Import** — download a JSON backup and restore it (or move it to another browser/device).

## Run it

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

Other scripts: `npm run build` (type-check + production build), `npm run lint`, `npm run preview`.
