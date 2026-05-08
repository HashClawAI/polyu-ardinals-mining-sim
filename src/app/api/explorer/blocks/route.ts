import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { realtimeDrawReason } from "@/lib/epoch";

function parseNonNegInt(raw: string | null, fallback: number) {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return fallback;
  return n;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const blockOnly = searchParams.get("block");
    const limit = Math.min(500, Math.max(1, parseNonNegInt(searchParams.get("limit"), 80)));
    const offset = Math.max(0, parseNonNegInt(searchParams.get("offset"), 0));

    if (blockOnly !== null && blockOnly !== "") {
      const bn = Number(blockOnly);
      if (!Number.isFinite(bn) || bn < 0 || !Number.isInteger(bn)) {
        return NextResponse.json({ ok: false, error: "INVALID_BLOCK" }, { status: 400 });
      }

      const epoch = await prisma.epoch.findFirst({
        where: { blockNumber: bn },
        select: {
          id: true,
          status: true,
          blockNumber: true,
          createdAt: true,
          commitEndsAt: true,
          revealEndsAt: true,
          updatedAt: true,
          drandRound: true,
          drandRandomness: true,
          drandSignature: true,
          drandBeaconId: true,
        },
      });

      if (!epoch || epoch.blockNumber === null) {
        return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
      }

      const draw = await prisma.rewardTx.findFirst({
        where: { epochId: epoch.id, reason: realtimeDrawReason(epoch.id) },
        select: { userId: true, createdAt: true, amount: true },
      });

      return NextResponse.json({
        ok: true,
        block: {
          blockNumber: epoch.blockNumber,
          epochId: epoch.id,
          status: epoch.status,
          winnerUserId: draw?.userId ?? null,
          rewardCreatedAt: draw?.createdAt.toISOString() ?? null,
          drandRound: epoch.drandRound,
          drandRandomness: epoch.drandRandomness,
          drandSignature: epoch.drandSignature,
          drandBeaconId: epoch.drandBeaconId,
          timestamps: {
            epochCreatedAt: epoch.createdAt.toISOString(),
            commitEndsAt: epoch.commitEndsAt.toISOString(),
            revealEndsAt: epoch.revealEndsAt.toISOString(),
            lastUpdatedAt: epoch.updatedAt.toISOString(),
          },
        },
      });
    }

    const [total, epochs] = await Promise.all([
      prisma.epoch.count({ where: { blockNumber: { not: null } } }),
      prisma.epoch.findMany({
        where: { blockNumber: { not: null } },
        orderBy: { blockNumber: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          blockNumber: true,
          updatedAt: true,
          drandRound: true,
        },
      }),
    ]);

    const epochIds = epochs.map((e) => e.id);
    const rewardRows =
      epochIds.length === 0
        ? []
        : await prisma.rewardTx.findMany({
            where: { epochId: { in: epochIds } },
            select: { epochId: true, userId: true, reason: true },
          });

    const winnerByEpoch = new Map<string, string>();
    for (const r of rewardRows) {
      if (r.reason !== realtimeDrawReason(r.epochId)) continue;
      if (!winnerByEpoch.has(r.epochId)) winnerByEpoch.set(r.epochId, r.userId);
    }

    const blocks = epochs.map((e) => ({
      blockNumber: e.blockNumber as number,
      epochId: e.id,
      status: e.status,
      winnerUserId: winnerByEpoch.get(e.id) ?? null,
      drandRound: e.drandRound,
      settledApproxAt: e.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      ok: true,
      total,
      limit,
      offset,
      blocks,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
