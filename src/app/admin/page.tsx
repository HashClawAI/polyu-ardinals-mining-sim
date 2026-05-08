"use client";

import { useMemo, useState } from "react";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
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

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-zinc-700">
          输入 <code className="rounded bg-zinc-100 px-1">ADMIN_KEY</code> 后可导入题库、手动 tick/settle。
        </p>
        <div className="mt-3">
          <label className="text-sm font-medium">ADMIN_KEY</label>
          <input
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="dev-admin"
          />
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6">
        <h2 className="font-semibold">Import questions (JSON)</h2>
        <textarea
          className="mt-3 h-64 w-full rounded-xl border p-3 font-mono text-xs"
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
        />
        <div className="mt-3 flex gap-3">
          <button
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => doImport()}
          >
            Import
          </button>
          <button className="rounded-xl border px-4 py-2 text-sm font-medium" onClick={() => doTick()}>
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

