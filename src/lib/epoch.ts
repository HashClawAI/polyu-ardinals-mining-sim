import { prisma } from "@/lib/prisma";
import { sha256Hex, hexToBigInt } from "@/lib/crypto";
import { stableStringify } from "@/lib/stableJson";

const DEFAULT_COMMIT_SECONDS = 150;
const DEFAULT_REVEAL_SECONDS = 90;
const DEFAULT_QUESTIONS_MIN = 1;
const DEFAULT_QUESTIONS_MAX = 3;
const DEFAULT_REWARD_AMOUNT = 10;
const DEFAULT_MAX_REWARDS_PER_EPOCH = 1;

export type DrandBeacon = {
  round: number;
  randomness: string;
  signature: string;
  previous_signature?: string;
};

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function getEpochDurationsSeconds() {
  return {
    commitSeconds: envInt("EPOCH_COMMIT_SECONDS", DEFAULT_COMMIT_SECONDS),
    revealSeconds: envInt("EPOCH_REVEAL_SECONDS", DEFAULT_REVEAL_SECONDS),
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
  const { commitSeconds, revealSeconds } = getEpochDurationsSeconds();
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

  const activeQuestions = await prisma.question.findMany({
    where: { active: true },
    select: { id: true },
  });

  const count = Math.min(
    DEFAULT_QUESTIONS_MAX,
    Math.max(DEFAULT_QUESTIONS_MIN, 1 + Math.floor(Math.random() * DEFAULT_QUESTIONS_MAX)),
  );

  const pool = activeQuestions.map((q) => q.id);
  const picked: string[] = [];
  while (picked.length < Math.min(count, pool.length) && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }

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

    // Draw winners per question
    const assignments = await tx.assignment.findMany({ where: { epochId } });
    const questionIds = Array.from(new Set(assignments.flatMap((a) => a.questionIds)));

    const randomnessHex = drand.randomness;
    const rewardedUsers = new Set<string>();

    for (const qId of questionIds) {
      const candidates = await tx.reveal.findMany({
        where: { epochId, isValid: true, isCorrect: true },
        select: { userId: true, payload: true },
      });

      // Candidate must have been assigned this question
      const filtered: string[] = [];
      for (const c of candidates) {
        const asg = assignments.find((a) => a.userId === c.userId);
        if (asg?.questionIds.includes(qId)) filtered.push(c.userId);
      }

      const uniqueSorted = Array.from(new Set(filtered)).sort();
      const idx = drawWinnerIndex({
        randomnessHex,
        epochId,
        questionId: qId,
        candidatesCount: uniqueSorted.length,
      });
      if (idx === null) continue;

      const winnerId = uniqueSorted[idx];
      if (!winnerId) continue;
      if (rewardedUsers.has(winnerId)) continue;
      if (rewardedUsers.size >= DEFAULT_MAX_REWARDS_PER_EPOCH * uniqueSorted.length) {
        // soft cap, prevents runaway if configs change
      }

      rewardedUsers.add(winnerId);
      await tx.rewardTx.create({
        data: {
          epochId,
          userId: winnerId,
          amount: DEFAULT_REWARD_AMOUNT,
          reason: `epoch:${epochId} question:${qId} win`,
        },
      });
    }

    await tx.epoch.update({ where: { id: epochId }, data: { status: "settled" } });
  });
}

