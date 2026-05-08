"use client";

import { useEffect, useState } from "react";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Array<{ userId: string; balance: number }> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/leaderboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      if (!stop) setRows(json.leaderboard);
    }
    load().catch((e) => setErr(e instanceof Error ? e.message : "UNKNOWN"));
    return () => {
      stop = true;
    };
  }, []);

  if (err) return <div className="text-sm text-red-600">{err}</div>;

  return (
    <div className="rounded-2xl border bg-white p-6">
      <h1 className="text-xl font-semibold">Leaderboard</h1>
      <p className="mt-2 text-sm text-zinc-700">Top balances based on reward transactions.</p>
      <div className="mt-4 grid gap-2">
        {(rows ?? []).map((r, i) => (
          <div key={r.userId} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-8 text-zinc-500">{i + 1}</span>
              <code className="rounded bg-zinc-100 px-1">{r.userId}</code>
            </div>
            <div className="font-mono">{r.balance}</div>
          </div>
        ))}
        {rows?.length ? null : <div className="text-sm text-zinc-600">No data yet.</div>}
      </div>
    </div>
  );
}

