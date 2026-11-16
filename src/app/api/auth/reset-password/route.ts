import { NextResponse } from "next/server";
import { z } from "zod";
import { hashOpaqueToken, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(10).max(200)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const tokenHash = hashOpaqueToken(input.token);
    const passwordHash = await hashPassword(input.password);
    const sql = db();
    const rows = await sql.query(
      `WITH consumed AS (
         UPDATE password_reset_tokens
            SET used_at = now()
          WHERE token_hash = $1
            AND used_at IS NULL
            AND expires_at > now()
          RETURNING profile_id
       )
       UPDATE profiles p
          SET password_hash = $2, updated_at = now()
         FROM consumed
        WHERE p.id = consumed.profile_id
       RETURNING p.id`,
      [tokenHash, passwordHash]
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 }
      );
    }
    await sql.query("DELETE FROM sessions WHERE profile_id = $1", [rows[0].id]);
    return NextResponse.json({ reset: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Use a password of at least 10 characters." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
