# Folly — What’s On

A private, shared theatre listings and review notebook for Folly Productions.

## What it includes

- New York and London listings with exact preview, opening, and closing dates
- Date-range, city, tier, new-writing, and text filters
- Personal favourites and closing-soon ordering
- A past-show filter with archived productions still open for visits and reviews
- On-demand refresh against the nine existing listing sources
- Passwordless sign-in: people enter their email and click the link we send them
- Multiple dated visits and reviews per person and show
- Comments on public reviews
- Owner-only reviews visible only to Isobel and Zsuzsa
- Notable-cast and acclaimed-writer fields

## Local preview

The interface runs without credentials using the migrated listings in preview mode:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Neon setup

1. Create a free Neon project.
2. Run `db/schema.sql` in the Neon SQL editor, or copy `.env.example` to
   `.env.local`, fill in `DATABASE_URL`, and run:

   ```bash
   npm run db:seed
   ```

3. Add the remaining values from `.env.example` to `.env.local`.
4. Put Isobel and Zsuzsa’s email addresses in `OWNER_EMAILS`. Their profiles are
   promoted to owners automatically after they sign up.
5. Verify a sending domain with Resend, then set `RESEND_API_KEY`, `EMAIL_FROM`,
   and the deployed `APP_URL`. **Sign-in depends on this** — without it nobody
   can get a sign-in link on the live site.

Sign-in links expire after 15 minutes and work once. Anyone can create an
account with “New here” (the invite code is switched off for now). Locally,
without Resend, the sign-in link is shown on screen and printed in the terminal.

After pulling a version with schema changes, apply them without reseeding shows:

```bash
npm run db:migrate
```

## Refresh behavior

The refresh button checks the same Playbill, Soho Rep, The Tank, Royal Court,
and Bush Theatre sources used by the original dashboard. It:

- adds newly discovered productions when the source provides enough identity data;
- updates dates, venues, credits, and links only when a source provides a value;
- never replaces useful information with a blank value;
- reconfirms matched listings with a verification timestamp;
- archives shows whose known closing date has passed; and
- reports partial source failures without discarding existing data.

Refreshes have a five-minute concurrency guard and run in parallel to stay within
Vercel’s function duration.

Listings also refresh automatically once a day at 09:00 UTC (4–5am New York,
9–10am London) through Vercel Cron, configured in `vercel.json`. It calls
`/api/cron/refresh`, which only runs when Vercel sends the `CRON_SECRET`
environment variable, so set `CRON_SECRET` in Vercel to any long random string.
