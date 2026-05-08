"use client";

import { useEffect, useState } from "react";

export function BlockIndicator() {
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const res = await fetch("/api/system/status", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) return;
      if (!stop) setBlockHeight(json.blockHeight);
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

