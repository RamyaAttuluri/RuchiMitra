# RuchiMitra frontend

Use Node 22 LTS. Run commands from this folder.

1. Copy `.env.example` to `.env.local` (or `.env`) and set `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
2. Run `npm ci`, then `npm run dev`.
3. Open http://localhost:3000 while the backend runs on port 5000.

Build checks: `npm run typecheck`, `npm run build`, `npm run audit:prod`.

NEXT_PUBLIC_API_URL is public and compiled at build time. Rebuild when its value changes. Never put provider API keys in NEXT_PUBLIC variables. Backend FRONTEND_ORIGIN must exactly match your browser address.

Pantry search includes simple dishes outside the starter catalogue. When there is no complete match and Gemini is configured, search automatically attempts an AI suggestion. Create a pantry recipe with AI also offers another dish using only your supplied ingredients and selected staples. Required ingredient names are checked on the backend before a suggestion can be shown as ready. Quantities are not inventory-tracked; check recipe measurements yourself.

Voice uses installed browser voices first, with optional server audio. On-demand translation requires working Gemini credentials unless the recipe already has a saved translation. Browser audio can require a user gesture. Narration and translated ingredient strings use original servings; the quantity column supports scaling.

See `../DEPLOYMENT.md` for HTTPS deployment and database persistence.
