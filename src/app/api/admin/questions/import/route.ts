import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const QuestionIn = z.object({
  type: z.enum(["mcq", "short"]),
  prompt: z.string().min(1),
  options: z.any().nullable().optional(),
  answerKey: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  difficulty: z.number().int().min(1).max(10).optional().default(1),
  active: z.boolean().optional().default(true),
});

const Body = z.object({
  questions: z.array(QuestionIn).min(1).max(500),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const json = await req.json().catch(() => null);
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const q of parsed.data.questions) {
        out.push(
          await tx.question.create({
            data: {
              type: q.type,
              prompt: q.prompt,
              options: (q.options ?? null) as any,
              answerKey: q.answerKey,
              tags: q.tags,
              difficulty: q.difficulty,
              active: q.active,
            },
            select: { id: true },
          }),
        );
      }
      return out;
    });

    return NextResponse.json({ ok: true, createdCount: created.length, ids: created.map((c) => c.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

