-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EpochStatus" AS ENUM ('commit', 'reveal', 'settled');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq', 'short');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "answerKey" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Epoch" (
    "id" TEXT NOT NULL,
    "status" "EpochStatus" NOT NULL,
    "commitEndsAt" TIMESTAMP(3) NOT NULL,
    "revealEndsAt" TIMESTAMP(3) NOT NULL,
    "drandRound" INTEGER,
    "drandRandomness" TEXT,
    "drandSignature" TEXT,
    "drandBeaconId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Epoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commitHash" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reveal" (
    "id" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "salt" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reveal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardTx" (
    "id" TEXT NOT NULL,
    "epochId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardTx_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Epoch_status_commitEndsAt_idx" ON "Epoch"("status", "commitEndsAt");

-- CreateIndex
CREATE INDEX "Epoch_status_revealEndsAt_idx" ON "Epoch"("status", "revealEndsAt");

-- CreateIndex
CREATE INDEX "Assignment_userId_createdAt_idx" ON "Assignment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_epochId_userId_key" ON "Assignment"("epochId", "userId");

-- CreateIndex
CREATE INDEX "Commit_epochId_submittedAt_idx" ON "Commit"("epochId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_epochId_userId_key" ON "Commit"("epochId", "userId");

-- CreateIndex
CREATE INDEX "Reveal_epochId_isValid_isCorrect_idx" ON "Reveal"("epochId", "isValid", "isCorrect");

-- CreateIndex
CREATE INDEX "Reveal_userId_createdAt_idx" ON "Reveal"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reveal_epochId_userId_key" ON "Reveal"("epochId", "userId");

-- CreateIndex
CREATE INDEX "RewardTx_userId_createdAt_idx" ON "RewardTx"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardTx_epochId_createdAt_idx" ON "RewardTx"("epochId", "createdAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reveal" ADD CONSTRAINT "Reveal_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reveal" ADD CONSTRAINT "Reveal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTx" ADD CONSTRAINT "RewardTx_epochId_fkey" FOREIGN KEY ("epochId") REFERENCES "Epoch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardTx" ADD CONSTRAINT "RewardTx_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

