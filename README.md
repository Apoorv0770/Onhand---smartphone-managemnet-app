# Onhand

**Your inventory. Always within reach.**

Onhand gives independent second-hand smartphone retailers in India a private dashboard to manage their stock and a
public, shareable storefront that customers can search and filter, so they stop asking "is it available?" on calls
and in DMs. Every retailer gets their own storefront at `/shop/<their-address>`. It is not a marketplace: a customer
only ever sees one shop's phones.

"Onhand" is a working name. It lives in one file, [src/lib/site.ts](src/lib/site.ts).

## Status at a glance

| Area | State |
| --- | --- |
| Marketing site, customer storefront, retailer dashboard, auth, onboarding | Built and working |
| Demo mode (local, persistent data, no setup) | Working. This is how the app runs out of the box |
| Supabase mode (Postgres, Auth, Storage) | Working. Run end to end against a live Supabase project on 16 Nov 2026 with two retailers: see "Checked against a live Supabase project". **Email flows (confirmation, password reset) were not exercised** |
| Automated tests | 122 passing: 24 for the demo data layer, 77 for the Supabase SQL and policies, 21 for the configuration guards |
| Lint, type check, production build | Clean |

## Quick start

Requires Node.js 20.9 or newer (developed on Node 25).

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, the app runs in **demo mode**: it creates
`./.data/db.json` on the first request, seeded with three fictional retailers, and keeps everything you do
(accounts, shops, devices, uploaded photos) on disk between restarts.

Things to try first:

- http://localhost:3000 for the marketing site
- http://localhost:3000/shop/urban-mobile-studio for a live demo storefront, no sign-in needed
- http://localhost:3000/login and tap a demo shop to open its dashboard
- http://localhost:3000/signup to create your own shop through onboarding

## Demo accounts (demo mode only)

The sign-in page lists the three demo retailers. One tap signs you in; the password is applied on the server, so you
never have to type it.

| Shop | Email | Storefront |
| --- | --- | --- |
| Urban Mobile Studio | `urban@demo.onhand.example` | `/shop/urban-mobile-studio` |
| Prime Device Hub | `prime@demo.onhand.example` | `/shop/prime-device-hub` |
| NextWave Mobiles | `nextwave@demo.onhand.example` | `/shop/nextwave-mobiles` |

To sign in by typing, all three use the password `onhand-demo-2026`, or the value of `DEMO_PASSWORD` if you set it
before the demo database was first created.

The shops, their addresses, phone numbers, owners and stock are fictional. Phone numbers use a `555` prefix, which is
not a valid Indian mobile range, and the WhatsApp, call and Instagram buttons on demo storefronts open an explanation
instead of contacting anyone. Run `npm run demo:reset` to restore the original demo data.

## What is in the box

### 1. Marketing site (`/`)

A static landing page: hero with a looping product illustration built from the real UI components, problem and
solution, how it works, features, a live demo storefront embedded in a phone frame, benefits, a cover-style switcher,
onboarding steps, FAQ and a final call to action. It contains no testimonials, statistics, partner logos or pricing,
because none exist yet.

### 2. Customer storefront (`/shop/[shopSlug]`)

- Shop header with logo or monogram, cover style or banner photo, location, live "Open now" status, description,
  WhatsApp, call and Instagram buttons, and share
- Catalog cards: photo or illustration, brand, model, storage, colour, battery health when known, condition,
  availability, and price only when the retailer has made it public
- Search across brand, model, storage, colour and reference, with multi-word queries such as `iphone 14 256`
- Filters: availability, brand, model, storage, price range (only when public prices exist), battery health, condition
  and colour, each showing how many phones it would leave
- Sorting: recently added, price, brand, model, storage, battery health. Phones missing a value sort last and the
  page says so
- Filters and search are reflected in the URL, so a filtered view can be shared. Unrelated query parameters such as
  campaign tags are left untouched
