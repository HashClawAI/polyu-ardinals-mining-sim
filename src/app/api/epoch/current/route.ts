import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentEpoch, ensureAssignment } from "@/lib/epoch";
import { requireStudentId } from "@/lib/auth";

export async function GET() {
  try {
    const studentId = await requireStudentId();
    const epoch = await ensureCurrentEpoch();
    const assignment = await ensureAssignment(epoch.id, studentId);

    const questions = await prisma.question.findMany({
      where: { id: { in: assignment.questionIds } },
      select: {
        id: true,
        type: true,
        prompt: true,
        options: true,
        tags: true,
        difficulty: true,
      },
    });

    return NextResponse.json({
      ok: true,
      epoch: {
        id: epoch.id,
        status: epoch.status,
        commitEndsAt: epoch.commitEndsAt,
        revealEndsAt: epoch.revealEndsAt,
        drandRound: epoch.drandRound,
        drandRandomness: epoch.drandRandomness,
      },
      assignment: { questionIds: assignment.questionIds },
      questions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

