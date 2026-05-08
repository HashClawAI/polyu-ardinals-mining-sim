## PolyU Ardinals Mining Sim

教学用“模拟挖矿”网站：学生用学号登录（学号=公钥标识），按 epoch 回合制执行 commit→reveal→可验证随机开奖→发币。

规则说明见 `docs/rules.md`。

## Getting Started

### 1) Start Postgres (local)

你有两种方式启动本地 Postgres（二选一）。

#### Option A: Docker (推荐)

需要本机安装 Docker Desktop（或任意兼容 Docker 的运行时）。启动数据库：

```bash
docker compose up -d
```

#### Option B: Prisma Dev (不依赖 Docker)

```bash
npx prisma dev --name polyu_ardi_sim --detach
```

### 2) Configure env

复制环境变量：

```bash
cp .env.example .env
```

若你选择 Prisma Dev，请运行 `npx prisma dev ls` 并把列表里 `TCP` 的连接串填到 `.env` 的 `DATABASE_URL`。

### 3) Initialize DB schema

```bash
npx prisma migrate dev
```

### 4) Run dev server

```bash
npm run dev
```

打开 `http://localhost:3000`。

## Tech

- Next.js (App Router) + Tailwind
- Postgres + Prisma
- Randomness: drand (用于可验证开奖)

## Notes

- 本项目默认不提交 `.env`（见 `.gitignore`）。请通过 `.env.example` 管理配置模板。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
