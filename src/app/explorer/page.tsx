"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BlockRow = {
  blockNumber: number;
  epochId: string;
  status: string;
  winnerUserId: string | null;
  tokensMintedTotal?: number;
  rewardTxCount?: number;
  drandRound: number | null;
  settledApproxAt: string;
};

type PendingRow = {
  epochId: string;
  epochStatus: string;
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
  revealEndsAt: string;
};

type Reconciliation = {
  mintGrandTotal: number;
  mintSumEpochAttachedToConfirmedBlock: number;
  mintSumEpochNotYetAnchoredAsBlock: number;
};

export default function ExplorerPage() {
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/explorer/blocks?limit=100");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      if (!stop) {
        setBlocks(json.blocks ?? []);
        setTotal(typeof json.total === "number" ? json.total : null);
        setPending(Array.isArray(json.pendingRewards) ? json.pendingRewards : []);
        setRecon(
          json.reconciliation &&
            typeof json.reconciliation.mintGrandTotal === "number" &&
            typeof json.reconciliation.mintSumEpochAttachedToConfirmedBlock === "number" &&
            typeof json.reconciliation.mintSumEpochNotYetAnchoredAsBlock === "number"
            ? json.reconciliation
            : null,
        );
      }
    }
    load().catch((e) => setErr(e instanceof Error ? e.message : "UNKNOWN"));
    const t = window.setInterval(() => {
      load().catch(() => {});
    }, 5000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  if (err) return <div className="text-sm text-red-600">{err}</div>;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Block explorer</h1>
        <p className="mt-2 text-sm text-zinc-700">
          When the realtime draw mints a <code className="text-xs">RewardTx</code>, the app{' '}
          <b>immediately</b> assigns the next <code className="text-xs">blockNumber</code> and bumps global
          height—so winner, mint, and block row stay in sync with the leaderboard. If nobody wins a draw
          this round, the block is created at settlement instead. Legacy rows may still show under{' '}
          <b>Pending mints</b> until the next reveal hits the backfill path or you run settle.
        </p>
        {total !== null ? (
          <p className="mt-2 text-xs text-zinc-500">
            Total blocks chained: <span className="font-mono">{total}</span>
          </p>
        ) : null}
        {recon ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-700">
            <div className="font-medium text-zinc-800">Σ amounts (match leaderboard totals)</div>
            <ul className="mt-2 grid gap-1 font-mono">
              <li>All RewardTx summed: <b>{recon.mintGrandTotal}</b></li>
              <li>Mints on epochs that already have a block #: {recon.mintSumEpochAttachedToConfirmedBlock}</li>
              <li>
                Mints waiting for settle / block #:{" "}
                <b>{recon.mintSumEpochNotYetAnchoredAsBlock}</b>
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      {pending.length ? (
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/80">
          <div className="border-b border-amber-200 bg-amber-100/90 px-4 py-3 text-amber-950">
            <div className="text-sm font-medium">待挂块的发币 / Pending mints</div>
            <p className="mt-2 text-xs leading-relaxed text-amber-900/90">
              这类记录<strong>已经写入数据库并计入排行榜</strong>（榜单上的积分会多于「已有编号区块」行数——直到本条 settle
              进块）。系统约定：<strong>编号区块仅在 epoch settle 后才分配</strong>；在{" "}
              <code className="rounded bg-white/80 px-0.5">reveal</code>{" "}
              阶段开奖只会先产生 RewardTx，等本轮 reveal 时间结束并完成 settle（自动{" "}
              <code className="rounded bg-white/80 px-0.5">/api/cron/tick</code>{" "}
              或 Mine 页 <strong>Tick (dev)</strong>）后，该行会从这里消失并出现在下面的区块列表中。
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-amber-900/75">
              Same tokens are already on the leaderboard. They show here until reveal ends and the epoch
              settles—then they move into a numbered block.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-amber-100/60 text-xs uppercase tracking-wide text-amber-900/80">
              <tr>
                <th className="px-4 py-2 font-medium">To</th>
                <th className="px-4 py-2 font-medium">Amt</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Reveal ends (~settle)</th>
                <th className="px-4 py-2 font-medium hidden sm:table-cell">Reason</th>
                <th className="px-4 py-2 font-medium">Phase</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p, i) => (
                <tr key={`${p.epochId}-${p.createdAt}-${i}`} className="border-b border-amber-100 last:border-0">
                  <td className="px-4 py-2">
                    <code className="text-xs">{p.userId}</code>
                  </td>
                  <td className="px-4 py-2 font-mono">{p.amount}</td>
                  <td className="hidden px-4 py-2 font-mono text-xs text-zinc-700 whitespace-nowrap lg:table-cell">
                    {p.revealEndsAt ? new Date(p.revealEndsAt).toLocaleString() : "—"}
                  </td>
                  <td className="hidden px-4 py-2 sm:table-cell">
                    <code className="break-all text-[10px] text-zinc-600">{p.reason}</code>
                  </td>
                  <td className="px-4 py-2 text-xs capitalize text-zinc-700">{p.epochStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Block</th>
              <th className="px-4 py-3 font-medium">Winner</th>
              <th className="px-4 py-3 font-medium">Σ mint</th>
              <th className="px-4 py-3 font-medium">drand round</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Epoch</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">≈ settled</th>
            </tr>
          </thead>
          <tbody>
            {(blocks ?? []).map((b) => (
              <tr key={b.blockNumber} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/80">
                <td className="px-4 py-3 align-top font-mono">
                  <Link
                    href={`/explorer/${b.blockNumber}`}
                    className="text-blue-700 underline-offset-4 hover:text-blue-900 hover:underline"
                  >
                    {b.blockNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top">
                  {b.winnerUserId ? (
                    <code className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-900">{b.winnerUserId}</code>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top font-mono text-zinc-800">
                  {typeof b.tokensMintedTotal === "number" ? b.tokensMintedTotal : "—"}
                  {typeof b.rewardTxCount === "number" && b.rewardTxCount > 1 ? (
                    <span className="ml-1 text-[10px] font-normal text-amber-700" title="Multiple RewardTx on this epoch (e.g. legacy + draw)">
                      ({b.rewardTxCount} tx)
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 align-top font-mono text-zinc-600">
                  {b.drandRound ?? "—"}
                </td>
                <td className="hidden px-4 py-3 align-top md:table-cell">
                  <code className="break-all text-xs text-zinc-600">{b.epochId}</code>
                </td>
                <td className="hidden px-4 py-3 align-top lg:table-cell whitespace-nowrap text-zinc-500">
                  {new Date(b.settledApproxAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(blocks ?? []).length ? null : (
          <div className="px-4 py-8 text-center text-sm text-zinc-600">No settled blocks yet.</div>
        )}
      </div>
    </div>
  );
}
