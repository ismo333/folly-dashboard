import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCode, hashInviteCode } from "@/lib/crypto";
import { apiError } from "@/lib/http";

const inputSchema = z.object({
  code: z.string().trim().min(8).max(100).optional()
});

export async function PUT(request: Request) {
  try {
    const owner = await requireOwner();
    const input = inputSchema.parse(await request.json());
    const code = input.code || generateInviteCode();
    const sql = db();
    await sql.query(
      `INSERT INTO invite_settings (id, code_hash, updated_by, updated_at)
       VALUES (true, $1, $2, now())
       ON CONFLICT (id) DO UPDATE
         SET code_hash = EXCLUDED.code_hash,
             updated_by = EXCLUDED.updated_by,
             updated_at = now()`,
      [hashInviteCode(code), owner.id]
    );
    return NextResponse.json({ code });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Use at least eight characters." }, { status: 400 });
    }
    return apiError(error);
  }
}
