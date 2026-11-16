import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/config";
import type { Profile } from "@/lib/types";

const sessionCookie = "folly_session";
const sessionDays = 30;
const sessionMaxAge = sessionDays * 86_400;

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(rememberMe: boolean) {
  const expires = new Date(Date.now() + sessionMaxAge * 1000);
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(rememberMe ? { expires, maxAge: sessionMaxAge } : {})
  };
}

export async function createSession(profileId: string, rememberMe = true) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionDays * 86_400_000);
  const sql = db();
  await sql.query(
    `INSERT INTO sessions (profile_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [profileId, hashOpaqueToken(token), expires.toISOString()]
  );
  const jar = await cookies();
  jar.set(sessionCookie, token, sessionCookieOptions(rememberMe));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token && isDatabaseConfigured) {
    const sql = db();
    await sql.query("DELETE FROM sessions WHERE token_hash = $1", [hashOpaqueToken(token)]);
  }
  jar.set(sessionCookie, "", {
    httpOnly: true,
    sameSite: "lax",
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
    [hashOpaqueToken(token)]
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
