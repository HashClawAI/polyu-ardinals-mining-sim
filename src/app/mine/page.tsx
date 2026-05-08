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
      }
    }
    load().catch((e) => setErr(e instanceof Error ? e.message : "UNKNOWN"));
    return () => {
      stop = true;
    };
  }, []);

  const payload = useMemo(() => ({ answers }), [answers]);

  async function doCommit() {
    setErr(null);
    setMsg(null);
    if (!me) throw new Error("NOT_LOGGED_IN");
    if (!epoch) throw new Error("NO_EPOCH");

    const secret = getClientSecret(me);
    const s = await deriveSalt(secret, epoch.id);
    const payloadStr = stableStringify(payload);
    const h = await sha256HexAsync(`${payloadStr}${s}${me}`);

    setSalt(s);
    setCommitHash(h);

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
    if (!salt) throw new Error("MISSING_SALT (commit first on this device)");

    const res = await fetch("/api/mine/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload, salt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "REVEAL_FAILED");
    setMsg("Revealed.");
  }

  async function doTick() {
    const res = await fetch("/api/cron/tick", { method: "POST" });
    const data = await res.json();
    setMsg(`Tick: ${JSON.stringify(data.result)}`);
    // refresh epoch
    const e2 = await fetch("/api/epoch/current").then((r) => r.json());
    setEpoch(e2.epoch);
  }

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
            <code className="rounded bg-zinc-100 px-1">{(epoch?.status as EpochStatus) ?? "—"}</code>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => doCommit().catch((e) => setErr(String(e)))}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          >
            Commit
          </button>
          <button
            onClick={() => doReveal().catch((e) => setErr(String(e)))}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
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

