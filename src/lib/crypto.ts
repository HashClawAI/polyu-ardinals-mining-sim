import crypto from "node:crypto";

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hexToBigInt(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return BigInt(`0x${clean || "0"}`);
}

