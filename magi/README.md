# Magi

Python-based knowledge agent. Runs locally on your machine.

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
/fulcrum/            hermitcrab-mobius kernel (browser, online)
/magi/               YOUR SPACE — python kernel (download, local)
/api/vault.ts        Shared API proxy (httpOnly cookies, CORS-locked)
```

### How routing works
`vercel.json` maps paths. Currently:
```json
{
  "routes": [
    { "src": "/fulcrum", "dest": "/fulcrum/app.html" }
  ]
}
```
Add your route the same way: `{ "src": "/magi", "dest": "/magi/index.html" }` (or whatever your entry point is).

### API proxy
`/api/vault.ts` handles Claude API calls. The kernel sends `{ service: "claude", ...params }` to `/api/vault`. User API keys stored as httpOnly cookies (never visible to JS). CORS allows `idiothuman.com`, `hermitcrab.me`, and `localhost:3000/5173`.

If magi runs locally (not in browser), it doesn't need the vault — it calls Anthropic directly with the user's key.

### The landing page
`index.html` at root links to both `/fulcrum` and `/magi`. Update the magi section when your content is ready. The page is deliberately plain — idiothuman.com filters for people who don't need polish.

### Personality note
Fulcrum is the friendly one — warm, apologetic, patient. Magi has attitude. The URL is the filter.
