import { NextResponse } from "next/server";
import { tickAndSettle } from "@/lib/epoch";

export async function POST() {
  const result = await tickAndSettle();
  return NextResponse.json({ ok: true, result });
}

