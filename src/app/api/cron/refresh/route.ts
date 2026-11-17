import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/http";
import { refreshListings } from "@/lib/refresh";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>", so only Vercel can trigger it.
function isAuthorised(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  try {
    const summary = await refreshListings(null);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof Error && error.message === "REFRESH_IN_PROGRESS") {
      return NextResponse.json({ skipped: "A refresh is already running." });
    }
    return apiError(error);
  }
}
