import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_MISSING");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const questions = [
    {
      type: "mcq" as const,
      prompt: "Commit-Reveal 机制中，commit 阶段提交的主要内容是什么？",
      options: {
        choices: [
          { id: "A", text: "明文答案" },
          { id: "B", text: "答案的哈希（含 salt）" },
          { id: "C", text: "开奖随机数" },
          { id: "D", text: "代币转账签名" },
        ],
      },
      answerKey: "B",
      tags: ["crypto", "commit-reveal"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "为什么 commit-reveal 能降低“开奖前改答案”的行为？",
      options: {
        choices: [
          { id: "A", text: "因为提交时就公开了答案" },
          { id: "B", text: "因为 commit 锁定了答案，reveal 必须匹配 commit" },
          { id: "C", text: "因为服务器会随机改答案" },
          { id: "D", text: "因为题目会消失" },
        ],
      },
      answerKey: "B",
      tags: ["crypto", "commit-reveal"],
      difficulty: 1,
    },
    {
      type: "short" as const,
      prompt: "给出一个可验证随机源的例子（填名称即可）。",
      options: null,
      answerKey: "drand",
      tags: ["randomness"],
      difficulty: 1,
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: {
        type: q.type,
        prompt: q.prompt,
        options: q.options as any,
        answerKey: q.answerKey,
        tags: q.tags,
        difficulty: q.difficulty,
        active: true,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${questions.length} questions`);
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

