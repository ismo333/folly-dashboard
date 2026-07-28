import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

const schema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const sql = db();
    const rows = await sql.query(
      "SELECT id, password_hash FROM profiles WHERE email = $1",
      [input.email]
    );
    const valid = rows.length > 0 &&
      await verifyPassword(input.password, String(rows[0].password_hash));
    if (!valid) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    await createSession(String(rows[0].id));
    return NextResponse.json({ signedIn: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }
    return apiError(error);
  }
}
