import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStudentId } from "@/lib/auth";
import { pickRandomQuestionIdsForNewAssignment } from "@/lib/appConfig";
import {
  anchorNextBlockForEpochIfNeeded,
  computeCommitHash,
  drawWinnerIndex,
  ensureCurrentEpoch,
  fetchDrandLatest,
  realtimeDrawReason,
} from "@/lib/epoch";

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

      // Real-time grading + realtime draw reward (classroom UX)
      const commit = await tx.commit.findUnique({
        where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
      });
      if (!commit) {
        await tx.reveal.update({
          where: { id: reveal.id },
          data: { isValid: false, isCorrect: false, gradedAt: new Date() },
        });
        return {
          reveal,
          instantRewarded: false,
          drawWinner: null as string | null,
          drawBlockNumber: null as number | null,
          debug: { isValid: false, isCorrect: false, reason: "MISSING_COMMIT" as const },
        };
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
        return {
          reveal,
          instantRewarded: false,
          drawWinner: null as string | null,
          drawBlockNumber: null as number | null,
          debug: { isValid: false, isCorrect: false, reason: "COMMIT_MISMATCH" as const },
        };
      }

      // IMPORTANT: keep everything inside this transaction (avoid global prisma client here)
      let assignment = await tx.assignment.findUnique({
        where: { epochId_userId: { epochId: epoch.id, userId: studentId } },
      });
      if (!assignment) {
        const picked = await pickRandomQuestionIdsForNewAssignment(tx);
        assignment = await tx.assignment.create({
          data: { epochId: epoch.id, userId: studentId, questionIds: picked },
        });
      }
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

      if (!allCorrect)
        return {
          reveal,
          instantRewarded: false,
          drawWinner: null as string | null,
          drawBlockNumber: null as number | null,
          debug: { isValid: true, isCorrect: false, reason: "ANSWER_WRONG" as const },
        };

      // If this epoch already did a realtime draw, don't repeat.
      const drawReason = realtimeDrawReason(epoch.id);
      const existingDraw = await tx.rewardTx.findFirst({
        where: { epochId: epoch.id, reason: drawReason },
        select: { id: true, userId: true },
      });
      if (existingDraw) {
        const drawBlockNumber = await anchorNextBlockForEpochIfNeeded(tx, epoch.id);
        return {
          reveal,
          instantRewarded: existingDraw.userId === studentId,
          drawWinner: existingDraw.userId,
          drawBlockNumber,
          debug: {
            isValid: true,
            isCorrect: true,
            reason: "DRAW_ALREADY_DONE" as const,
            candidatesCount: -1,
          },
        };
      }

      // Fix randomness once (drand) so the draw is reproducible
      const epochFresh = await tx.epoch.findUnique({ where: { id: epoch.id } });
      let randomness = epochFresh?.drandRandomness ?? null;
      if (!randomness) {
        const drand = await fetchDrandLatest();
        randomness = drand.randomness;
        await tx.epoch.update({
          where: { id: epoch.id },
          data: {
            drandRound: drand.round,
            drandRandomness: drand.randomness,
            drandSignature: drand.signature,
            drandBeaconId: "public",
          },
        });
      }

      // Candidates = all valid+correct reveals in this epoch (sorted by userId)
      const candidates = await tx.reveal.findMany({
        where: { epochId: epoch.id, isValid: true, isCorrect: true },
        select: { userId: true },
      });
      const uniqueSorted = Array.from(new Set(candidates.map((c) => c.userId))).sort();
      const idx = drawWinnerIndex({
        randomnessHex: randomness!,
        epochId: epoch.id,
        questionId: "epoch",
        candidatesCount: uniqueSorted.length,
      });
      if (idx === null)
        return {
          reveal,
          instantRewarded: false,
          drawWinner: null as string | null,
          drawBlockNumber: null as number | null,
          debug: {
            isValid: true,
            isCorrect: true,
            reason: "NO_CANDIDATES" as const,
            candidatesCount: uniqueSorted.length,
          },
        };
      const winnerId = uniqueSorted[idx] ?? null;
      if (!winnerId)
        return {
          reveal,
          instantRewarded: false,
          drawWinner: null as string | null,
          drawBlockNumber: null as number | null,
          debug: {
            isValid: true,
            isCorrect: true,
            reason: "NO_WINNER" as const,
            candidatesCount: uniqueSorted.length,
          },
        };

      await tx.rewardTx.create({
        data: {
          epochId: epoch.id,
          userId: winnerId,
          amount: 1,
          reason: drawReason,
        },
      });
      const drawBlockNumber = await anchorNextBlockForEpochIfNeeded(tx, epoch.id);
      return {
        reveal,
        instantRewarded: winnerId === studentId,
        drawWinner: winnerId,
        drawBlockNumber,
        debug: {
          isValid: true,
          isCorrect: true,
          reason: "DRAW_DONE" as const,
          candidatesCount: uniqueSorted.length,
        },
      };
    });

    return NextResponse.json({
      ok: true,
      reveal: result.reveal,
      instantRewarded: result.instantRewarded,
      drawWinner: result.drawWinner,
      drawBlockNumber: result.drawBlockNumber ?? null,
      debug: result.debug,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

