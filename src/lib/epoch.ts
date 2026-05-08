import type { Prisma } from "@prisma/client";
import { getAppConfig, pickRandomQuestionIdsForNewAssignment } from "@/lib/appConfig";
import { prisma } from "@/lib/prisma";
import { sha256Hex, hexToBigInt } from "@/lib/crypto";
import { stableStringify } from "@/lib/stableJson";
// systemState is updated during settlement to track \"block height\"

export type DrandBeacon = {
  round: number;
  randomness: string;
  signature: string;
  previous_signature?: string;
};

/** Matches `RewardTx.reason` minted by reveal-time draw (`src/app/api/mine/reveal/route.ts`). */
export function realtimeDrawReason(epochId: string) {
  return `epoch:${epochId} realtime_draw`;
}

async function getEpochDurationsSeconds() {
  const c = await getAppConfig();
  return {
    commitSeconds: c.epochCommitSeconds,
    revealSeconds: c.epochRevealSeconds,
  };
}

export async function ensureCurrentEpoch(now = new Date()) {
  const latest = await prisma.epoch.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return await createEpoch(now);

  // If already settled and past reveal end, start a new one.
  if (latest.status === "settled" && now.getTime() >= latest.revealEndsAt.getTime()) {
    return await createEpoch(now);
  }

  return latest;
}

async function createEpoch(now: Date) {
  const { commitSeconds, revealSeconds } = await getEpochDurationsSeconds();
  const commitEndsAt = new Date(now.getTime() + commitSeconds * 1000);
  const revealEndsAt = new Date(commitEndsAt.getTime() + revealSeconds * 1000);
  return await prisma.epoch.create({
    data: {
      status: "commit",
      commitEndsAt,
      revealEndsAt,
    },
  });
}

export async function ensureAssignment(epochId: string, studentId: string) {
  const existing = await prisma.assignment.findUnique({
    where: { epochId_userId: { epochId, userId: studentId } },
  });
  if (existing) return existing;

  const picked = await pickRandomQuestionIdsForNewAssignment(prisma);

  return await prisma.assignment.create({
    data: {
      epochId,
      userId: studentId,
      questionIds: picked,
    },
  });
}

export function computeCommitHash(params: {
  studentId: string;
  payload: unknown;
  salt: string;
}) {
  const payloadStr = stableStringify(params.payload);
  return sha256Hex(`${payloadStr}${params.salt}${params.studentId}`);
}

export async function fetchDrandLatest(): Promise<DrandBeacon> {
  const res = await fetch("https://api.drand.sh/public/latest", { cache: "no-store" });
  if (!res.ok) throw new Error(`DRAND_FETCH_FAILED_${res.status}`);
  return (await res.json()) as DrandBeacon;
}

export function drawWinnerIndex(params: {
  randomnessHex: string;
  epochId: string;
  questionId: string;
  candidatesCount: number;
}) {
  if (params.candidatesCount <= 0) return null;
  const h = sha256Hex(`${params.randomnessHex}${params.epochId}${params.questionId}`);
  const n = hexToBigInt(h);
  return Number(n % BigInt(params.candidatesCount));
}

/**
 * Assign the next global block # to this epoch (once) and bump `SystemState.blockHeight`.
 * Idempotent: if `Epoch.blockNumber` is already set, returns that number and does not bump again.
 * Call this when a `realtime_draw` RewardTx is minted so explorer == leaderboard immediately;
 * also call at settle for epochs with no draw (no RewardTx) so every round still gets a block row.
 */
export async function anchorNextBlockForEpochIfNeeded(
  tx: Prisma.TransactionClient,
  epochId: string,
): Promise<number | null> {
  const e = await tx.epoch.findUnique({
    where: { id: epochId },
    select: { blockNumber: true },
  });
  if (!e) return null;
  if (e.blockNumber !== null) return e.blockNumber;

  const system = await tx.systemState.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", blockHeight: 0 },
    select: { blockHeight: true },
  });
  const n = system.blockHeight;
  await tx.epoch.update({
    where: { id: epochId },
    data: { blockNumber: n },
  });
  await tx.systemState.update({
    where: { id: "global" },
    data: { blockHeight: n + 1 },
  });
  return n;
}

export async function tickAndSettle(now = new Date()) {
  const epoch = await ensureCurrentEpoch(now);

  if (epoch.status === "commit" && now.getTime() >= epoch.commitEndsAt.getTime()) {
    await prisma.epoch.update({ where: { id: epoch.id }, data: { status: "reveal" } });
    return { transitioned: true, settled: false, epochId: epoch.id };
  }

  if (epoch.status === "reveal" && now.getTime() >= epoch.revealEndsAt.getTime()) {
    await settleEpoch(epoch.id);
    return { transitioned: true, settled: true, epochId: epoch.id };
  }

  return { transitioned: false, settled: false, epochId: epoch.id };
}

async function settleEpoch(epochId: string) {
  await prisma.$transaction(async (tx) => {
    const epoch = await tx.epoch.findUnique({ where: { id: epochId } });
    if (!epoch) return;
    if (epoch.status === "settled") return;

    const drand =
      epoch.drandRandomness && epoch.drandRound && epoch.drandSignature
        ? {
            round: epoch.drandRound,
            randomness: epoch.drandRandomness,
            signature: epoch.drandSignature,
          }
        : await fetchDrandLatest();
    if (!epoch.drandRandomness) {
      await tx.epoch.update({
        where: { id: epochId },
        data: {
          drandRound: drand.round,
          drandRandomness: drand.randomness,
          drandSignature: drand.signature,
          drandBeaconId: "public",
        },
      });
    }

    // Grade reveals
    const reveals = await tx.reveal.findMany({ where: { epochId } });
    for (const r of reveals) {
      const commit = await tx.commit.findUnique({
        where: { epochId_userId: { epochId, userId: r.userId } },
      });
      if (!commit) continue;

      const computed = computeCommitHash({
        studentId: r.userId,
        payload: r.payload,
        salt: r.salt,
      });

      if (computed !== commit.commitHash) {
        await tx.reveal.update({
          where: { id: r.id },
          data: { isValid: false, isCorrect: false, gradedAt: new Date() },
        });
        continue;
      }

      const assignment = await tx.assignment.findUnique({
        where: { epochId_userId: { epochId, userId: r.userId } },
      });
      const qIds = assignment?.questionIds ?? [];
      const answers = (r.payload as any)?.answers as Record<string, unknown> | undefined;

      let allCorrect = true;
      if (!answers) allCorrect = false;
      for (const qId of qIds) {
        const q = await tx.question.findUnique({ where: { id: qId } });
        if (!q) continue;
        const given = answers?.[qId];
        if (String(given ?? "") !== q.answerKey) {
          allCorrect = false;
        }
      }

      await tx.reveal.update({
        where: { id: r.id },
        data: { isValid: true, isCorrect: allCorrect, gradedAt: new Date() },
      });
    }

    // Token rewards are issued once per epoch during reveal (`realtime_draw`, +1).
    // Block # is usually anchored at draw time; if nobody triggered a draw, anchor here.
    await anchorNextBlockForEpochIfNeeded(tx, epochId);

    await tx.epoch.update({
      where: { id: epochId },
      data: { status: "settled" },
    });
  });
}

