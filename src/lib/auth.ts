import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/config";
import type { Profile } from "@/lib/types";

const scrypt = promisify(scryptCallback);
const sessionCookie = "folly_session";
const sessionDays = 30;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(profileId: string, rememberMe = true) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionDays * 86_400_000);
  const sql = db();
  await sql.query(
    `INSERT INTO sessions (profile_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [profileId, hashToken(token), expires.toISOString()]
  );
  const jar = await cookies();
  jar.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(rememberMe ? { expires } : {})
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && isDatabaseConfigured) {
    const sql = db();
    await sql.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  }
  jar.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
}

export async function currentProfile(): Promise<Profile | null> {
  if (!isDatabaseConfigured) return null;
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const sql = db();
  const rows = await sql.query(
    `SELECT p.id, p.email, p.display_name, p.role
       FROM sessions s
       JOIN profiles p ON p.id = s.profile_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
      LIMIT 1`,
    [hashToken(token)]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: String(row.display_name),
    role: row.role as Profile["role"]
  };
}

export async function requireProfile() {
  const profile = await currentProfile();
  if (!profile) throw new Error("AUTH_REQUIRED");
  return profile;
}

export async function requireOwner() {
  const profile = await requireProfile();
  if (profile.role !== "owner") throw new Error("OWNER_REQUIRED");
  return profile;
}