- Device page: photo gallery, facts, condition details, accessories, warranty, reference, shop card, related phones
  and a thumb-reach "Inquire on WhatsApp" button with a prefilled message:
  `Hi, I found the iPhone 14 Pro, 256 GB, Deep Purple on your catalog. Is this specific device still available?`
  followed by the inventory reference and the page link
- Stock refreshes in the background every 45 seconds and when the tab regains focus
- Mobile first: sticky search, brand quick filters, a bottom-sheet filter drawer and large touch targets

When a retailer has not uploaded photos, each phone gets a drawn illustration in its finish colour with a camera
layout matched to its model family. It is labelled as an illustration on the device page. A failed image load falls
back to the same illustration, so a broken image is never shown.

### 3. Retailer dashboard (`/dashboard`)

- Overview: device counts, real storefront visits and WhatsApp inquiry taps for the last 14 days, most asked-about
  phones, recently added, share link with QR code, a setup checklist and recent activity
- Inventory: status tabs, search, brand filter, sorting and pagination. Table on desktop, cards on phones.
  **Mark sold** is a single tap with an undo. Deleting asks first
- Add and edit device: brand, model and colour with suggestions (free text always allowed), storage, condition,
  optional battery health (shown by default only for brands that report it), cosmetic and functional notes,
  accessories, warranty, photos (several at once, resized in the browser, choose the main photo, remove), asking
  price with a "show publicly" switch, availability, a unique inventory reference, date added and internal notes,
  with a live preview of the catalog card
- Storefront settings: logo, name, description, address with live availability check, location, WhatsApp, phone,
  Instagram, cover style or banner, opening hours, default price visibility and whether sold phones stay visible
- Activity log and account settings
- Collapsible sidebar on desktop and a bottom tab bar on phones

### Auth and onboarding

Sign up, sign in, sign out and protected routes work in both modes. Password reset by email exists for Supabase mode
only; demo mode has no email service and says so. Onboarding has five steps: shop details, storefront address, first
phone, a live preview of the real storefront, then share (copy link, WhatsApp, QR code).

## Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Marketing site | Public |
| `/shop/[shopSlug]` | A shop's catalog | Public |
| `/shop/[shopSlug]/[deviceSlug]` | One phone | Public |
| `/login`, `/signup` | Account pages | Public |
| `/forgot-password`, `/reset-password` | Password recovery (Supabase mode) | Public |
| `/auth/confirm` | Handles Supabase email links | Public |
| `/onboarding` | Create a shop | Signed in |
| `/dashboard` | Overview | Signed in, has a shop |
| `/dashboard/inventory` | Inventory list | Signed in, has a shop |
| `/dashboard/inventory/new` | Add a device | Signed in, has a shop |
| `/dashboard/inventory/[deviceId]` | Edit a device | Signed in, has a shop |
| `/dashboard/storefront` | Storefront settings | Signed in, has a shop |
| `/dashboard/activity` | Activity log | Signed in, has a shop |
| `/dashboard/settings` | Account and data storage | Signed in, has a shop |
| `GET /api/public/shops/[slug]` | Public catalog as JSON | Public |
| `POST /api/public/events` | Counts a storefront view or inquiry tap | Public, rate limited |
| `POST /api/uploads` | Image upload | Signed in |
| `GET /media/...` | Serves demo-mode uploads | Public |
| `/robots.txt`, `/sitemap.xml` | SEO | Public |

## Architecture

