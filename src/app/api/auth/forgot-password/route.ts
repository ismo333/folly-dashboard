import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashOpaqueToken } from "@/lib/auth";
import {
  isPasswordResetEmailConfigured,
  passwordResetEmail
} from "@/lib/config";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { apiError } from "@/lib/http";

const schema = z.object({
  email: z.email().transform((value) => value.toLowerCase())
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const response = {
      accepted: true,
      emailConfigured: isPasswordResetEmailConfigured
    };
    if (!isPasswordResetEmailConfigured) return NextResponse.json(response);

    const sql = db();
    const profiles = await sql.query(
      "SELECT id, display_name FROM profiles WHERE email = $1 LIMIT 1",
      [input.email]
    );
    if (profiles.length === 0) return NextResponse.json(response);

    const profileId = String(profiles[0].id);
    const recent = await sql.query(
      `SELECT token_hash FROM password_reset_tokens
        WHERE profile_id = $1
          AND created_at > now() - interval '2 minutes'
          AND used_at IS NULL
        LIMIT 1`,
      [profileId]
    );
    if (recent.length > 0) return NextResponse.json(response);

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashOpaqueToken(token);
    await sql.query(
      `DELETE FROM password_reset_tokens
        WHERE profile_id = $1 OR expires_at <= now()`,
      [profileId]
    );
    await sql.query(
      `INSERT INTO password_reset_tokens (token_hash, profile_id, expires_at)
       VALUES ($1, $2, now() + interval '30 minutes')`,
      [tokenHash, profileId]
    );

    const appUrl = passwordResetEmail.appUrl || new URL(request.url).origin;
    const resetUrl = `${appUrl}/?reset=${encodeURIComponent(token)}`;
    try {
      await sendPasswordResetEmail({
        to: input.email,
        displayName: String(profiles[0].display_name),
        resetUrl,
        idempotencyKey: tokenHash
      });
    } catch (error) {
      console.error(error);
      await sql.query("DELETE FROM password_reset_tokens WHERE token_hash = $1", [tokenHash]);
    }
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    return apiError(error);
  }
}
