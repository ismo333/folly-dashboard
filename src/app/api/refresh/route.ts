import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { refreshListings } from "@/lib/refresh";

export const maxDuration = 60;

export async function POST() {
  try {
    const profile = await requireProfile();
    const summary = await refreshListings(profile);
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof Error && error.message === "REFRESH_IN_PROGRESS") {
      return NextResponse.json(
        { error: "A refresh is already running. Try again in a few minutes." },
        { status: 409 }
      );
    }
    return apiError(error);
  }
}