**Stack.** Next.js 16.4 (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4, Radix UI
primitives with hand-written components in the shadcn style, Lucide icons, Motion, React Hook Form with Zod, Sonner,
Vaul, Supabase client libraries, Vitest.

**One data interface, two drivers.** Everything the app needs from persistence is the `Backend` interface in
[src/server/backend/types.ts](src/server/backend/types.ts). `getBackend()` picks a driver from the environment:

- `local` ([src/server/backend/local](src/server/backend/local)): a JSON file plus an uploads folder under `./.data`.
  Real scrypt password hashing, real server-side sessions in an httpOnly cookie, atomic writes
- `supabase` ([src/server/backend/supabase](src/server/backend/supabase)): Postgres through RPC functions, Supabase
  Auth and Supabase Storage, using only the publishable key

**Tenant isolation.**

- The business a request acts on always comes from the signed-in session (`requireBusiness()` in
  [src/server/session.ts](src/server/session.ts)), never from anything the browser sends. The only identifier a
  client supplies is a device id, and it only resolves inside that business
- Demo mode enforces this in the store: every private operation first checks membership
- Supabase mode enforces it again in the database with Row Level Security on every table. Private functions are
  `SECURITY INVOKER`, so they can never do more than the caller's own policies allow
- `business_members` (roles `owner` and `staff`) is the only link between users and businesses. The MVP creates owners
  only

**Public data is a separate shape.** Storefronts receive `PublicShop` and `PublicDevice`, built in exactly one place,
[src/server/backend/public.ts](src/server/backend/public.ts) (and mirrored by four SQL functions in Supabase mode).
Internal notes, hidden prices, database ids and settings are never copied into them. A hidden price is `null` in the
JSON API, in the server-rendered HTML and in the React payload, not merely hidden with CSS.

**Each physical phone is one record.** There are no quantities. Two identical models are two rows with their own
battery health, condition, price and reference.

**Rendering.** Marketing is fully static. Storefront and dashboard pages prerender a static shell (navigation and
skeletons) and stream live data into it. Stock is never cached across requests. A small proxy
([src/proxy.ts](src/proxy.ts)) turns signed-out visitors away from the dashboard before anything renders, and in
Supabase mode refreshes session tokens.

## Environment variables

Copy [.env.example](.env.example) to `.env.local`. All of them are optional in demo mode.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public origin, used in metadata, share links and auth emails. Default `http://localhost:3000`. On Vercel it can be left out: the project's production address is used |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Setting this and the key switches the app to Supabase mode |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback |
| `ONHAND_SUPABASE_PROJECT_REF` | Optional safety lock: the project ref from the URL (the part before `.supabase.co`). When set, the app refuses to connect to any other Supabase project |
| `DEMO_PASSWORD` | Password for the seeded demo accounts. Applied when the demo database is first created |
| `ONHAND_DATA_DIR` | Where demo mode keeps its data. Default `./.data` |
| `ONHAND_FORCE_DEMO` | Set to `1` to force demo mode whatever else is configured. Meant for automated tests, so they can never reach a real project |
| `ONHAND_DIST_DIR` | Build output folder, default `.next`. Lets a second server run from the same checkout |

No service-role key is used anywhere, and the app refuses to start in Supabase mode if a secret (`sb_secret_...`) or
`service_role` key is put in the publishable-key variable. `.env.local` is ignored by git; keep real values out of
`.env.example`, which is committed.

## Connecting Supabase

> These steps come from the driver and SQL in this repository. The SQL has been executed and tested on a real Postgres
> engine (PGlite, Postgres 18) with stand-ins for Supabase's `auth` and `storage` schemas, and both migration files
> and the seed file were then applied to a fresh hosted project (November 2026) without changes.

`npm run supabase:check` follows these steps for you. It reads `.env.local`, makes a few read-only requests to the
project and reports what is in place and what is still missing: project reachable, key accepted, email confirmation,
schema, table lockdown, storage bucket and demo seed. It never prints a key and never writes to the project.

1. Create a Supabase project (Postgres 15 or newer). A fresh project is safest, because the migration creates
   `public.profiles`.
2. In the SQL editor run, in this order. The files grant every privilege they need and revoke the rest, so they do
   not depend on a project's default grants (projects created since 30 May 2026 no longer expose new tables to the
   Data API by default). Each file can be run again safely; the editor may ask you to confirm the `drop ... if exists`
   statements that make that possible:
   1. [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql): tables, triggers, RLS, grants and functions
   2. [supabase/migrations/0002_storage.sql](supabase/migrations/0002_storage.sql): the public `device-images` bucket
      (6 MB, JPEG, PNG, WebP) and its policies
   3. [supabase/seed.sql](supabase/seed.sql), optional: the three demo retailers as ownerless, read-only storefronts.
      Without it, "Explore live demo" leads to a not-found page
