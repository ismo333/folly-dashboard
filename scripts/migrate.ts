import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL before running npm run db:migrate.");
  }

  const sql = neon(process.env.DATABASE_URL);
  const schema = await readFile("db/schema.sql", "utf8");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) await sql.query(statement);
  console.log("Database schema is up to date.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
