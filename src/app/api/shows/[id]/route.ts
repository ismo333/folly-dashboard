import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const updateSchema = z.object({
  notableCast: z.string().trim().max(2000).optional(),
  writerAcclaim: z.string().trim().max(2000).optional(),
  previewsFrom: z.iso.date().nullable().optional(),
  opening: z.iso.date().nullable().optional(),
  closing: z.iso.date().nullable().optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const latestStart = [input.previewsFrom, input.opening]
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1);
    if (input.closing && latestStart && input.closing < latestStart) {
      return NextResponse.json({ error: "Closing must be after the run starts." }, { status: 400 });
    }
    const sql = db();
    const rows = await sql.query(
      `UPDATE shows
          SET notable_cast = CASE WHEN $1 THEN NULLIF($2, '') ELSE notable_cast END,
              writer_acclaim = CASE WHEN $3 THEN NULLIF($4, '') ELSE writer_acclaim END,
              previews_from = CASE WHEN $5 THEN $6::date ELSE previews_from END,
              opening = CASE WHEN $7 THEN $8::date ELSE opening END,
              closing = CASE WHEN $9 THEN $10::date ELSE closing END,
              archived = CASE
                WHEN $9 THEN COALESCE($10::date < current_date, false)
                ELSE archived
              END,
              updated_at = now()
        WHERE id = $11
        RETURNING id`,
      [
        input.notableCast !== undefined,
        input.notableCast ?? null,
        input.writerAcclaim !== undefined,
        input.writerAcclaim ?? null,
        input.previewsFrom !== undefined,
        input.previewsFrom ?? null,
        input.opening !== undefined,
        input.opening ?? null,
        input.closing !== undefined,
        input.closing ?? null,
        id
      ]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the listing details and run dates." }, { status: 400 });
    }
    return apiError(error);
  }
}
