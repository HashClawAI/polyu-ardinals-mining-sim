"use client";

import { useEffect, useMemo, useState } from "react";
import { sha256HexAsync } from "@/lib/clientHash";
import { stableStringify } from "@/lib/clientStableJson";

type EpochStatus = "commit" | "reveal" | "settled";

type Question = {
  id: string;
  type: "mcq" | "short";
  prompt: string;
  options: any;
};

function getClientSecret(studentId: string) {
  const key = `polyu_client_secret:${studentId}`;
  const v = localStorage.getItem(key);
  if (!v) throw new Error("CLIENT_SECRET_MISSING (go to /login first)");
  return v;
}

async function deriveSalt(secret: string, epochId: string) {
  const nonceKey = `polyu_nonce:${epochId}`;
  const nonce = Number(localStorage.getItem(nonceKey) ?? "0") + 1;
  localStorage.setItem(nonceKey, String(nonce));
  return await sha256HexAsync(`${secret}${epochId}${nonce}`);
}

export default function MinePage() {
  const [me, setMe] = useState<string | null>(null);
  const [epoch, setEpoch] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [commitHash, setCommitHash] = useState<string>("");
  const [salt, setSalt] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  /** 来自 /api/epoch/current，开奖后所有在线学生轮询都能看到 */
  const [realtimeDrawWinner, setRealtimeDrawWinner] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const meRes = await fetch("/api/auth/me");
      const meJson = await meRes.json();
      if (!stop) setMe(meJson.studentId);

      const res = await fetch("/api/epoch/current");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "LOAD_FAILED");
      if (!stop) {
        setEpoch(data.epoch);
        setQuestions(data.questions);
        setRealtimeDrawWinner(
          typeof data.realtimeDrawWinner === "string" ? data.realtimeDrawWinner : null,
        );
      }
    }
    load().catch((e) => setErr(e instanceof Error ? e.message : "UNKNOWN"));

    const t1 = window.setInterval(() => setNowMs(Date.now()), 250);
    const t2 = window.setInterval(() => {
      load().catch(() => {});
    }, 2000);
    return () => {
      stop = true;
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
  }, []);

  const payload = useMemo(() => ({ answers }), [answers]);

  function persistCommitMaterial(params: { epochId: string; studentId: string; salt: string; payload: unknown }) {
    const key = `polyu_commit_material:${params.studentId}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        epochId: params.epochId,
        salt: params.salt,
        payload: params.payload,
        savedAt: Date.now(),
      }),
    );
  }

  function loadCommitMaterial(studentId: string) {
    const key = `polyu_commit_material:${studentId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { epochId: string; salt: string; payload: any; savedAt: number };
    } catch {
      return null;
    }
  }

  async function doCommit() {
    setErr(null);
    setMsg(null);
    if (!me) throw new Error("NOT_LOGGED_IN");
    if (!epoch) throw new Error("NO_EPOCH");
    if (epoch.status !== "commit") throw new Error("NOT_IN_COMMIT_PHASE");

    const secret = getClientSecret(me);
    const s = await deriveSalt(secret, epoch.id);
    const payloadStr = stableStringify(payload);
    const h = await sha256HexAsync(`${payloadStr}${s}${me}`);

    setSalt(s);
    setCommitHash(h);
    persistCommitMaterial({ epochId: epoch.id, studentId: me, salt: s, payload });

    const res = await fetch("/api/mine/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commitHash: h }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "COMMIT_FAILED");
    setMsg("Committed.");
  }

  async function doReveal() {
    setErr(null);
    setMsg(null);
    if (!epoch) throw new Error("NO_EPOCH");
    if (epoch.status !== "reveal") throw new Error("NOT_IN_REVEAL_PHASE");
    if (!me) throw new Error("NOT_LOGGED_IN");

    let s = salt;
    let p: unknown = payload;
    if (!s) {
      const material = loadCommitMaterial(me);
      if (material && material.epochId === epoch.id) {
        s = material.salt;
        p = material.payload;
        setSalt(s);
      }
    }
    if (!s) throw new Error("MISSING_SALT (commit first on this device)");

    const res = await fetch("/api/mine/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: p, salt: s }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "REVEAL_FAILED");
    const bn = typeof data.drawBlockNumber === "number" ? `#${data.drawBlockNumber}` : "—";
    setMsg(
      data.instantRewarded
        ? `Revealed. You won +1 (winner=${data.drawWinner ?? "—"}, block ${bn}).`
        : `Revealed. Winner=${data.drawWinner ?? "—"}, block ${bn}.`,
    );
  }

  async function doTick() {
    const res = await fetch("/api/cron/tick", { method: "POST" });
    const data = await res.json();
    setMsg(`Tick: ${JSON.stringify(data.result)}`);
    // refresh epoch
    const e2 = await fetch("/api/epoch/current").then((r) => r.json());
    setEpoch(e2.epoch);
  }

  const status = (epoch?.status as EpochStatus | undefined) ?? undefined;
  const commitEndsAtMs = epoch?.commitEndsAt ? new Date(epoch.commitEndsAt).getTime() : null;
  const revealEndsAtMs = epoch?.revealEndsAt ? new Date(epoch.revealEndsAt).getTime() : null;

  const commitLeftSec =
    commitEndsAtMs === null ? null : Math.max(0, Math.ceil((commitEndsAtMs - nowMs) / 1000));
  const revealLeftSec =
    revealEndsAtMs === null ? null : Math.max(0, Math.ceil((revealEndsAtMs - nowMs) / 1000));

  // Auto-reveal: if we already have (epochId,salt,payload) saved locally, submit reveal when phase starts.
  useEffect(() => {
    if (!me || !epoch) return;
    if (epoch.status !== "reveal") return;
    const autoKey = `polyu_auto_reveal_done:${me}:${epoch.id}`;
    if (localStorage.getItem(autoKey)) return;
    const material = loadCommitMaterial(me);
    if (!material || material.epochId !== epoch.id) return;
    localStorage.setItem(autoKey, "1");
    doReveal().catch(() => {
      // If it fails transiently, allow retry later
      localStorage.removeItem(autoKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, epoch?.id, epoch?.status]);

  if (err) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="text-sm text-red-600">{err}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Mine</h1>
            <div className="mt-1 text-sm text-zinc-700">
              Student: <code className="rounded bg-zinc-100 px-1">{me ?? "—"}</code>
            </div>
          </div>
          <div className="text-sm text-zinc-700">
            Epoch: <code className="rounded bg-zinc-100 px-1">{epoch?.id ?? "—"}</code>{" "}
            Status:{" "}
            <code className="rounded bg-zinc-100 px-1">{(epoch?.status as EpochStatus) ?? "—"}</code>{" "}
            Block:{" "}
            <code className="rounded bg-zinc-100 px-1">
              {typeof epoch?.blockNumber === "number" ? epoch.blockNumber : "—"}
            </code>
          </div>
        </div>

        <div className="mt-3 rounded-xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {status === "commit" ? (
            <div>
              Commit phase. Time left:{" "}
              <span className="font-mono">{commitLeftSec === null ? "—" : `${commitLeftSec}s`}</span>
            </div>
          ) : status === "reveal" ? (
            <div>
              Reveal phase. Time left:{" "}
              <span className="font-mono">{revealLeftSec === null ? "—" : `${revealLeftSec}s`}</span>
              {realtimeDrawWinner ? (
                <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
                  Round winner (realtime draw):{" "}
                  <code className="rounded bg-white px-1 font-mono">{realtimeDrawWinner}</code>
                  {typeof epoch?.blockNumber === "number" ? (
                    <span className="ml-2 text-sm text-emerald-800">
                      · Block <span className="font-mono">{epoch.blockNumber}</span>
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-zinc-500">
                  Winner appears here after the first valid, all-correct reveal triggers the draw.
                </div>
              )}
            </div>
          ) : status === "settled" ? (
            <div>
              Settled. A new epoch will be created automatically after this epoch’s reveal end time. If
              you’re demoing in class, you can click <b>Tick (dev)</b> and refresh.
              {realtimeDrawWinner ? (
                <div className="mt-2 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-800">
                  Round winner was:{" "}
                  <code className="rounded bg-white px-1 font-mono">{realtimeDrawWinner}</code>
                </div>
              ) : null}
            </div>
          ) : (
            <div>Loading epoch…</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => doCommit().catch((e) => setErr(String(e)))}
            disabled={status !== "commit"}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Commit
          </button>
          <button
            onClick={() => doReveal().catch((e) => setErr(String(e)))}
            disabled={status !== "reveal"}
            className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Reveal
          </button>
          <button
            onClick={() => doTick().catch((e) => setErr(String(e)))}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            title="Dev helper: advance phase / settle"
          >
            Tick (dev)
          </button>
        </div>

        {msg ? <div className="mt-3 text-sm text-emerald-700">{msg}</div> : null}
        {commitHash ? (
          <div className="mt-3 text-xs text-zinc-600">
            commitHash: <code className="break-all">{commitHash}</code>
          </div>
        ) : null}
        {salt ? (
          <div className="mt-1 text-xs text-zinc-600">
            salt: <code className="break-all">{salt}</code>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Questions</h2>
        <div className="mt-3 grid gap-4">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl border p-4">
              <div className="text-sm font-medium">{q.prompt}</div>
              {q.type === "mcq" ? (
                <div className="mt-3 grid gap-2">
                  {(q.options?.choices ?? []).map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={q.id}
                        value={c.id}
                        checked={answers[q.id] === c.id}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      />
                      <span className="font-mono">{c.id}</span>
                      <span>{c.text}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Your answer"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

