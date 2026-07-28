import { NextResponse } from "next/server";
import { z } from "zod";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const commentSchema = z.object({
  reviewId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000)
});

export async function POST(request: Request) {
  try {
    const profile = await requireProfile();
    const input = commentSchema.parse(await request.json());
    const sql = db();
    const review = await sql.query(
      "SELECT visibility FROM reviews WHERE id = $1",
      [input.reviewId]
    );
    if (review.length === 0) {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    if (review[0].visibility === "owners" && profile.role !== "owner") {
      return NextResponse.json({ error: "Owner access is required." }, { status: 403 });
    }
    const rows = await sql.query(
      `INSERT INTO comments (review_id, profile_id, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.reviewId, profile.id, input.body]
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Write a comment before posting." }, { status: 400 });
    }
    return apiError(error);
  }
}
