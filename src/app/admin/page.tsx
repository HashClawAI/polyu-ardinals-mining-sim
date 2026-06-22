"use client";

import { useMemo, useState } from "react";

type RuntimeConfig = {
  epochCommitSeconds: number;
  epochRevealSeconds: number;
  questionsMinPerRound: number;
  questionsMaxPerRound: number;
  assignmentDifficultyMin: number;
  assignmentDifficultyMax: number;
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [runtime, setRuntime] = useState<RuntimeConfig | null>(null);
  const [importJson, setImportJson] = useState(
    JSON.stringify(
      {
        questions: [
          {
            type: "mcq",
            prompt: "1 + 1 = ?",
            options: { choices: [{ id: "A", text: "1" }, { id: "B", text: "2" }] },
            answerKey: "B",
            tags: ["demo"],
            difficulty: 1,
            active: true,
          },
          {
            type: "mcq",
            prompt: "一块长 8、宽 5 的长方形铁板，周长是？",
            options: {
              choices: [
                { id: "A", text: "13" },
                { id: "B", text: "26" },
                { id: "C", text: "40" },
                { id: "D", text: "52" },
              ],
            },
            answerKey: "B",
            tags: ["math-bank"],
            difficulty: 2,
            active: true,
          },
        ],
      },
      null,
      2,
    ),
  );
  const [out, setOut] = useState<string>("");

  const headers = useMemo(
    () => ({
      "content-type": "application/json",
      "x-admin-key": adminKey,
    }),
    [adminKey],
  );

  const configHeaders = useMemo(
    () => ({
      "x-admin-key": adminKey,
    }),
    [adminKey],
  );

  async function loadRuntime() {
    setOut("");
    const res = await fetch("/api/admin/config", { headers: configHeaders });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
    if (json.ok && json.config) {
      const c = json.config;
      setRuntime({
        epochCommitSeconds: c.epochCommitSeconds,
        epochRevealSeconds: c.epochRevealSeconds,
        questionsMinPerRound: c.questionsMinPerRound,
        questionsMaxPerRound: c.questionsMaxPerRound,
        assignmentDifficultyMin: c.assignmentDifficultyMin,
        assignmentDifficultyMax: c.assignmentDifficultyMax,
      });
    }
  }

  async function saveRuntime() {
    if (!runtime) return;
    setOut("");
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers,
      body: JSON.stringify(runtime),
    });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
    if (json.ok && json.config) {
      setRuntime({
        epochCommitSeconds: json.config.epochCommitSeconds,
        epochRevealSeconds: json.config.epochRevealSeconds,
        questionsMinPerRound: json.config.questionsMinPerRound,
        questionsMaxPerRound: json.config.questionsMaxPerRound,
        assignmentDifficultyMin: json.config.assignmentDifficultyMin,
        assignmentDifficultyMax: json.config.assignmentDifficultyMax,
      });
    }
  }

  async function doImport() {
    setOut("");
    const res = await fetch("/api/admin/questions/import", {
      method: "POST",
      headers,
      body: importJson,
    });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
  }

  async function doTick() {
    setOut("");
    const res = await fetch("/api/admin/epoch/tick", { method: "POST", headers });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
  }

  async function doInitSystem() {
    setOut("");
    const res = await fetch("/api/admin/system/init", { method: "POST", headers });
    const json = await res.json();
    setOut(JSON.stringify(json, null, 2));
  }

  function field<K extends keyof RuntimeConfig>(key: K, label: string, help: string) {
    if (!runtime) return null;
    return (
      <div>
        <label className="text-sm font-medium">{label}</label>
        <input
          type="number"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
          min={key.includes("Difficulty") ? 1 : key.includes("Seconds") ? 10 : 1}
          max={key.includes("Difficulty") ? 10 : key.includes("Seconds") ? 86400 : 20}
          value={runtime[key]}
          onChange={(e) =>
            setRuntime({ ...runtime, [key]: Math.floor(Number(e.target.value)) || 0 })
          }
        />
        <p className="mt-1 text-xs text-zinc-500">{help}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-zinc-700">
          输入 <code className="rounded bg-zinc-100 px-1">ADMIN_KEY</code>（服务端环境变量）后可用下方功能：集中调整
          epoch 时长、抽题难度与题量、题库导入、手动 tick。
        </p>
        <div className="mt-3">
          <label className="text-sm font-medium">ADMIN_KEY</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="与服务器 .env 中一致"
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Runtime configuration（运行时参数）</h2>
        <p className="mt-2 text-sm text-zinc-700">
          保存后：<b>下一轮起新建的 epoch</b>使用新的 Commit / Reveal 秒数；学生被分配的题目从{" "}
          <b>启用中且 difficulty 落在区间内</b>的题库随机抽取（区间内无题则退回「全部启用题」）。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => loadRuntime()}
          >
            Load current
          </button>
          <button
            type="button"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => saveRuntime()}
            disabled={!runtime}
          >
            Save
          </button>
        </div>
        {runtime ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {field(
              "epochCommitSeconds",
              "Commit phase (seconds)",
              "每轮「承诺」阶段时长，仅对未来新创建的 epoch 生效（10–86400）。",
            )}
            {field(
              "epochRevealSeconds",
              "Reveal phase (seconds)",
              "每轮「公开答案」阶段时长，同样只作用于之后创建的 epoch（10–86400）。",
            )}
            {field(
              "questionsMinPerRound",
              "Questions per student (min)",
              "每名学生在当轮可被分配的最少题目数（1–20）。",
            )}
            {field(
              "questionsMaxPerRound",
              "Questions per student (max)",
              "最多题目数（1–20），须 ≥ min；实际题数为区间内随机整数。",
            )}
            {field(
              "assignmentDifficultyMin",
              "Question difficulty min",
              "抽题池中 difficulty 下限（1–10），题库导入时可标 1=最易。",
            )}
            {field(
              "assignmentDifficultyMax",
              "Question difficulty max",
              "difficulty 上限（1–10），须 ≥ min；与 min 交集内无启用题时使用全部启用题兜底。",
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">请先填写 ADMIN_KEY，再点 Load current。</p>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">System init</h2>
        <p className="mt-2 text-sm text-zinc-700">
          将全局 <b>Block</b> 计数重置为 0，并清空 epoch/commit/reveal/reward 等运行数据；<b>
            AppConfig（本页运行时参数）
          </b>与<b>题库</b>会保留。
        </p>
        <div className="mt-3">
          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => doInitSystem()}
          >
            Initialize system (reset block=0)
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Import questions (JSON)</h2>
        <p className="mt-2 text-xs text-zinc-600">
          每题可设置 <code className="rounded bg-zinc-100 px-0.5">difficulty</code>：整数 1（最易）～
          10；与 Runtime 里的难度区间配合使用。<code className="rounded bg-zinc-100 px-0.5">tags</code>便于分类，
          <code className="rounded bg-zinc-100 px-0.5">active</code>控制是否参与抽题。
        </p>
        <textarea
          className="mt-3 h-64 w-full rounded-xl border p-3 font-mono text-xs"
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => doImport()}
          >
            Import
          </button>
          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
            onClick={() => doTick()}
          >
            Tick / Settle
          </button>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Output</h2>
        <pre className="mt-3 overflow-auto rounded-xl border bg-zinc-50 p-3 text-xs">{out || "—"}</pre>
      </section>
    </div>
  );
}
