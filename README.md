# Folly — What’s On

A private, shared theatre listings and review notebook for Folly Productions.

## What it includes

- New York and London listings with exact preview, opening, and closing dates
- Date-range, city, tier, new-writing, and text filters
- On-demand refresh against the nine existing listing sources
- Individual reviewer accounts activated with an owner-controlled invite code
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
5. Sign in as an owner and use **Invite reviewers** to generate the first shared
   invite code.

The invite code is hashed before it is stored. Changing it invalidates the old
code without removing any existing reviewer accounts.

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