3. Authentication, URL configuration: set the Site URL to your app's origin and add `http://localhost:3000/**` and
   `https://<your-domain>/**` to the redirect URLs.
4. Authentication, email: with "Confirm email" on, new retailers see a "check your inbox" message after sign-up. Turn
   it off to sign in straight away during development.
5. Recommended email templates, so links work on any device:
   - Confirm signup: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
   - Reset password: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
6. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` to `.env.local`,
   and set `ONHAND_SUPABASE_PROJECT_REF` to lock the app to that project. `npm run dev` picks the file up by itself;
   a production build has to be rebuilt, because the `NEXT_PUBLIC_` values are compiled in. Then run
   `npm run supabase:check`.
7. Keep the `private` schema out of the Data API's exposed schemas.

Supabase's security advisor will flag the five `SECURITY DEFINER` functions that are callable through the API (the
four public storefront functions and the address availability check). That is intentional: they return fixed,
public-safe fields.

In Supabase mode the demo retailers have no login. Sign up to create a real, editable shop.

## Deploying for free (Vercel Hobby and Supabase Free)

The app runs on Vercel's free plan with a free Supabase project and a free `*.vercel.app` address. Demo mode cannot
run there, because it keeps its data in local files, so a deployment always uses Supabase mode.

**Before you start**

- Vercel's Hobby plan is for personal, non-commercial use. A demonstration qualifies. Shops selling real phones
  through it, or charging for it, needs the Pro plan.
- Supabase pauses a free project after a week without activity, keeps no backups, and allows 500 MB of database and
  1 GB of files. Opening the site or the Supabase dashboard counts as activity.

**Settings to add in Vercel** (Project Settings, Environment Variables, for all environments)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL, `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key (`sb_publishable_...`). Never a secret key |
| `ONHAND_SUPABASE_PROJECT_REF` | The project ref. Recommended: the app then refuses any other project |

Leave `NEXT_PUBLIC_SITE_URL` out: the address Vercel gives the project is picked up while building. Do not copy
`ONHAND_FORCE_DEMO`, `ONHAND_DIST_DIR`, `ONHAND_DATA_DIR` or `DEMO_PASSWORD` from a local file. If the Supabase
settings are missing, or the site URL points at a local address, the build stops and says so
(see [next.config.ts](next.config.ts)).

**Steps**

1. Put the project on GitHub. A private repository works on the Hobby plan.
2. In Vercel choose Add New, Project, import the repository, add the three settings above and deploy. The framework
   is detected; no build settings need changing.
3. In Supabase, under Authentication, URL Configuration, set the Site URL to the new `https://<name>.vercel.app`
   address and add `https://<name>.vercel.app/**` to the redirect URLs, next to `http://localhost:3000/**`. Sign-up
   and sign-in work without this; links in account emails do not.
4. Check the result: `/robots.txt` should name the `vercel.app` address, a retailer should be able to sign in, and a
   photo upload should appear on the storefront.

**What this setup cannot do**

- A photo passes through a Vercel Function, which accepts at most 4.5 MB per request. Photos are resized in the
  browser first, usually to well under 1 MB, so this only affects files the browser cannot read.
- Functions run in Vercel's default region. Choosing the region nearest the Supabase project (Project Settings,
  Functions) makes pages noticeably faster.
- Rate limiting is per server instance, so on Vercel it is only a light brake.
- Confirmation and password-reset emails still need an SMTP service in Supabase.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | Runs both test suites |
| `npm run test:e2e` | Runs the browser end-to-end tests. See "End-to-end tests" below |
| `npm run typecheck` | Generates route types and type-checks |
| `npm run lint` | ESLint |
| `npm run demo:reset` | Deletes `./.data`. Fresh demo data is created on the next request |
| `npm run supabase:seed` | Regenerates `supabase/seed.sql` from the seed data (needs Node 22.18 or newer) |
| `npm run supabase:check` | Checks the Supabase setup in `.env.local` against the project, read-only, without printing keys |

