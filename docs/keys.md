# Every key, click by click

`npm run setup` asks for these one at a time and checks each one against the
real tool before saving it. This page is the same thing on paper.

Every key here is a password. Never paste one into a chat, an email or a
screenshot. They live in `.env.local` on your computer, which git ignores, and
in your own Vercel project.

## Google Sheets, required

A **service account** is a robot Google user with its own email address. You
share your sheet with that address, exactly like sharing with a colleague. It
can read and write spreadsheets shared with it, and nothing else.

1. Go to https://console.cloud.google.com and sign in with your Google account.
2. Top left, click the project name (or "Select a project"), then **New project**. Any name, for example "Dashboard". Click **Create**, then select it.
3. Left menu, **APIs and services**, **Library**. Search "Google Sheets API". Click it, click **Enable**.
4. Left menu, **APIs and services**, **Credentials**. Click **Create credentials**, choose **Service account**. Any name. Click **Create and continue**, then **Done**. Skip the optional steps.
5. In the list, click the account you just made. Open the **Keys** tab. **Add key**, **Create new key**, choose **JSON**, **Create**. A file downloads. Google shows this file once.
6. Copy the robot's email address from the **Details** tab. It ends in `iam.gserviceaccount.com`.
7. Open your Google Sheet, click **Share**, paste that email, set **Editor**, untick "notify", **Share**.

Setup asks for the path of the downloaded file. Drag the file into the
terminal window and press Enter.

If you already have an OAuth refresh token for your own account, limited to the
spreadsheets scope, that works too. Put the client id, client secret and
refresh token in the three `GOOGLE_SHEETS_*` lines instead.

## ClickUp, if your pipeline lives there

1. In ClickUp, click your avatar bottom left, **Settings**.
2. Left menu, **Apps**. Under **API Token**, click **Generate** (or **Regenerate**). Copy the token. It starts with `pk_`.

Setup then lists every list in your workspace so you can pick the pipeline.
It prints the list's statuses and the stage each one counts as. A status
counts as a meeting when its name contains "meeting", "call", "booked" or
"discovery", as a proposal when it contains "proposal", "quote" or "offer",
as won when it contains "won", "signed" or "paid", as lost when it contains
"lost" or "declined". Everything else is intake.

Custom fields are optional and found by name: **Deal value** (or Value,
Amount), **Company**, **Source** (or Channel), **Offer**, **Niche**,
**Proposal link**, **Meeting link**.

The free plan keeps no history of status changes, so `npm run deploy` creates
a webhook: ClickUp calls your dashboard each time a card moves and the move
is written to the **Stage log** tab. Cards moved before that day have no
date, so add them with the **Add** button once.

## Cal.com, optional

1. In Cal.com, **Settings** (bottom left), **Developer**, **API keys**.
2. **Add**, any name, no expiry, **Save**. Copy the key. It starts with `cal_`.

## Instantly, optional

1. In Instantly, **Settings**, **Integrations**, **API keys**.
2. **Create API key**, any name, scopes **all**, **Create**. Copy it. Instantly shows it once.

Setup also asks which timezone your campaign schedules are set in. It is on
each campaign's **Schedule** tab.

## Vollna, optional, for Upwork

Upwork does not show whether a client opened your proposal. Vollna does, and
its API is free for your own proposals.

1. Make an account at https://vollna.com and connect your Upwork profile.
2. **Settings**, **API**. Copy the token.

The dashboard never calls the job search endpoints, which cost credits.

## Stripe, optional, balance only

The dashboard never counts money from Stripe. Money is counted from the
Ledger tab. Stripe is shown as one line: what is available and pending.

1. In Stripe, **Developers**, **API keys**, **Create restricted key**.
2. Name it "Dashboard". Under **Balance** choose **Read**. Leave everything else at **None**. **Create key**. Copy it. It starts with `rk_live_`. Shown once.

## Vercel, to put it on the web

1. Make a free account at https://vercel.com.
2. In the terminal: `npm install -g vercel`, then `vercel login`.
3. `npm run deploy` does the rest and prints the address.
