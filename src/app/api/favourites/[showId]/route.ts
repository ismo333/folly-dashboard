import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

type RouteContext = { params: Promise<{ showId: string }> };

export async function PUT(_request: Request, { params }: RouteContext) {
  try {
    const profile = await requireProfile();
    const { showId } = await params;
    const sql = db();
    const rows = await sql.query(
      `INSERT INTO favourites (profile_id, show_id)
       SELECT $1, id FROM shows WHERE id = $2
       ON CONFLICT (profile_id, show_id) DO NOTHING
       RETURNING show_id`,
      [profile.id, showId]
    );
    if (rows.length === 0) {
      const show = await sql.query("SELECT id FROM shows WHERE id = $1", [showId]);
      if (show.length === 0) {
        return NextResponse.json({ error: "Show not found." }, { status: 404 });
      }
    }
    return NextResponse.json({ isFavourite: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const profile = await requireProfile();
    const { showId } = await params;
    const sql = db();
    await sql.query(
      "DELETE FROM favourites WHERE profile_id = $1 AND show_id = $2",
      [profile.id, showId]
    );
    return NextResponse.json({ isFavourite: false });
  } catch (error) {
    return apiError(error);
  }
}