## Tests and verification

**Automated** (`npm test`, 122 tests):

- [tests/local-store.test.ts](tests/local-store.test.ts), 24 tests on the demo data layer: seed data, sign-up and
  sessions, unique storefront addresses, device create, edit and delete, mark sold, sold-phone visibility, uploads,
  activity, analytics, and tenant isolation. Every private operation is attempted against another retailer's business
  and must be refused, and hidden prices, notes and internal ids must be absent from every public payload
- [tests/supabase-rls.test.ts](tests/supabase-rls.test.ts), 77 tests that load the Supabase migrations into Postgres
  and act as `anon` and as two different signed-in retailers, the way the Supabase API does: cross-tenant reads and
  writes return nothing or are refused, `anon` cannot read any table, the public functions return only public fields,
  and a user cannot add themselves to someone else's business or move a device between tenants
- [tests/env.test.ts](tests/env.test.ts), 21 tests on the configuration guards: demo mode until both the URL and the
  key are set, the project lock refusing any other Supabase project, secret and service-role keys rejected without
  being echoed, `ONHAND_FORCE_DEMO` overriding everything, and the public site address (configured, taken from
  Vercel, or localhost on a developer machine)

**Checked by hand against the running app** (demo mode, development server):

| # | Scenario | Result |
| --- | --- | --- |
| 1 | A new retailer signs up and creates a business | Pass, through the UI |
| 2 | The retailer adds three devices | Pass, through the UI |
| 3 | The public storefront shows exactly those devices | Pass |
| 4 | A customer filters by brand | Pass |
| 5 | A customer filters by storage | Pass |
| 6 | A customer searches for a model | Pass, including multi-word and no-result searches |
| 7 | The retailer marks a device sold with one tap | Pass, with undo |
| 8 | The customer sees the new availability | Pass |
| 9 | The retailer hides a public price | Pass |
| 10 | Public responses do not contain the hidden price | Pass: JSON API, catalog HTML, device HTML and React payload |
| 11 | A customer taps "Inquire on WhatsApp" | Pass: correct `wa.me` number and prefilled message. Demo shops show the message instead |
| 12 | Another retailer cannot read or change the inventory | Pass: direct server-action calls to mark sold, hide the price, edit and delete another shop's device were all refused and the device was unchanged. Signed-out requests are redirected or get 401 |
| 13 | Mobile navigation | Pass: dashboard tab bar, storefront filter drawer and marketing menu |
| 14 | An invalid storefront URL shows a designed not-found page | Pass, see the note on status codes below |

Scenarios 7 to 9 were also exercised from the phone layout. The test shop and account created for these checks were
removed afterwards with `npm run demo:reset`.

**Checked against a live Supabase project** (16 Nov 2026: hosted Postgres, Auth and Storage, publishable key only,
"Confirm email" off, two retailer accounts signed in at the same time, development server plus a smoke test of the
production build):

