import { readFile, mkdir, writeFile } from "node:fs/promises";

const source = await readFile("whats-on-dashboard.html", "utf8");
const match = source.match(/const DATA = (\[[\s\S]*?\]);\s*const TIERS/);

if (!match) {
  throw new Error("Could not find the embedded DATA array.");
}

const shows = JSON.parse(match[1]);
await mkdir("src/data", { recursive: true });
await writeFile("src/data/seed-shows.json", `${JSON.stringify(shows, null, 2)}\n`);
console.log(`Extracted ${shows.length} shows to src/data/seed-shows.json`);
