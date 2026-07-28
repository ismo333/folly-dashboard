import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const updateSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    const sql = db();
    const rows = await sql.query(
      `UPDATE comments
          SET body = $1, updated_at = now()
        WHERE id = $2 AND profile_id = $3
        RETURNING id`,
      [input.body, id, profile.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Write a comment before saving." }, { status: 400 });
    }
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile();
    const { id } = await params;
    const sql = db();
    const rows = await sql.query(
      "DELETE FROM comments WHERE id = $1 AND profile_id = $2 RETURNING id",
      [id, profile.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
