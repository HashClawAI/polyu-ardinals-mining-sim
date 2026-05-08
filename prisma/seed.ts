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

    // --- General knowledge (跨学科) ---
    {
      type: "mcq" as const,
      prompt: "下列哪个现象最直接体现了“机会成本”的概念？",
      options: {
        choices: [
          { id: "A", text: "买一送一" },
          { id: "B", text: "选择读研而放弃全职工作收入" },
          { id: "C", text: "物价上涨" },
          { id: "D", text: "企业减税" },
        ],
      },
      answerKey: "B",
      tags: ["economics"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "在统计学里，p-value 更接近表达什么？",
      options: {
        choices: [
          { id: "A", text: "原假设为真的概率" },
          { id: "B", text: "在原假设为真时，观测到当前或更极端数据的概率" },
          { id: "C", text: "备择假设为真的概率" },
          { id: "D", text: "样本均值的期望" },
        ],
      },
      answerKey: "B",
      tags: ["statistics"],
      difficulty: 2,
    },
    {
      type: "mcq" as const,
      prompt: "下列哪个属于“无监督学习”的典型任务？",
      options: {
        choices: [
          { id: "A", text: "垃圾邮件分类" },
          { id: "B", text: "图像分类（有标签）" },
          { id: "C", text: "K-means 聚类" },
          { id: "D", text: "情感分析（有标签）" },
        ],
      },
      answerKey: "C",
      tags: ["ml"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "在网络中，HTTPS 的主要安全目标不包括哪一项？",
      options: {
        choices: [
          { id: "A", text: "机密性（加密）" },
          { id: "B", text: "完整性（防篡改）" },
          { id: "C", text: "身份认证（证书）" },
          { id: "D", text: "保证对方不会说谎（绝对真实）" },
        ],
      },
      answerKey: "D",
      tags: ["security", "network"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "“薛定谔的猫”思想实验最常用于讨论量子力学中的哪个概念？",
      options: {
        choices: [
          { id: "A", text: "叠加态与测量问题" },
          { id: "B", text: "相对论时间膨胀" },
          { id: "C", text: "热力学第二定律" },
          { id: "D", text: "经典力学守恒" },
        ],
      },
      answerKey: "A",
      tags: ["physics"],
      difficulty: 2,
    },
    {
      type: "mcq" as const,
      prompt: "DNA 的四种碱基不包括哪一个？",
      options: {
        choices: [
          { id: "A", text: "Adenine (A)" },
          { id: "B", text: "Thymine (T)" },
          { id: "C", text: "Cytosine (C)" },
          { id: "D", text: "Uracil (U)" },
        ],
      },
      answerKey: "D",
      tags: ["biology"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "下列哪个是“微积分基本定理”连接的两件事？",
      options: {
        choices: [
          { id: "A", text: "导数与积分" },
          { id: "B", text: "矩阵与向量" },
          { id: "C", text: "概率与统计" },
          { id: "D", text: "逻辑与集合" },
        ],
      },
      answerKey: "A",
      tags: ["math"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "“囚徒困境”最经典地说明了什么？",
      options: {
        choices: [
          { id: "A", text: "完全竞争市场会失灵" },
          { id: "B", text: "个体理性可能导致集体非最优" },
          { id: "C", text: "资本积累必然导致通胀" },
          { id: "D", text: "随机过程不可预测" },
        ],
      },
      answerKey: "B",
      tags: ["game-theory", "economics"],
      difficulty: 2,
    },
    {
      type: "mcq" as const,
      prompt: "下列哪个不是常见的 OSI 七层模型层级？",
      options: {
        choices: [
          { id: "A", text: "物理层" },
          { id: "B", text: "会话层" },
          { id: "C", text: "加密层" },
          { id: "D", text: "应用层" },
        ],
      },
      answerKey: "C",
      tags: ["network"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "在编程语言里，“栈溢出”通常与什么最相关？",
      options: {
        choices: [
          { id: "A", text: "无限递归或深递归调用" },
          { id: "B", text: "数据库死锁" },
          { id: "C", text: "DNS 解析失败" },
          { id: "D", text: "硬盘碎片" },
        ],
      },
      answerKey: "A",
      tags: ["cs"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "“纳什均衡”最准确的描述是哪一个？",
      options: {
        choices: [
          { id: "A", text: "所有人收益都最大化" },
          { id: "B", text: "在他人策略既定时，任何人都不想单方面改变策略" },
          { id: "C", text: "所有人采取合作策略" },
          { id: "D", text: "系统达到帕累托最优" },
        ],
      },
      answerKey: "B",
      tags: ["game-theory"],
      difficulty: 2,
    },
    {
      type: "mcq" as const,
      prompt: "在化学中，pH = 7 通常表示什么？",
      options: { choices: [
        { id: "A", text: "强酸性" },
        { id: "B", text: "弱酸性" },
        { id: "C", text: "中性" },
        { id: "D", text: "强碱性" },
      ]},
      answerKey: "C",
      tags: ["chemistry"],
      difficulty: 1,
    },
    {
      type: "mcq" as const,
      prompt: "信息论里，bit（比特）最常用来度量什么？",
      options: {
        choices: [
          { id: "A", text: "能量" },
          { id: "B", text: "信息量/不确定性（熵）" },
          { id: "C", text: "速度" },
          { id: "D", text: "电阻" },
        ],
      },
      answerKey: "B",
      tags: ["information-theory"],
      difficulty: 2,
    },
    {
      type: "mcq" as const,
      prompt: "在金融里，“分散化”最直接想降低的是什么？",
      options: {
        choices: [
          { id: "A", text: "系统性风险" },
          { id: "B", text: "非系统性风险" },
          { id: "C", text: "通货膨胀" },
          { id: "D", text: "利率风险" },
        ],
      },
      answerKey: "B",
      tags: ["finance"],
      difficulty: 2,
    },
    {
      type: "short" as const,
      prompt: "写出一个你知道的“NP 完全”问题名称（英文或中文均可）。",
      options: null,
      answerKey: "traveling salesman",
      tags: ["cs", "complexity"],
      difficulty: 3,
    },
    {
      type: "short" as const,
      prompt: "写出 3 个全球常见的温室气体（任意 3 个，用逗号分隔）。",
      options: null,
      answerKey: "CO2,CH4,N2O",
      tags: ["environment"],
      difficulty: 2,
    },
    {
      type: "short" as const,
      prompt: "用一句话解释“均值回归”（Mean reversion）。",
      options: null,
      answerKey: "tends to return",
      tags: ["statistics", "finance"],
      difficulty: 3,
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
        tags: Array.from(new Set([...(q.tags ?? []), "seed"])),
        difficulty: q.difficulty ?? 1,
        active: true,
      },
    });
    createdCount += 1;
  }

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

