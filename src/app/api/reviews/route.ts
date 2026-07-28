import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const reviewSchema = z.object({
  showId: z.string().uuid(),
  seenOn: z.iso.date(),
  rating: z.number().int().min(1).max(5).nullable(),
  body: z.string().trim().max(5000),
  visibility: z.enum(["public", "owners"])
});

export async function POST(request: Request) {
  try {
    const profile = await requireProfile();
    const input = reviewSchema.parse(await request.json());
    if (input.visibility === "owners" && profile.role !== "owner") {
      return NextResponse.json({ error: "Only owners can create private reviews." }, { status: 403 });
    }
    const sql = db();
    const rows = await sql.query(
      `INSERT INTO reviews (show_id, profile_id, seen_on, rating, body, visibility)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.showId,
        profile.id,
        input.seenOn,
        input.rating,
        input.body,
        input.visibility
      ]
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the visit date, rating, and review." }, { status: 400 });
    }
    return apiError(error);
  }
}
