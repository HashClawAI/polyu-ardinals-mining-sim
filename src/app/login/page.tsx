"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { lsKey } from "@/lib/constants";

function getOrCreateClientSecret(studentId: string) {
  const key = lsKey.clientSecret(studentId);
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  localStorage.setItem(key, secret);
  return secret;
}

export default function LoginPage() {
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const normalized = useMemo(() => studentId.trim(), [studentId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId: normalized }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "LOGIN_FAILED");

      // Generate client secret (local only)
      getOrCreateClientSecret(normalized);

      router.push("/mine");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "UNKNOWN");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-2xl border bg-white p-6">
      <h1 className="text-xl font-semibold">Login</h1>
      <p className="mt-2 text-sm text-zinc-700">
        输入学号登录。浏览器会为该学号生成一个本机保存的 secret，用于派生 commit salt。
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-900">Student ID</label>
        <input
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          placeholder="e.g. 22012345"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200"
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <button
          disabled={loading || normalized.length < 3}
          className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

