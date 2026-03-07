# Family Calendar — Claude Code Instructions

## Project
- **Stack**: Next.js 16, React 19, Neon Postgres, Vercel Blob, Tailwind v4, TypeScript
- **Node**: use `/Users/tylerstauss/.nvm/versions/node/v20.20.0/bin/node`
- **Run tsc**: `node ./node_modules/.bin/tsc --noEmit`
- **Build**: `export PATH="/Users/tylerstauss/.nvm/versions/node/v20.20.0/bin:$PATH" && node ./node_modules/.bin/next build`

## Key conventions
- All API routes use `requireAuth(req)` from `src/lib/auth.ts` and scope SQL by `family_id`
- DB client: `sql` tagged-template from `src/lib/db.ts` — `const [row] = await sql\`...\`` pattern
- IDs: use `newId()` from `src/lib/db.ts`
- Timestamps: store as ISO strings via `NOW()::TEXT`
- Admin check: use `requireAdmin(req)` from `src/lib/auth.ts`

## Database
- Neon Postgres via `@neondatabase/serverless`
- `COUNT(*)` returns bigint as string — use `parseInt(row.count as string, 10)`
- Date comparisons: `LEFT(start_time, 10)` for ISO string date matching
- Setup script: `scripts/setup-db.ts`

## Deployment
- Hosted at: `https://familycalendar-eta.vercel.app`
- Auto-deploys from `main` branch via Vercel
- Always run `tsc --noEmit` before committing

## Scripts
- `scripts/setup-db.ts` — one-time table creation
- `scripts/add-subscriptions.ts` — subscription migration (already run)
- Load env for scripts: `export $(grep -v '^#' .env.local | xargs)`
