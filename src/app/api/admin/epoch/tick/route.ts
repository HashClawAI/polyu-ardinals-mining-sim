import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { tickAndSettle } from "@/lib/epoch";

export async function POST() {
  try {
    await requireAdmin();
    const result = await tickAndSettle();
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

