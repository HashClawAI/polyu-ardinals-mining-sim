import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STUDENT_COOKIE_NAME } from "@/lib/constants";

export async function GET() {
  const c = await cookies();
  const studentId = c.get(STUDENT_COOKIE_NAME)?.value ?? null;
  return NextResponse.json({ ok: true, studentId });
}

