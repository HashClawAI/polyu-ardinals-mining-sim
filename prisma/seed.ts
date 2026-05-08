import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_MISSING");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, {
  statementNameGenerator: (q) => {
    // seeding is one-shot; unique names avoid collisions
    const paramsLen = Array.isArray(q.args) ? q.args.length : 0;
    return `seed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${paramsLen}`;
  },
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Switch the active bank to simple math for classroom demo.
  const questions = [
    {
      type: "mcq" as const,
      prompt: "7 + 8 = ?",
      options: { choices: [
        { id: "A", text: "14" },
        { id: "B", text: "15" },
        { id: "C", text: "16" },
        { id: "D", text: "17" },
      ]},
      answerKey: "B",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "12 − 5 = ?",
      options: { choices: [
        { id: "A", text: "5" },
        { id: "B", text: "6" },
        { id: "C", text: "7" },
        { id: "D", text: "8" },
      ]},
      answerKey: "C",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "6 × 7 = ?",
      options: { choices: [
        { id: "A", text: "40" },
        { id: "B", text: "41" },
        { id: "C", text: "42" },
        { id: "D", text: "49" },
      ]},
      answerKey: "C",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "81 ÷ 9 = ?",
      options: { choices: [
        { id: "A", text: "7" },
        { id: "B", text: "8" },
        { id: "C", text: "9" },
        { id: "D", text: "10" },
      ]},
      answerKey: "C",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "若 x + 3 = 10，则 x = ?",
      options: { choices: [
        { id: "A", text: "6" },
        { id: "B", text: "7" },
        { id: "C", text: "8" },
        { id: "D", text: "9" },
      ]},
      answerKey: "B",
      tags: ["math-basic", "algebra"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "若 2x = 18，则 x = ?",
      options: { choices: [
        { id: "A", text: "7" },
        { id: "B", text: "8" },
        { id: "C", text: "9" },
        { id: "D", text: "10" },
      ]},
      answerKey: "C",
      tags: ["math-basic", "algebra"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "3^2 = ?",
      options: { choices: [
        { id: "A", text: "6" },
        { id: "B", text: "8" },
        { id: "C", text: "9" },
        { id: "D", text: "12" },
      ]},
      answerKey: "C",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "√49 = ?",
      options: { choices: [
        { id: "A", text: "6" },
        { id: "B", text: "7" },
        { id: "C", text: "8" },
        { id: "D", text: "9" },
      ]},
      answerKey: "B",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "short" as const,
      prompt: "计算：25 + 17 = ?（只填数字）",
      options: null,
      answerKey: "42",
      tags: ["math-basic"],
      difficulty: 1,
    },
    {
      type: "short" as const,
      prompt: "计算：100 − 37 = ?（只填数字）",
      options: null,
      answerKey: "63",
      tags: ["math-basic"],
      difficulty: 1,
    },
  ];

  // Avoid duplicates on repeated seeding: use (prompt, answerKey) as a soft identity.
  const existing = await prisma.question.findMany({
    where: { prompt: { in: questions.map((q) => q.prompt) } },
    select: { prompt: true, answerKey: true },
  });
  const seen = new Set(existing.map((e) => `${e.prompt}||${e.answerKey}`));

  let createdCount = 0;
  for (const q of questions) {
    const key = `${q.prompt}||${q.answerKey}`;
    if (seen.has(key)) continue;
    await prisma.question.create({
      data: {
        type: q.type,
        prompt: q.prompt,
        options: (q.options ?? null) as any,
        answerKey: q.answerKey,
        tags: Array.from(new Set([...(q.tags ?? []), "seed", "math-bank"])),
        difficulty: q.difficulty ?? 1,
        active: true,
      },
    });
    createdCount += 1;
  }

  // Disable non-math seeded questions so assignments only pick math in class.
  await prisma.question.updateMany({
    where: {
      tags: { has: "seed" },
      NOT: { tags: { has: "math-bank" } },
    },
    data: { active: false },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded ${createdCount} new questions (total input ${questions.length})`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

