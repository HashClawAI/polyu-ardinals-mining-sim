import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const APP_CONFIG_SINGLETON_ID = "global" as const;

const FALLBACK_COMMIT = 150;
const FALLBACK_REVEAL = 90;

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** First read bootstraps a row using env/`EPOCH_*` when present — afterwards Admin DB values win. */
export async function getAppConfig() {
  const existing = await prisma.appConfig.findUnique({ where: { id: APP_CONFIG_SINGLETON_ID } });
  if (existing) return existing;
  try {
    return await prisma.appConfig.create({
      data: {
        id: APP_CONFIG_SINGLETON_ID,
        epochCommitSeconds: envInt("EPOCH_COMMIT_SECONDS", FALLBACK_COMMIT),
        epochRevealSeconds: envInt("EPOCH_REVEAL_SECONDS", FALLBACK_REVEAL),
        questionsMinPerRound: 1,
        questionsMaxPerRound: 3,
        assignmentDifficultyMin: 1,
        assignmentDifficultyMax: 5,
      },
    });
  } catch {
    return prisma.appConfig.findUniqueOrThrow({ where: { id: APP_CONFIG_SINGLETON_ID } });
  }
}

/** Random question id set for one student-round; respects difficulty window from AppConfig (falls back if pool empty). */
export async function pickRandomQuestionIdsForNewAssignment(
  db: Pick<Prisma.TransactionClient, "question">,
): Promise<string[]> {
  const cfg = await getAppConfig();

  let rows = await db.question.findMany({
    where: {
      active: true,
      difficulty: {
        gte: cfg.assignmentDifficultyMin,
        lte: cfg.assignmentDifficultyMax,
      },
    },
    select: { id: true },
  });
  if (rows.length === 0) {
    rows = await db.question.findMany({
      where: { active: true },
      select: { id: true },
    });
  }

  const minN = Math.min(cfg.questionsMinPerRound, cfg.questionsMaxPerRound);
  const maxN = Math.max(cfg.questionsMinPerRound, cfg.questionsMaxPerRound);
  const countTarget = minN + Math.floor(Math.random() * (maxN - minN + 1));

  const pool = rows.map((r) => r.id);
  const picked: string[] = [];
  const poolMut = [...pool];
  while (picked.length < Math.min(countTarget, poolMut.length) && poolMut.length > 0) {
    const i = Math.floor(Math.random() * poolMut.length);
    picked.push(poolMut.splice(i, 1)[0]);
  }

  return picked;
}
