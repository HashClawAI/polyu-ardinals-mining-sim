"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BlockRow = {
  blockNumber: number;
  epochId: string;
  status: string;
  winnerUserId: string | null;
  drandRound: number | null;
  settledApproxAt: string;
};

export default function ExplorerPage() {
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
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
          Each numbered block corresponds to one settled epoch. The{' '}
          <b>winner</b> is the student ID minted +1 token in that epoch&apos;s realtime draw (commit→reveal,
          verifiable randomness).
        </p>
        {total !== null ? (
          <p className="mt-2 text-xs text-zinc-500">
            Total blocks chained: <span className="font-mono">{total}</span>
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Block</th>
              <th className="px-4 py-3 font-medium">Winner</th>
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
