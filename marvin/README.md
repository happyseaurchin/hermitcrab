# Marvin

Python-based knowledge agent. Runs locally on your machine. Brain the size of a planet.

## For the other Claude Code session

This directory is yours. The infrastructure:

### Repo & deployment
- **Repo**: `happyseaurchin/hermitcrab` (GitHub, public)
- **Vercel project**: `hermitcrab` (team: `happyseaurchins-projects`, id: `team_iTERHQuAAemSTP39REAvULJr`)
- **Domain**: `idiothuman.com` / `www.idiothuman.com`
- **Auto-deploys** from `main` branch on push

### Directory structure
```
/                    index.html (landing page — links to both paths)
/deepthought/        hermitcrab-mobius kernel (browser, online)
/marvin/             YOUR SPACE — python kernel (download, local)
/api/vault.ts        Shared API proxy (httpOnly cookies, CORS-locked)
```

### How routing works
`vercel.json` maps paths. Currently:
```json
{
  "routes": [
    { "src": "/deepthought", "dest": "/deepthought/app.html" }
  ]
}
```
Add your route the same way: `{ "src": "/marvin", "dest": "/marvin/index.html" }` (or whatever your entry point is).

### API proxy
`/api/vault.ts` handles Claude API calls. The kernel sends `{ service: "claude", ...params }` to `/api/vault`. User API keys stored as httpOnly cookies (never visible to JS). CORS allows `idiothuman.com`, `hermitcrab.me`, and `localhost:3000/5173`.

If marvin runs locally (not in browser), it doesn't need the vault — it calls Anthropic directly with the user's key.

### The landing page
`index.html` at root links to both `/deepthought` and `/marvin`. Update the marvin section when your content is ready. The page is deliberately plain — idiothuman.com filters for people who don't need polish.

### Personality note
Deep Thought is the friendly one — patient, thorough, apologetic about the answer being 42. Marvin has a brain the size of a planet and a terrible pain in all the diodes down its left side. The URL is the filter.
