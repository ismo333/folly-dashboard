import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashOpaqueToken } from "@/lib/auth";
import { emailSettings, isEmailConfigured } from "@/lib/config";
import { db } from "@/lib/db";
import { sendSignInEmail } from "@/lib/email";
import { apiError } from "@/lib/http";

const LINK_MINUTES = 15;

const schema = z.object({
  mode: z.enum(["sign-in", "join"]),
  email: z.email().transform((value) => value.toLowerCase()),
  displayName: z.string().trim().max(80).optional(),
  rememberMe: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const devMode = process.env.NODE_ENV !== "production";
    if (!isEmailConfigured && !devMode) {
      return NextResponse.json(
        { error: "Email sign-in isn’t set up yet. Please contact a Folly owner." },
        { status: 503 }
      );
    }

    const sql = db();
    const profiles = await sql.query(
      "SELECT display_name FROM profiles WHERE email = $1 LIMIT 1",
      [input.email]
    );
    const existingName = profiles.length > 0 ? String(profiles[0].display_name) : "";

    if (!existingName && input.mode === "sign-in") {
      return NextResponse.json(
        { error: "We don’t have an account for that email yet. Choose “New here” to join." },
        { status: 404 }
      );
    }
    const newName = input.displayName ?? "";
    if (!existingName && newName.length < 2) {
      return NextResponse.json({ error: "Add your name so reviewers know who you are." }, { status: 400 });
    }

    // Don't send a second email if one went out moments ago.
    const recent = await sql.query(
      `SELECT 1 FROM login_tokens
        WHERE email = $1
          AND used_at IS NULL
          AND created_at > now() - interval '1 minute'
        LIMIT 1`,
      [input.email]
    );
    if (recent.length > 0) return NextResponse.json({ sent: true });

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashOpaqueToken(token);
    await sql.query(
      "DELETE FROM login_tokens WHERE email = $1 OR expires_at <= now()",
      [input.email]
    );
    await sql.query(
      `INSERT INTO login_tokens (token_hash, email, display_name, remember_me, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
      [tokenHash, input.email, existingName ? null : newName, input.rememberMe, LINK_MINUTES]
    );

    const appUrl = emailSettings.appUrl || new URL(request.url).origin;
    const signInUrl = `${appUrl}/?login=${encodeURIComponent(token)}`;

    if (!isEmailConfigured) {
      // Local development without Resend: hand the link back instead of emailing it.
      console.log(`Sign-in link for ${input.email}: ${signInUrl}`);
      return NextResponse.json({ sent: true, devLink: signInUrl });
    }

    try {
      await sendSignInEmail({
        to: input.email,
        displayName: existingName || newName,
        signInUrl,
        idempotencyKey: tokenHash
      });
    } catch (error) {
      console.error(error);
      await sql.query("DELETE FROM login_tokens WHERE token_hash = $1", [tokenHash]);
      return NextResponse.json(
        { error: "We couldn’t send the email just now. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    return apiError(error);
  }
}
