import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCurrentEpoch, ensureAssignment, tickAndSettle, realtimeDrawReason } from "@/lib/epoch";
import { requireStudentId } from "@/lib/auth";

export async function GET() {
  try {
    const studentId = await requireStudentId();
    // Auto-advance phases when the time window has elapsed.
    await tickAndSettle();
    const epoch = await ensureCurrentEpoch();
    const assignment = await ensureAssignment(epoch.id, studentId);

    const drawReason = realtimeDrawReason(epoch.id);
    const [questions, realtimeDrawTx] = await Promise.all([
      prisma.question.findMany({
        where: { id: { in: assignment.questionIds } },
        select: {
          id: true,
          type: true,
          prompt: true,
          options: true,
          tags: true,
          difficulty: true,
        },
      }),
      prisma.rewardTx.findFirst({
        where: { epochId: epoch.id, reason: drawReason },
        select: { userId: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      epoch: {
        id: epoch.id,
        status: epoch.status,
        /** 开奖并 mint 后即写入，可与 Explorer / 全局 Block 对齐（epoch 结束前也可已有编号） */
        blockNumber: epoch.blockNumber ?? null,
        commitEndsAt: epoch.commitEndsAt,
        revealEndsAt: epoch.revealEndsAt,
        drandRound: epoch.drandRound,
        drandRandomness: epoch.drandRandomness,
      },
      /** 本轮 reveal 实时开奖的中奖学号（所有人轮询可见，不仅限于刚点 Reveal 的响应） */
      realtimeDrawWinner: realtimeDrawTx?.userId ?? null,
      assignment: { questionIds: assignment.questionIds },
      questions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

