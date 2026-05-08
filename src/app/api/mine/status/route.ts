import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStudentId } from "@/lib/auth";
import { ensureCurrentEpoch } from "@/lib/epoch";

export async function GET() {
  try {
    const studentId = await requireStudentId();
    const epoch = await ensureCurrentEpoch();

    const [commit, reveal, rewards, balanceAgg] = await Promise.all([
      prisma.commit.findUnique({ where: { epochId_userId: { epochId: epoch.id, userId: studentId } } }),
      prisma.reveal.findUnique({ where: { epochId_userId: { epochId: epoch.id, userId: studentId } } }),
      prisma.rewardTx.findMany({ where: { epochId: epoch.id, userId: studentId }, orderBy: { createdAt: "desc" } }),
      prisma.rewardTx.aggregate({ where: { userId: studentId }, _sum: { amount: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      epoch: {
        id: epoch.id,
        status: epoch.status,
        commitEndsAt: epoch.commitEndsAt,
        revealEndsAt: epoch.revealEndsAt,
        drandRound: epoch.drandRound,
        drandRandomness: epoch.drandRandomness,
        drandSignature: epoch.drandSignature,
      },
      commit,
      reveal: reveal
        ? {
            ...reveal,
            // payload may include answers; keep it for the user's own view
          }
        : null,
      rewards,
      balance: balanceAgg._sum.amount ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

