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

      const [draw, allRewards] = await Promise.all([
        prisma.rewardTx.findFirst({
          where: { epochId: epoch.id, reason: realtimeDrawReason(epoch.id) },
          select: { userId: true, createdAt: true, amount: true },
        }),
        prisma.rewardTx.findMany({
          where: { epochId: epoch.id },
          select: { userId: true, amount: true, reason: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const tokensMintedTotal = allRewards.reduce((s, r) => s + r.amount, 0);

      return NextResponse.json({
        ok: true,
        block: {
          blockNumber: epoch.blockNumber,
          epochId: epoch.id,
          status: epoch.status,
          winnerUserId: draw?.userId ?? null,
          rewardCreatedAt: draw?.createdAt.toISOString() ?? null,
          tokensMintedTotal,
          rewards: allRewards.map((r) => ({
            userId: r.userId,
            amount: r.amount,
            reason: r.reason,
            createdAt: r.createdAt.toISOString(),
          })),
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
            select: { epochId: true, userId: true, reason: true, amount: true },
          });

    const winnerByEpoch = new Map<string, string>();
    const mintSumByEpoch = new Map<string, number>();
    const mintCountByEpoch = new Map<string, number>();
    for (const r of rewardRows) {
      if (r.reason === realtimeDrawReason(r.epochId) && !winnerByEpoch.has(r.epochId)) {
        winnerByEpoch.set(r.epochId, r.userId);
      }
      mintSumByEpoch.set(r.epochId, (mintSumByEpoch.get(r.epochId) ?? 0) + r.amount);
      mintCountByEpoch.set(r.epochId, (mintCountByEpoch.get(r.epochId) ?? 0) + 1);
    }

    const blocks = epochs.map((e) => ({
      blockNumber: e.blockNumber as number,
      epochId: e.id,
      status: e.status,
      winnerUserId: winnerByEpoch.get(e.id) ?? null,
      tokensMintedTotal: mintSumByEpoch.get(e.id) ?? 0,
      rewardTxCount: mintCountByEpoch.get(e.id) ?? 0,
      drandRound: e.drandRound,
      settledApproxAt: e.updatedAt.toISOString(),
    }));

    /** 已上链到排行榜、但本轮尚未 settle（无 blockNumber）的发币 — 与「仅看已结算块」时对不齐的主因 */
    const pendingRewards = await prisma.rewardTx.findMany({
      where: {
        epoch: { blockNumber: null },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        epochId: true,
        userId: true,
        amount: true,
        reason: true,
        createdAt: true,
        epoch: {
          select: {
            status: true,
            commitEndsAt: true,
            revealEndsAt: true,
          },
        },
      },
    });

    const [mintGrand, mintEpochHasBlock, mintEpochNoBlock] = await Promise.all([
      prisma.rewardTx.aggregate({ _sum: { amount: true } }),
      prisma.rewardTx.aggregate({
        where: { epoch: { blockNumber: { not: null } } },
        _sum: { amount: true },
      }),
      prisma.rewardTx.aggregate({
        where: { epoch: { blockNumber: null } },
        _sum: { amount: true },
      }),
    ]);

    const grand = mintGrand._sum.amount ?? 0;
    const onBlocks = mintEpochHasBlock._sum.amount ?? 0;
    const pendingTotal = mintEpochNoBlock._sum.amount ?? 0;

    return NextResponse.json({
      ok: true,
      total,
      limit,
      offset,
      blocks,
      pendingRewards: pendingRewards.map((r) => ({
        epochId: r.epochId,
        epochStatus: r.epoch.status,
        userId: r.userId,
        amount: r.amount,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        revealEndsAt: r.epoch.revealEndsAt.toISOString(),
      })),
      /** 排行榜「各人余额相加」≈ mintGrandTotal；块浏览器只枚举有 blockHeight 的记录，pending = 尚无 blockNumber 的发币（常见：reveal 已开奖、尚未 tick settle） */
      reconciliation: {
        mintGrandTotal: grand,
        mintSumEpochAttachedToConfirmedBlock: onBlocks,
        mintSumEpochNotYetAnchoredAsBlock: pendingTotal,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
