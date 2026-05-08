import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudentId } from "@/lib/auth";
import { ensureCurrentEpoch } from "@/lib/epoch";

const Body = z.object({
  payload: z.unknown(),
  salt: z.string().trim().min(8).max(256),
});

export async function POST(req: Request) {
  try {
    const studentId = await requireStudentId();
    const epoch = await ensureCurrentEpoch();
    if (epoch.status !== "reveal") {
      return NextResponse.json({ ok: false, error: "NOT_IN_REVEAL_PHASE" }, { status: 400 });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_REVEAL" }, { status: 400 });
    }

    const reveal = await prisma.reveal.upsert({
      where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
      update: { payload: parsed.data.payload as any, salt: parsed.data.salt, createdAt: new Date() },
      create: {
        epochId: epoch.id,
        userId: studentId,
        payload: parsed.data.payload as any,
        salt: parsed.data.salt,
      },
    });

    return NextResponse.json({ ok: true, reveal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

