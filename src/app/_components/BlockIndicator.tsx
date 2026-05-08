"use client";

import { useEffect, useState } from "react";

export function BlockIndicator() {
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/system/status", { cache: "no-store" });
        const text = await res.text();
        if (!res.ok) return;
        if (!text) return;

        // During dev/hot-reload we may momentarily receive non-JSON (e.g. HTML error page).
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) return;

        const json = JSON.parse(text) as { blockHeight?: number };
        if (!stop && typeof json.blockHeight === "number") setBlockHeight(json.blockHeight);
      } catch {
        // ignore transient errors; we'll retry on interval
      }
    }
    load();
    const t = window.setInterval(load, 1000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div className="rounded-full border bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
      Block: <span className="font-mono">{blockHeight ?? "—"}</span>
    </div>
  );
}

