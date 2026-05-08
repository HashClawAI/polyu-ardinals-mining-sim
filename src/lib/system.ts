import { prisma } from "@/lib/prisma";

const SYSTEM_ID = "global";

export async function getSystemState() {
  return await prisma.systemState.upsert({
    where: { id: SYSTEM_ID },
    update: {},
    create: { id: SYSTEM_ID, blockHeight: 0 },
  });
}

export async function resetSystemState() {
  return await prisma.systemState.upsert({
    where: { id: SYSTEM_ID },
    update: { blockHeight: 0 },
    create: { id: SYSTEM_ID, blockHeight: 0 },
  });
}

