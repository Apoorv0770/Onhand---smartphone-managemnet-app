<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (Onhand)

Read `README.md` first. The points below are the ones that are easy to get wrong.

- **Cache Components is on.** Pages are a static shell plus streamed data. Anything that reads the session, route
  params, search params, the database or the clock must sit inside a `<Suspense>` boundary. Use `requestNow()` from
  `src/server/clock.ts` for the current time in server components, never `Date.now()` directly.
- **One data interface, two drivers.** All persistence goes through `Backend` in `src/server/backend/types.ts`
  (`getBackend()`). The local JSON driver is the reference behaviour; the Supabase driver must match its results and
  its user-facing error messages. Change both, and both test suites, together.
- **The business always comes from the session.** Server actions call `requireBusiness()` and pass that business id
  to the backend. Never accept a business id from the client.
- **Public data has its own shape.** Storefront code may only receive `PublicShop` and `PublicDevice`, produced in
  `src/server/backend/public.ts` (and by the `get_public_*` / `list_public_*` SQL functions). Internal notes, hidden
  prices and database ids must never be added to them.
- **Each physical phone is one record.** Do not add quantities.
- **Design tokens live in `src/app/globals.css`.** Use the token utilities (`bg-surface`, `text-muted-foreground`,
  `border-border-strong`, `text-brand-strong` ...) rather than raw colours, and reuse `src/components/ui`.
- **The Supabase path was run against a live project on 16 Nov 2026**, for the flows listed in README.md under
  "Checked against a live Supabase project". Email flows were not. Do not describe anything outside that list as
  verified.
- **Supabase configuration is locked and private.** `.env.local` may hold a real project URL and key: never print,
  open or copy it. `supabaseEnv()` in `src/lib/env.ts` refuses any project other than `ONHAND_SUPABASE_PROJECT_REF`,
  rejects secret and service-role keys, and returns demo mode when `ONHAND_FORCE_DEMO=1` (set that for anything
  automated). To inspect the setup, run `npm run supabase:check`: it reports status and never prints a key.
- Checks before finishing: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
