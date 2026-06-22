"use client";

import { useEffect, useMemo, useState } from "react";

function sha256HexNodeStyle(input: string) {
  // lightweight browser sha256
  const enc = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", enc).then((buf) => {
    const bytes = Array.from(new Uint8Array(buf));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}

export default function VerifyPage() {
  const [epoch, setEpoch] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<string>("alice,bob,charlie");
  const [questionId, setQuestionId] = useState<string>("demo-question");
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [winner, setWinner] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/mine/status");
      const json = await res.json();
      if (!res.ok) return;
      if (!stop) setEpoch(json.epoch);

      const e = await fetch("/api/epoch/current").then((r) => r.json());
      if (!stop) setQuestions(e.questions ?? []);
    }
    load();
    return () => {
      stop = true;
    };
  }, []);

  const candidateList = useMemo(
    () =>
      candidates
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .sort(),
    [candidates],
  );

  async function recompute() {
    if (!epoch?.drandRandomness) return;
    const h = await sha256HexNodeStyle(`${epoch.drandRandomness}${epoch.id}${questionId}`);
    const n = BigInt(`0x${h}`);
    const idx = Number(n % BigInt(candidateList.length || 1));
    setWinnerIndex(idx);
    setWinner(candidateList[idx] ?? null);
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Verify a draw (demo)</h1>
        <p className="mt-2 text-sm text-zinc-700">
          本页展示“如何复算开奖索引”：使用 epoch 的 drand randomness + epochId + questionId 计算 sha256，
          对候选者数量取模得到 winnerIndex。
        </p>

        <div className="mt-4 grid gap-3 text-sm">
          <div>
            <div className="font-medium">Epoch</div>
            <div className="mt-1 text-zinc-700">
              id: <code className="break-all rounded bg-zinc-100 px-1">{epoch?.id ?? "—"}</code>
            </div>
            <div className="mt-1 text-zinc-700">
              drandRandomness:{" "}
              <code className="break-all rounded bg-zinc-100 px-1">
                {epoch?.drandRandomness ?? "— (settle an epoch first)"}
              </code>
            </div>
          </div>

          <div>
            <div className="font-medium">questionId</div>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={questionId}
              onChange={(e) => setQuestionId(e.target.value)}
            >
              <option value="demo-question">demo-question</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="font-medium">candidates (sorted, comma-separated)</div>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={candidates}
              onChange={(e) => setCandidates(e.target.value)}
            />
            <div className="mt-1 text-xs text-zinc-500">
              sorted: <code>{candidateList.join(", ") || "—"}</code>
            </div>
          </div>

          <button
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => recompute()}
            disabled={!epoch?.drandRandomness || candidateList.length === 0}
          >
            Recompute winnerIndex
          </button>

          {winnerIndex !== null ? (
            <div className="rounded-xl border p-4">
              <div className="text-sm text-zinc-700">
                winnerIndex: <span className="font-mono">{winnerIndex}</span>
              </div>
              <div className="mt-1 text-sm text-zinc-700">
                winner: <code className="rounded bg-zinc-100 px-1">{winner ?? "—"}</code>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

