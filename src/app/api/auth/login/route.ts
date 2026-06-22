import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setStudentIdCookie } from "@/lib/auth";

const Body = z.object({
  studentId: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_STUDENT_ID" }, { status: 400 });
  }

  const studentId = parsed.data.studentId;
  await prisma.user.upsert({
    where: { id: studentId },
    update: {},
    create: { id: studentId },
  });

  await setStudentIdCookie(studentId);
  return NextResponse.json({ ok: true, studentId });
}

