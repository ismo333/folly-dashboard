import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const updateSchema = z.object({
  notableCast: z.string().trim().max(2000),
  writerAcclaim: z.string().trim().max(2000)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const rows = await sql.query(
      `UPDATE shows
          SET notable_cast = NULLIF($1, ''),
              writer_acclaim = NULLIF($2, ''),
              updated_at = now()
        WHERE id = $3
        RETURNING id`,
      [input.notableCast, input.writerAcclaim, id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Those notes are too long." }, { status: 400 });
    }
    return apiError(error);
  }
}