| Area | Result |
| --- | --- |
| Sign-up, sign-out and sign-in with Supabase Auth; signed-out redirects | Pass. Passwords were typed by a person. Wrong-password and duplicate-email messages were not tried |
| Onboarding and one storefront per retailer | Pass. A second retailer could not take the first one's address, in the form or by calling the server directly |
| Adding devices: 6 brands, 3 storage sizes, with and without battery health, all 4 conditions | Pass, from the onboarding form and the full form, at desktop and phone widths |
| Photos | Pass: JPEG and PNG photos (generated test images) stored in the bucket, shown in the dashboard and on the storefront, and deleted from the bucket when removed from a device |
| Dashboard search, brand filter, 6 sort orders, edit, delete | Pass |
| Mark sold (one tap, with undo), reserved, available | Pass. "Keep sold phones visible" off removes them from the storefront |
| Hide and show a price | Pass: hidden and sold prices are absent from the JSON API, page HTML, React payload, price slider and structured data |
| Storefront search, 8 filter groups, 7 sort orders, shareable filter URLs, device pages | Pass |
| WhatsApp links | Pass: each shop's own number, prefilled message with model, reference and link. Links were checked, not opened |
| Isolation between shops | Pass. Each storefront and its API list only its own devices. With each retailer's real session, every attempt to read, edit, hide, mark sold or delete the other's devices, or attach the other's photo, was refused and nothing changed |
| Anonymous access to the Data API and Storage | Pass: 33 probes with the publishable key. No table, no retailer function, no upload, no listing |
| Persistence | Pass across reloads, a server restart and the production build |
| Storefront settings, profile name, activity log, visit and inquiry counters | Pass |
| Desktop (1280 px) and phone (375 px) layouts | Pass after one fix: the not-found pages scrolled sideways on phones |
| Session refresh | Pass: a dashboard request made after the one-hour access token had expired was served, and the token was replaced with a fresh one |
| Demo seed (`supabase/seed.sql`) | Pass: three demo storefronts with 31 phones, flagged as demo, hidden from search engines, with no private notes or hidden prices in any public response. The two existing retailers were unchanged, and the home page preview shows the demo shop |
| Security headers | Pass: sent on pages, API, redirects and static files; another origin could not frame the app, and the app's own previews still load |

Not exercised live: confirmation and password-reset emails (they need an SMTP service), calling the Data API directly
as a signed-in retailer (covered by the policy tests above, not by this run), running the seed a second time, and real
phone-camera photos such as HEIC.

## End-to-end tests

[e2e/](e2e) holds a Playwright suite that drives a real browser through the 14 scenarios above, once at a desktop
viewport (1280 px wide) and once at a phone viewport (393 px wide, touch). Scenario 13 only exists on the phone,
which makes 31 tests in all. A run takes about a minute on a quiet machine and a few minutes on a busy one.

```bash
npx playwright install chromium   # once: downloads the browser the tests drive
npm run test:e2e
```

The suite never uses a server you started and never touches your data. Each run:

- makes its own production build in `.next-e2e` and serves it on port 3100 (`E2E_PORT` picks another), so it works
  while `npm run dev` is running
- forces demo mode with `ONHAND_FORCE_DEMO`, so it cannot reach a Supabase project even when `.env.local` points at
  one
- keeps its database in a temp folder that is deleted afterwards, instead of `./.data`
- checks all of the above before the first test, and stops if any of it does not hold

Accounts, shops and phone numbers are generated for each run. At each viewport, scenarios 1 and 2 run first and build
the shop that the other scenarios use; if they fail, the rest is reported as not run. A failed test leaves a
screenshot and a trace under `test-results/`, which `npx playwright show-trace <path to trace.zip>` opens.

To use a browser that is already installed instead of downloading one, set `E2E_BROWSER_CHANNEL` to `chrome` or
`msedge`.

Not covered: photo uploads, storefront settings, sign-in and sign-out, the background refresh of an open storefront,
and Supabase mode. The WhatsApp link is checked but never opened.

## Not done yet

- **Parts of Supabase mode are still unverified.** Confirmation and password-reset emails, and the wrong-password and
  duplicate-email messages, have not run against a real project. Everything else is listed under "Checked against a
  live Supabase project"
- **A script content policy.** [next.config.ts](next.config.ts) sends headers that stop other sites framing the app
  (`X-Frame-Options`, `frame-ancestors`), stop content-type guessing, trim the referrer, switch off camera, microphone
  and location, and (in production) require HTTPS for a year. There is no `script-src` policy: a strict one needs a
  fresh nonce per request, which would switch off the prerendered page shells
