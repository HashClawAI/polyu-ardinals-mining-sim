import { headers } from "next/headers";

export async function requireAdmin() {
  const h = await headers();
  const key = h.get("x-admin-key") ?? "";
  const expected = process.env.ADMIN_KEY ?? "";
  if (!expected || key !== expected) throw new Error("FORBIDDEN");
}

