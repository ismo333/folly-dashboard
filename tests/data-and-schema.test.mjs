import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shows = JSON.parse(await readFile("src/data/seed-shows.json", "utf8"));
const schema = await readFile("db/schema.sql", "utf8");

test("all legacy listings were migrated", () => {
  assert.equal(shows.length, 191);
  assert.ok(shows.every((show) => show.title && show.city && show.tier));
  assert.deepEqual(new Set(shows.map((show) => show.city)), new Set(["nyc", "london"]));
});

test("the migrated data retains the nine established sources", () => {
  const sources = new Set(shows.map((show) => show.source_url).filter(Boolean));
  assert.equal(sources.size, 9);
});

test("review privacy and authorship are represented in the database", () => {
  assert.match(schema, /visibility text NOT NULL DEFAULT 'public'/);
  assert.match(schema, /CHECK \(visibility IN \('public', 'owners'\)\)/);
  assert.match(schema, /profile_id uuid NOT NULL REFERENCES profiles/);
  assert.match(schema, /seen_on date NOT NULL/);
});

test("comments are attached to reviews and removed with a deleted review", () => {
  assert.match(schema, /review_id uuid NOT NULL REFERENCES reviews\(id\) ON DELETE CASCADE/);
});
