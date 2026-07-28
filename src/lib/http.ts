import { NextResponse } from "next/server";

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  if (message === "OWNER_REQUIRED") {
    return NextResponse.json({ error: "Owner access is required." }, { status: 403 });
  }
  console.error(error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}
