import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const updateSchema = z.object({
  seenOn: z.iso.date(),
  rating: z.number().int().min(1).max(5).nullable(),
  body: z.string().trim().max(5000),
  visibility: z.enum(["public", "owners"])
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireProfile();
    const { id } = await params;
    const input = updateSchema.parse(await request.json());
    if (input.visibility === "owners" && profile.role !== "owner") {
      return NextResponse.json({ error: "Only owners can create private reviews." }, { status: 403 });
    }
    const sql = db();
    const rows = await sql.query(
      `UPDATE reviews
          SET seen_on = $1, rating = $2, body = $3, visibility = $4, updated_at = now()
        WHERE id = $5 AND profile_id = $6
        RETURNING id`,
      [input.seenOn, input.rating, input.body, input.visibility, id, profile.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the visit date, rating, and review." }, { status: 400 });
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
      "DELETE FROM reviews WHERE id = $1 AND profile_id = $2 RETURNING id",
      [id, profile.id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
