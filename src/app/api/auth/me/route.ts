import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const c = await cookies();
  const studentId = c.get("polyu_student_id")?.value ?? null;
  return NextResponse.json({ ok: true, studentId });
}

