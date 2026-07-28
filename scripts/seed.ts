import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import seedShows from "../src/data/seed-shows.json";

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL before running npm run db:seed.");
}

const sql = neon(process.env.DATABASE_URL);
const schema = await readFile("db/schema.sql", "utf8");
const statements = schema
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

function externalKey(show: { city: string; title: string; venue: string | null }) {
  return [show.city, show.title, show.venue ?? ""]
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
    .join(":");
}

for (const show of seedShows) {
  await sql.query(
    `INSERT INTO shows (
       external_key, title, tier, venue, status, previews_from, opening, closing,
       writer, director, cast_members, notable_cast, new_writing, synopsis,
       ticket_url, source_url, city
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,$15,$16
     )
     ON CONFLICT (external_key) DO UPDATE SET
       title=EXCLUDED.title,
       tier=EXCLUDED.tier,
       venue=COALESCE(EXCLUDED.venue, shows.venue),
       status=COALESCE(EXCLUDED.status, shows.status),
       previews_from=COALESCE(EXCLUDED.previews_from, shows.previews_from),
       opening=COALESCE(EXCLUDED.opening, shows.opening),
       closing=COALESCE(EXCLUDED.closing, shows.closing),
       writer=COALESCE(EXCLUDED.writer, shows.writer),
       director=COALESCE(EXCLUDED.director, shows.director),
       cast_members=COALESCE(EXCLUDED.cast_members, shows.cast_members),
       notable_cast=COALESCE(shows.notable_cast, EXCLUDED.notable_cast),
       new_writing=COALESCE(EXCLUDED.new_writing, shows.new_writing),
       synopsis=COALESCE(EXCLUDED.synopsis, shows.synopsis),
       ticket_url=COALESCE(EXCLUDED.ticket_url, shows.ticket_url),
       source_url=COALESCE(EXCLUDED.source_url, shows.source_url),
       archived=false`,
    [
      externalKey(show),
      show.title,
      show.tier,
      show.venue,
      show.status,
      show.previews_from,
      show.opening,
      show.closing,
      show.writer,
      show.director,
      show.cast,
      show.new_writing,
      show.synopsis,
      show.ticket_url,
      show.source_url,
      show.city
    ]
  );
}

console.log(`Schema applied and ${seedShows.length} shows seeded.`);
