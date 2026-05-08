"use client";

import { useEffect, useState } from "react";

export default function WalletPage() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/mine/status");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "LOAD_FAILED");
      if (!stop) setData(json);
    }
    load().catch((e) => setErr(e instanceof Error ? e.message : "UNKNOWN"));
    return () => {
      stop = true;
    };
  }, []);

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!data) return <div className="text-sm text-zinc-600">Loading...</div>;

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Wallet</h1>
        <div className="mt-2 text-sm text-zinc-700">
          Balance: <span className="font-semibold">{data.balance}</span>
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Recent rewards</h2>
        <div className="mt-3 grid gap-2">
          {(data.rewards ?? []).map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
              <div className="truncate text-zinc-700">{tx.reason}</div>
              <div className="font-mono">+{tx.amount}</div>
            </div>
          ))}
          {data.rewards?.length ? null : (
            <div className="text-sm text-zinc-600">No rewards yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}

