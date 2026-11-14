# Solumbra dashboard

A private, single user web dashboard for a small agency. It reads money from a
Google Sheet, the pipeline from ClickUp or a sheet tab, and optionally Cal.com,
Instantly, Vollna, Stripe and Beehiiv. Next.js 15 App Router, React 19, TypeScript
strict, Recharts, no Tailwind, no database. One password, one signed cookie.

The person using this is often **not a programmer**. Write to them in plain
words: no jargon, no idioms, one idea per sentence, name a tool and say what it
is the first time. Prefer numbered steps. Never print a key or a token; show the
first four characters at most.

## Helping someone set it up

`npm run setup` is interactive and cannot run inside an agent's shell. Do the
same thing in conversation instead:

1. Ask the questions in the order `scripts/setup.ts` asks them: business name, timezone, currency; Google service account JSON (path to the file); the P&L sheet link; where the dashboard tabs go; the pipeline (ClickUp list, Pipeline tab, or none); Cal.com, Instantly, Vollna, Stripe keys; channels; password. `docs/keys.md` has the click path for every key, paste the relevant steps when they ask.
2. Read the JSON file yourself and write the values to `.env.local` with `saveEnv` from `scripts/env.ts` (a five line `tsx` snippet), or edit the file directly. The JSON goes on one line inside single quotes. Never echo it back.
3. `npm run setup -- --sheets` makes the missing tabs. `npm run check` reads every tool and prints what came back. Fix what failed, then `npm run dev`.
4. For the web: `vercel login` (they do it), then `npm run deploy`.

If they only want to look: `npm run demo`.

## Commands

`npm run dev`, `npm run demo`, `npm run setup`, `npm run check`, `npm run deploy`,
`npm test`, `npm run typecheck`, `npm run build`. Run `npm test` and
`npm run typecheck` before saying anything is done.

## Where things are

| Path | What |
|---|---|
| `lib/config.ts` | Everything about *this* business, read from env: name, zone, currency, channels, which tools are connected. Shipped inside the data blob so the client never guesses. |
| `lib/sources/*.ts` | One file per tool. Each returns plain rows. `index.ts` runs them side by side; a tool that is not connected answers `off`, a broken one answers `ok: false` with a reason, and the page still renders. |
| `lib/sources/demo.ts` | Made up data for `DEMO=1`. Fictional names only. |
| `lib/stages.ts` | The five stages and `stageOf`, which reads any CRM's status name into them. `channelOf` maps a card's Source onto the configured channels. |
| `lib/metrics.ts` | Every number, computed from rows, no fetching. Tested in `tests/metrics.test.ts`. |
| `lib/period.ts` | Week, month, quarter, all time, custom, with the comparison window. |
| `lib/store.tsx` | One fetch of `/api/data`, held in React context. Period filtering is client side and instant. |
| `app/(dash)/*/page.tsx` | Today, Growth, Money, Cold email, Upwork, Newsletter, Retro. Rebuilt 2026-11-13: few big tiles, and every page scrolls. Today leads with cash, profit, new clients, meetings, then CAC and LTV per channel. Growth shows the whole history by week or month and ignores the period picker. The Pipeline screen was removed (the pipeline is read in the CRM); the stage log is still read for meetings and deals. Retro is read from `RETRO_SHEET_ID` (`lib/sources/retro.ts`, `lib/retro.ts`). |
| `app/api/data` | The blob, cached 5 minutes, `?fresh=1` bypasses. `app/api/manual` writes the Add form. `app/api/hooks/clickup` is the webhook. |
| `components/` | `Tile` ("See details" opens the rows behind it), `Charts` (Recharts, animation off, four checked colours, values written on the marks), `Bits` (Hero, Change, KV, BarList, Notice, Table, RateText), `Shell` (rail, masthead, period picker). |
| `styles/brand.css`, `DESIGN.md` | The visual system. Read `DESIGN.md` before touching any UI. Dark, quiet, one accent color for reference lines only. |
| `scripts/` | `setup.ts`, `check.ts`, `deploy.ts`, `env.ts`, `demo.mjs`. |
| `docs/` | `keys.md` (every key, click by click), `sheets.md` (every tab and column). |

