import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  id: z.string().min(1),
  active: z.boolean(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const q = await prisma.question.update({
      where: { id: parsed.data.id },
      data: { active: parsed.data.active },
      select: { id: true, active: true },
    });

    return NextResponse.json({ ok: true, question: q });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

