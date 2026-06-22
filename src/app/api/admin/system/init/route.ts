import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await requireAdmin();

    const result = await prisma.$transaction(async (tx) => {
      // Keep questions; reset everything else.
      await tx.rewardTx.deleteMany({});
      await tx.reveal.deleteMany({});
      await tx.commit.deleteMany({});
      await tx.assignment.deleteMany({});
      await tx.epoch.deleteMany({});

      const state = await tx.systemState.upsert({
        where: { id: "global" },
        update: { blockHeight: 0 },
        create: { id: "global", blockHeight: 0 },
      });

      return state;
    });

    return NextResponse.json({ ok: true, system: { blockHeight: result.blockHeight } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