## Rules for the numbers

These are load bearing. Do not relax them for a nicer looking page.

- **Money is counted from the Ledger tab only.** Stripe is a balance line. Revenue in is every `In` row; cash collected is `In` rows marked `Received`; costs are every `Out` row, fees included.
- **Sample size rule.** `rate(part, whole, minN)` returns `pct: null` under `minN` and the UI shows "2 of 6". Default 10; cold email reply rates 50 people. Never format a small sample as a percentage.
- **Upwork rates are the one exception,** by his request: `upRate` uses `minN: 1`, so view, reply, conversion and hire rates read as a percentage in every period, week included. The fraction is always printed next to the percentage and the page says "under 50 in this period, so the rates move a lot" while `thin` is true. The five numbers match the ones his proposal tracker shows: view rate `viewed/sent`, reply rate `replies/sent`, conversion rate `replies/viewed`, cost per reply and client acquisition cost, both from connects spent at $0.15.
- **Newsletter** (`lib/sources/beehiiv.ts`, the `newsletter*` functions in `metrics.ts`). Subscriber emails are read on the server only to drop `NEWSLETTER_IGNORE_EMAILS` matches, and are never put in the blob or on screen. Beehiiv gives no unsubscribe date, so unsubscribes are all time only and the weekly chart draws today's subscribers by sign up week. Open and click rate are Beehiiv's totals: a fraction under 10 emails sent, hidden when Beehiiv sends no totals.
- **No cold email open rate**, ever. Instantly's `new_leads_contacted_count` is the people count, never `contacted_count`.
- **CAC and LTV come from the ledger alone** (`unitEconomics`, `clientList`). A client is a name on a Received money in row whose category is one of `CATEGORIES`; a refund under a cost category is not a client. A client belongs to the channel of their first payment. CAC is every Out row on the channel over its clients; combined CAC leaves Overhead out. LTV is cash received per client. On Growth both are "to date" lines.
- **Upwork falls back to the retrospective sheet's daily counts** when the application list is more than 14 days old, and the page says so.
- **The funnel counts first entries.** `firstEntries` in `metrics.ts` takes the earliest date each card reached each stage.
- **Outside benchmarks are labelled** as such when shown; they are never presented as the business's own target.
- Rate limits: Instantly 20 a minute (5 calls per refresh), Vollna 30 a minute (own 15 minute cache; never call its job endpoints, they cost credits), ClickUp 100 a minute.

## Adding a connector for another tool

1. Add a reader in `lib/sources/<tool>.ts` that returns the rows the page needs, using `getJson` from `util.ts` and `env()` for its key. Throw plain language errors that say what to do.
2. If it is a CRM, return `Card[]` with `status: stageOf(rawStatus)`, and either dated `StageEvent[]` or rely on the webhook pattern in `app/api/hooks/clickup`. Look at `pipelineSheet.ts` for the smallest example.
3. Register it in `lib/sources/index.ts` with `when(configured, name, reader)`, add its flag to `connected` in `lib/config.ts`, add a row to `sourceList` in `components/Shell.tsx`, and a question plus a key test to `scripts/setup.ts`. Document the key in `.env.example` and `docs/keys.md`.
4. Add a test with fixture rows. Fictional names only in anything committed.

## Style

- Plain language in every string the person sees. Sentence case. No jargon.
- Charts: colours `C1` to `C4` from `components/Charts.tsx` in that fixed order (blue is money in, orange is money out), animation off, 3px lines with dots, values written on the bars when there is room, a legend for two or more series. Never two y scales. See `DESIGN.md`, "Data display".
- Text is 14 to 15px, hero numbers 36 to 52px, charts 280 to 340px tall. Pages scroll; do not shrink things to fit one screen. Check 1440 wide and 390 wide with a screenshot before calling a layout done.
- Nothing personal in the repo: no real client names, no keys, no screenshots of real numbers. `tests/screenshots`, `.env*`, `public/logo.png` and `app/icon.png` are git ignored on purpose.
