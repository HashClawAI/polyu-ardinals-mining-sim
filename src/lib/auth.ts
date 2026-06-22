import { cookies } from "next/headers";
import { STUDENT_COOKIE_NAME } from "@/lib/constants";

export async function requireStudentId(): Promise<string> {
  const c = await cookies();
  const studentId = c.get(STUDENT_COOKIE_NAME)?.value?.trim();
  if (!studentId) throw new Error("UNAUTHENTICATED");
  return studentId;
}

export async function setStudentIdCookie(studentId: string) {
  const c = await cookies();
  c.set(STUDENT_COOKIE_NAME, studentId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearStudentIdCookie() {
  const c = await cookies();
  c.set(STUDENT_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

