import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudentId } from "@/lib/auth";
import { computeCommitHash, ensureAssignment, ensureCurrentEpoch } from "@/lib/epoch";

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

    const result = await prisma.$transaction(async (tx) => {
      // Save reveal
      const reveal = await tx.reveal.upsert({
        where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
        update: { payload: parsed.data.payload as any, salt: parsed.data.salt, createdAt: new Date() },
        create: {
          epochId: epoch.id,
          userId: studentId,
          payload: parsed.data.payload as any,
          salt: parsed.data.salt,
        },
      });

      // Real-time grading + small instant reward (classroom UX)
      const commit = await tx.commit.findUnique({
        where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
      });
      if (!commit) {
        await tx.reveal.update({
          where: { id: reveal.id },
          data: { isValid: false, isCorrect: false, gradedAt: new Date() },
        });
        return { reveal, instantRewarded: false };
      }

      const computed = computeCommitHash({
        studentId,
        payload: parsed.data.payload,
        salt: parsed.data.salt,
      });

      if (computed !== commit.commitHash) {
        await tx.reveal.update({
          where: { id: reveal.id },
          data: { isValid: false, isCorrect: false, gradedAt: new Date() },
        });
        return { reveal, instantRewarded: false };
      }

      const assignment = await ensureAssignment(epoch.id, studentId);
      const qIds = assignment.questionIds ?? [];
      const answers = (parsed.data.payload as any)?.answers as Record<string, unknown> | undefined;

      let allCorrect = true;
      if (!answers) allCorrect = false;
      for (const qId of qIds) {
        const q = await tx.question.findUnique({ where: { id: qId } });
        if (!q) continue;
        const given = answers?.[qId];
        if (String(given ?? "") !== q.answerKey) allCorrect = false;
      }

      await tx.reveal.update({
        where: { id: reveal.id },
        data: { isValid: true, isCorrect: allCorrect, gradedAt: new Date() },
      });

      if (!allCorrect) return { reveal, instantRewarded: false };

      const reason = `epoch:${epoch.id} reveal_correct`;
      const already = await tx.rewardTx.findFirst({
        where: { epochId: epoch.id, userId: studentId, reason },
        select: { id: true },
      });
      if (!already) {
        await tx.rewardTx.create({
          data: {
            epochId: epoch.id,
            userId: studentId,
            amount: 1,
            reason,
          },
        });
        return { reveal, instantRewarded: true };
      }

      return { reveal, instantRewarded: false };
    });

    return NextResponse.json({ ok: true, reveal: result.reveal, instantRewarded: result.instantRewarded });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

