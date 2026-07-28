import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { ownerEmails } from "@/lib/config";
import { hashInviteCode } from "@/lib/crypto";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(2).max(80),
  inviteCode: z.string().max(100).default("")
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const sql = db();
    const isOwner = ownerEmails().has(input.email);
    if (!isOwner) {
      const invite = await sql.query(
        "SELECT code_hash FROM invite_settings WHERE id = true"
      );
      if (invite.length === 0 || invite[0].code_hash !== hashInviteCode(input.inviteCode)) {
        return NextResponse.json({ error: "That invite code is not valid." }, { status: 403 });
      }
    }
    const passwordHash = await hashPassword(input.password);
    const rows = await sql.query(
      `INSERT INTO profiles (email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [input.email, input.displayName, passwordHash, isOwner ? "owner" : "reviewer"]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }
    await createSession(String(rows[0].id));
    return NextResponse.json({ signedIn: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Use a valid email, name, and password of at least 10 characters." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