- **Team members.** The `staff` role exists in the schema and policies, but there is no screen to invite people
- **One shop per account.** Enforced in both drivers
- **Dark mode.** Not built. The design tokens are centralised in [src/app/globals.css](src/app/globals.css), so it is
  a contained piece of work
- **Billing and plans.** None, and no pricing is shown
- **Email in demo mode.** No password reset and no email verification
- **End-to-end tests beyond the 14 scenarios.** The Playwright suite does not cover photo uploads, storefront
  settings, sign-in and sign-out or Supabase mode, and nothing runs it automatically yet
- **Bulk actions and import.** No CSV import or multi-select in the inventory

## Known limitations

- **Demo mode is for local use and demos.** One JSON file on one machine. It will not work on serverless hosting or
  across several instances
- **Invalid storefront links answer with HTTP 200.** The page streams a designed not-found state and a `noindex`
  tag, which is how this version of Next.js behaves once a response has started. The JSON API returns a real 404.
  A true 404 would need a slug lookup in the proxy on every storefront request
- **Analytics are simple.** One view per browser session per shop, inquiry taps counted as taps, no bot filtering and
  an in-memory rate limit. Previews opened from the dashboard are not counted
- **Abandoned uploads are not cleaned up.** A photo uploaded and then never saved stays on disk or in the bucket
- **Images are resized in the browser** to 1600 px before upload. There is no server-side image optimisation or CDN
  resizing, and uploads are capped at 6 MB
- **Phone numbers are India only** (10 digits, starting 6 to 9), and opening hours are shown in India Standard Time
- **Shops with photos expose their business id** as the image folder name in the URL. It grants no access
- **Rate limiting is in memory**, so it resets on restart and is per instance
- **Changing a storefront address breaks old links.** The settings page warns about it; there are no redirects
- **The demo links need the seed in Supabase mode.** "Explore live demo" and the not-found pages link to
  `/shop/urban-mobile-studio`, which only exists after `supabase/seed.sql` has been run
- **A reference number can be reused.** The suggestion is the highest existing number plus one, so deleting the newest
  device frees its number for the next one
- **Deleting an account in Supabase leaves its photos behind.** The database rows cascade; the files in the
  `device-images` bucket do not
- **Illustrations are approximations.** Colours and camera layouts are drawn from the listed model and colour name

## Suggested next steps

1. Before a pilot: connect an SMTP service and turn "Confirm email" back on, test the confirmation and password-reset
   emails, run `supabase/seed.sql` (or remove the demo links), deploy behind HTTPS, and switch on database backups
2. Run the Playwright suite on every change (there is no CI yet), and extend it to photo uploads, storefront settings
   and sign-in
3. Staff accounts: invitations and a members screen on top of the existing `business_members` table
4. Redirects from old storefront addresses, and real 404 responses for unknown shops
5. Inventory import from a spreadsheet, plus bulk mark-sold
6. Image pipeline: server-side variants, cleanup of unused uploads
7. Richer analytics per phone, with bot filtering and a durable rate limit
8. Dark mode and regional languages (Hindi and Marathi would suit the first market)
9. Decide the name, domain and pricing

## Project layout

```
src/
  app/                    Routes: marketing, (auth), onboarding, dashboard, shop, api
  components/
    ui/                   Design-system primitives (buttons, fields, dialogs, drawers ...)
    device/               Device illustration, photo slot, status and battery badges
    storefront/           Catalog, filters, device page, WhatsApp and contact actions
    dashboard/            Shell, inventory list, device form, uploader, storefront form
    marketing/            Landing page pieces
    auth/, onboarding/    Account forms and the onboarding flow
  lib/                    Shared types, validation schemas, formatting, catalog data
  server/
    backend/              Backend interface, local driver, Supabase driver, public mapping
    actions/              Server actions (auth, devices, storefront)
    session.ts            Who is signed in and which business they manage
  proxy.ts                Signed-out redirect and Supabase session refresh
supabase/                 Migrations and demo seed for Supabase mode
tests/                    Vitest suites
scripts/                  Demo reset and seed generation
```
