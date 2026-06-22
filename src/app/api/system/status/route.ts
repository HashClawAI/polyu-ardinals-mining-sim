import { NextResponse } from "next/server";
import { getSystemState } from "@/lib/system";

export async function GET() {
  const state = await getSystemState();
  return NextResponse.json({
    ok: true,
    blockHeight: state.blockHeight,
    updatedAt: state.updatedAt,
  });
}

