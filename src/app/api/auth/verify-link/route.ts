import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashOpaqueToken } from "@/lib/auth";
import { ownerEmails } from "@/lib/config";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  token: z.string().min(32).max(200)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const sql = db();
    const consumed = await sql.query(
      `UPDATE login_tokens
          SET used_at = now()
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > now()
        RETURNING email, display_name, remember_me`,
      [hashOpaqueToken(input.token)]
    );
    if (consumed.length === 0) {
      return NextResponse.json(
        { error: "This sign-in link has expired or was already used. Request a new one." },
        { status: 400 }
      );
    }

    const email = String(consumed[0].email);
    const role = ownerEmails().has(email) ? "owner" : "reviewer";
    const displayName = consumed[0].display_name
      ? String(consumed[0].display_name)
      : email.split("@")[0];
    // Creates the account on first sign-in; owners listed in OWNER_EMAILS are always owners.
    const profiles = await sql.query(
      `INSERT INTO profiles (email, display_name, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET role = CASE WHEN $3 = 'owner' THEN 'owner' ELSE profiles.role END,
             updated_at = now()
       RETURNING id`,
      [email, displayName, role]
    );

    await createSession(String(profiles[0].id), Boolean(consumed[0].remember_me));
    return NextResponse.json({ signedIn: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "This sign-in link isn’t valid." }, { status: 400 });
    }
    return apiError(error);
  }
}
