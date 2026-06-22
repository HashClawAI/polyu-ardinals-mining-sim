import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudentId } from "@/lib/auth";
import { ensureCurrentEpoch } from "@/lib/epoch";

const Body = z.object({
  commitHash: z.string().trim().min(32).max(128).regex(/^[a-fA-F0-9]+$/),
});

export async function POST(req: Request) {
  try {
    const studentId = await requireStudentId();
    const epoch = await ensureCurrentEpoch();
    if (epoch.status !== "commit") {
      return NextResponse.json({ ok: false, error: "NOT_IN_COMMIT_PHASE" }, { status: 400 });
    }

    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_COMMIT" }, { status: 400 });
    }

    const commit = await prisma.commit.upsert({
      where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
      update: { commitHash: parsed.data.commitHash, submittedAt: new Date() },
      create: {
        epochId: epoch.id,
        userId: studentId,
        commitHash: parsed.data.commitHash,
      },
    });

    return NextResponse.json({ ok: true, commit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

