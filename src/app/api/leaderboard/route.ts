import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.rewardTx.groupBy({
    by: ["userId"],
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    leaderboard: rows.map((r) => ({ userId: r.userId, balance: r._sum.amount ?? 0 })),
  });
}

