"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type RewardRow = {
  userId: string;
  amount: number;
  reason: string;
  createdAt: string;
};

type Detail = {
  blockNumber: number;
  epochId: string;
  status: string;
  winnerUserId: string | null;
  rewardCreatedAt: string | null;
  tokensMintedTotal?: number;
  rewards?: RewardRow[];
  drandRound: number | null;
  drandRandomness: string | null;
  drandSignature: string | null;
  drandBeaconId: string | null;
  timestamps: {
    epochCreatedAt: string;
    commitEndsAt: string;
    revealEndsAt: string;
    lastUpdatedAt: string;
  };
};

export default function ExplorerBlockPage() {
  const params = useParams();
  const raw = typeof params.height === "string" ? params.height : Array.isArray(params.height) ? params.height[0] : "";
  const [block, setBlock] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!raw) return;
    let stop = false;
    async function load() {
      setErr(null);
      const res = await fetch(`/api/explorer/blocks?block=${encodeURIComponent(raw)}`);
      const json = await res.json();
      if (!res.ok) {
        if (!stop) {
          setBlock(null);
          setErr(json.error === "NOT_FOUND" ? "Block not found." : json.error ?? "LOAD_FAILED");
        }
        return;
      }
      if (!stop && json.block) setBlock(json.block as Detail);
    }
    load();
    return () => {
      stop = true;
    };
  }, [raw]);

  if (!raw) return <div className="text-sm text-red-600">Invalid route.</div>;
  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!block) return <div className="text-sm text-zinc-600">Loading block…</div>;

  const trunc = (s: string | null, left = 12, right = 8) => {
    if (!s) return "—";
    if (s.length <= left + right + 3) return s;
    return `${s.slice(0, left)}…${s.slice(-right)}`;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-xl font-semibold font-mono">Block {block.blockNumber}</h1>
        <Link href="/explorer" className="text-sm text-blue-700 hover:underline">
          ← Back to chain
        </Link>
      </div>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Draw winner (realtime)</h2>
        <div className="mt-2 text-lg font-mono">
          {block.winnerUserId ? (
            <code className="rounded bg-emerald-50 px-2 py-1 text-emerald-900">{block.winnerUserId}</code>
          ) : (
            <span className="text-zinc-400">No realtime draw payout for this epoch.</span>
          )}
        </div>
        {block.rewardCreatedAt ? (
          <p className="mt-2 text-xs text-zinc-500">Minted at {new Date(block.rewardCreatedAt).toLocaleString()}</p>
        ) : null}
        {typeof block.tokensMintedTotal === "number" ? (
          <p className="mt-2 text-xs text-zinc-600">
            Total tokens minted on this block (all <code className="text-[10px]">RewardTx</code>):{" "}
            <span className="font-mono font-medium">{block.tokensMintedTotal}</span>
          </p>
        ) : null}
      </section>

      {block.rewards && block.rewards.length > 0 ? (
        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">All mints (this block)</h2>
          <ul className="mt-3 grid gap-2 text-xs">
            {block.rewards.map((r, i) => (
              <li key={`${r.reason}-${i}`} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <span className="font-mono font-medium">{r.userId}</span>{" "}
                <span className="text-zinc-600">+{r.amount}</span>
                <div className="mt-1 break-all font-mono text-[10px] text-zinc-500">{r.reason}</div>
                <div className="mt-0.5 text-[10px] text-zinc-400">{new Date(r.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Epoch</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="w-36 shrink-0 text-zinc-500">epochId</dt>
            <dd className="min-w-0 break-all font-mono text-xs">{block.epochId}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="w-36 shrink-0 text-zinc-500">status</dt>
            <dd>
              <code className="rounded bg-zinc-100 px-1">{block.status}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Randomness (drand)</h2>
        <dl className="mt-3 grid gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Round</dt>
            <dd className="font-mono">{block.drandRound ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Beacon</dt>
            <dd className="font-mono text-xs">{block.drandBeaconId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">randomness (hex)</dt>
            <dd className="break-all font-mono text-xs" title={block.drandRandomness ?? ""}>
              {trunc(block.drandRandomness)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">signature</dt>
            <dd className="break-all font-mono text-xs" title={block.drandSignature ?? ""}>
              {trunc(block.drandSignature)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Timestamps</h2>
        <ul className="mt-3 grid gap-1 text-xs text-zinc-600 font-mono">
          <li>epoch created: {new Date(block.timestamps.epochCreatedAt).toLocaleString()}</li>
          <li>commit ends: {new Date(block.timestamps.commitEndsAt).toLocaleString()}</li>
          <li>reveal ends: {new Date(block.timestamps.revealEndsAt).toLocaleString()}</li>
          <li>epoch row updated: {new Date(block.timestamps.lastUpdatedAt).toLocaleString()}</li>
        </ul>
      </section>
    </div>
  );
}
