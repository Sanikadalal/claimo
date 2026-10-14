# Claimo

Claimo turns your Uber and Rapido receipt emails into a reimbursement-ready PDF report.

Connect Gmail with read-only access, pick a date range, review the rides it found, and download a PDF with every ride, per-provider totals and the amount to claim.

## Features

- **Gmail integration**: Google OAuth 2.0 with the `gmail.readonly` scope. Claimo only searches mail from Uber and Rapido and never stores email content.
- **Receipt parsing**: pulls the fare, ride type, pickup, drop and ride ID out of HTML receipt emails. Uber Eats orders and promotional mail from the same senders are skipped.
- **Duplicate detection**: a receipt is flagged as a duplicate if it has the same ride ID as an earlier one, or the same provider and fare within 10 minutes (resent or forwarded receipts).
- **PDF reports**: A4 report with a summary, per-provider totals and an itemised ride table that continues across pages. Built with `pdf-lib`.
- **Safe totals**: amounts are stored in paise (integers) so totals never drift from floating point rounding.

## How it works

```
Browser ──► /api/auth/login ──► Google consent ──► /api/auth/callback
                                                      │  tokens encrypted (A256GCM) into an httpOnly cookie
Browser ──► /api/receipts?from&to
              │ Gmail search: from:(uber.com OR rapido.bike OR rapido.in) after:… before:…
              │ fetch messages, 8 in parallel, up to 300 per search
              │ parse each email → Receipt | null
              └ mark duplicates → JSON
Browser ──► /api/report (selected message ids)
              └ re-reads receipts from Gmail (never trusts amounts sent by the browser) → PDF
```

| Path | Purpose |
| --- | --- |
| `src/lib/parsers/` | Uber and Rapido parsers, HTML-to-text, amount parsing |
| `src/lib/dedupe.ts` | Duplicate detection and totals |
| `src/lib/gmail.ts` | OAuth, token refresh, Gmail search and fetch |
| `src/lib/report.ts` | PDF generation |
| `src/lib/session.ts` | Encrypted session cookie |
| `test/` | Unit tests and sample receipt emails |

## Tech stack

Next.js (App Router), TypeScript, Gmail API, OAuth 2.0, jose, pdf-lib, Zod, Tailwind CSS, Vitest

## Running locally

1. Create an OAuth client (type: Web application) in Google Cloud Console, enable the Gmail API, and add `http://localhost:3000/api/auth/callback` as a redirect URI.
2. Copy `.env.example` to `.env.local` and fill in the values.
3. Install and run:

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
```

18 tests cover amount parsing, both receipt parsers, filtering of non-ride mail, duplicate detection and PDF generation.

## Limitations

- The parsers are written against current Uber and Rapido receipt layouts. If a provider changes its email format, the parser for it needs updating.
- Only Uber and Rapido are supported right now.
