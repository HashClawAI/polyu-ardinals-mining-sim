import { NextResponse } from "next/server";
import { z } from "zod";
import { APP_CONFIG_SINGLETON_ID, getAppConfig } from "@/lib/appConfig";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const PartialConfig = z
  .object({
    epochCommitSeconds: z.number().int().min(10).max(86400).optional(),
    epochRevealSeconds: z.number().int().min(10).max(86400).optional(),
    questionsMinPerRound: z.number().int().min(1).max(20).optional(),
    questionsMaxPerRound: z.number().int().min(1).max(20).optional(),
    assignmentDifficultyMin: z.number().int().min(1).max(10).optional(),
    assignmentDifficultyMax: z.number().int().min(1).max(10).optional(),
  })
  .strict();

export async function GET() {
  try {
    await requireAdmin();
    const c = await getAppConfig();
    return NextResponse.json({
      ok: true,
      config: {
        epochCommitSeconds: c.epochCommitSeconds,
        epochRevealSeconds: c.epochRevealSeconds,
        questionsMinPerRound: c.questionsMinPerRound,
        questionsMaxPerRound: c.questionsMaxPerRound,
        assignmentDifficultyMin: c.assignmentDifficultyMin,
        assignmentDifficultyMax: c.assignmentDifficultyMax,
        updatedAt: c.updatedAt.toISOString(),
      },
      hints: [
        "Commit/Reveal seconds apply to epochs created after save — the active epoch keeps its original deadlines.",
        "Difficulty range filters which active questions are eligible for random assignment (empty eligible pool falls back to all active).",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = PartialConfig.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const cur = await getAppConfig();
    const merged = {
      epochCommitSeconds: parsed.data.epochCommitSeconds ?? cur.epochCommitSeconds,
      epochRevealSeconds: parsed.data.epochRevealSeconds ?? cur.epochRevealSeconds,
      questionsMinPerRound: parsed.data.questionsMinPerRound ?? cur.questionsMinPerRound,
      questionsMaxPerRound: parsed.data.questionsMaxPerRound ?? cur.questionsMaxPerRound,
      assignmentDifficultyMin:
        parsed.data.assignmentDifficultyMin ?? cur.assignmentDifficultyMin,
      assignmentDifficultyMax:
        parsed.data.assignmentDifficultyMax ?? cur.assignmentDifficultyMax,
    };

    if (merged.questionsMinPerRound > merged.questionsMaxPerRound) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RANGE questionsMinPerRound > questionsMaxPerRound" },
        { status: 400 },
      );
    }
    if (merged.assignmentDifficultyMin > merged.assignmentDifficultyMax) {
      return NextResponse.json(
        { ok: false, error: "INVALID_RANGE assignmentDifficultyMin > assignmentDifficultyMax" },
        { status: 400 },
      );
    }

    await prisma.appConfig.update({
      where: { id: APP_CONFIG_SINGLETON_ID },
      data: merged,
    });

    const next = await getAppConfig();
    return NextResponse.json({
      ok: true,
      config: {
        epochCommitSeconds: next.epochCommitSeconds,
        epochRevealSeconds: next.epochRevealSeconds,
        questionsMinPerRound: next.questionsMinPerRound,
        questionsMaxPerRound: next.questionsMaxPerRound,
        assignmentDifficultyMin: next.assignmentDifficultyMin,
        assignmentDifficultyMax: next.assignmentDifficultyMax,
        updatedAt: next.updatedAt.toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
