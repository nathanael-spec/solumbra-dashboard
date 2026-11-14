# The sheet tabs

`npm run setup` adds any tab that is missing and writes the headings when a tab
is empty. It never changes rows you already have. Columns are found by their
heading, not by their position, so extra columns and a different order are fine.
Dates are `YYYY-MM-DD` or a real sheet date. Amounts are plain numbers.

## Ledger, the only place money is counted

| Column | What goes in it |
|---|---|
| Date | When the money moved |
| In or Out | Exactly `In` or `Out` |
| Channel | One of your channels (`CHANNELS` in `.env.local`), or `Overhead` for costs about nothing in particular |
| Category | What it was for: Consultation, Build, Maintenance, Software, Payment fee, Education, Domain |
| Who | The client or the vendor. The same spelling every time, LTV counts distinct names |
| Amount | A number, no currency sign needed |
| How paid | Card, bank transfer, PayPal, Upwork, cash |
| Status | `Received` or `Pending` for money in, `Paid` for money out, `Refunded` |
| Notes | Anything |
| Source id | Left empty by hand. Scripts put an id here so nothing is imported twice |

Rules the dashboard follows:

- **Revenue in** is every `In` row in the period, received or pending, the same as a normal P&L.
- **Cash collected** is `In` rows marked `Received` only.
- **Costs out** is every `Out` row. Payment fees are `Out` rows, so profit is net of fees.
- A row whose Channel is not in your list and not `Overhead` is shown as a warning on the Money page and counted nowhere in the channel table.

## Recurring

| Column | What goes in it |
|---|---|
| Item | Google Workspace, Instantly, the course |
| What it is | A few words |
| Monthly | The monthly cost as a number |
| Started | When it began |

This feeds "Fixed cost each month". The actual charges still go in the Ledger.

## Stage log

Written by the ClickUp webhook and the **Add** button. One row per move.

| Column | What goes in it |
|---|---|
| At | ISO timestamp |
| Task id | The CRM's id, or `manual-…` |
| Task | The card's name |
| From | Previous stage |
| To | New stage: intake, meeting booked, proposal sent, closed won, closed lost |
| How | `webhook`, `manual, source X, value N`, or a backfill note |

The funnel counts the **first** time each card reached each stage. Moving a
card back and forward again does not count it twice.

## Pipeline, only when the pipeline lives in the sheet

One row per lead.

| Column | What goes in it |
|---|---|
| Name | The person, and the company if you like |
| Company | |
| Stage | Free text. "Call booked", "Proposal out", "Won", "Lost" |
| Source | How they found you. Mapped onto your channels |
| Deal value | A number |
| Due date | Your next follow up. Shows under "Waiting on you" once it passes |
| Link | Anything, a Notion page, a Drive folder |
| Meeting booked on | Date. **This is what counts a meeting** |
| Proposal sent on | Date. **This is what counts a proposal** |
| Closed on | Date. Counts a win or a loss depending on Stage |
| Created on | Date, optional |
| Notes | |

## Notes

Free form corrections: Date, What, Value, Why. Shown nowhere yet, kept for
the record.

## Cold email runs

One row per retrospective of a cold email batch: Run, Since, Until, People,
Sent, Bounced, Bounce %, Replies, Human, Positive, Calls, Report. Positive
replies and calls booked are the two numbers Instantly cannot know, which is
why they are typed in by hand.

## Retrospective sheet (optional, RETRO_SHEET_ID)

Turns on the Retro screen. Two tabs, read only by the dashboard:

- **Daily**: row 1 is headings, then one row per day. Column A is the date. Columns are found
  by heading, any order: Upwork apps sent, Upwork viewed, Upwork replied, Upwork offers sent,
  Upwork hired, Emails sent, Email replies (people), Email positive replies, Meetings booked,
  Signed, Emails bounced, LinkedIn posts, LinkedIn impressions, Posts with a view count,
  New connections accepted, Followers (total that day), Connections (total that day).
  Leave a cell empty when the number is unknown.
- **Retros**: row 1 is headings (Retro, Start, End, Prev start, Prev end, Data), then one
  retrospective per row. Column F is the whole write up as JSON, shaped like `RetroRecord`
  in `lib/types.ts`.
