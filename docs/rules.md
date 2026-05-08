# PolyU Ardinals Mining Sim — Rules

本网站是一个“类 Ardinals”的**教学版模拟挖矿**：不拼算力，按回合提交承诺（commit），再公开答案（reveal），最后用**可验证随机数**抽奖发放代币奖励。

## Identity / Keys

- **登录**：学生输入学号 `studentId` 直接登录（学号视作“公钥”标识）。
- **后缀私钥/secret**：首次登录时浏览器生成并保存一个随机 `clientSecret`（仅存本机）。\n  - `clientSecret` 用于派生每个回合的 `salt`，从而生成 commit。\n  - 服务器不保存 `clientSecret`，也无法从 commit 反推出答案。

## Epoch (回合制)

- 全站统一回合 `epochId`，回合有三个状态：
  - `commit`：提交承诺（hash）窗口
  - `reveal`：公开答案 + salt 窗口
  - `settled`：开奖结算完成
- 推荐时长（可配置）：\n  - `commit` 2–3 分钟\n  - `reveal` 1–2 分钟\n  - 回合总长 3–5 分钟

## Questions (题目抽取)

- 每个回合，每个参与者随机分配 **1–3 题**（从题库按启用/难度/tag 抽取）。
- 题目只展示给该参与者，用于降低“直接抄答案”的收益（不追求强防作弊）。

## Commit (承诺提交)

- 参与者在 `commit` 窗口提交：\n  - `commitHash = H(answerPayload + salt + studentId)`\n- `H` 使用同一种哈希算法（实现中固定一种，例如 `sha256`）。\n- `answerPayload`：对本回合被分配题目的作答（建议规范化 JSON 串，保证顺序一致）。\n- `salt`：客户端派生（示例）：\n  - `salt = H(clientSecret + epochId + nonce)`\n  - `nonce` 为本回合内提交计数或随机值（用于防止 salt 重复）。\n\n> 直观含义：先把答案“锁定”，但不泄露答案内容。

## Reveal (公开答案)

- 进入 `reveal` 窗口后，参与者提交：\n  - `answerPayload`（明文）\n  - `salt`\n- 服务器验证：\n  - `H(answerPayload + salt + studentId) == commitHash`\n  - 且 `answerPayload` 的答案正确\n- 通过验证者进入候选池 `candidates`。

## Draw (开奖 / 可验证随机)

- 使用公开可验证随机源 **drand**（League of Entropy）作为随机数：\n  - 记录 `drandRound`、`randomness`、`signature`（及 chain info）\n- 抽签方式（可复算）：\n  - 对候选者列表按稳定顺序排序（例如按 `userId` 升序）\n  - `winnerIndex = (int(H(randomness + epochId + questionId)) mod candidates.length)`\n  - 对每个题目（或每个回合）抽取 1 个赢家\n\n> 任何学生都可以用公开 drand 数据 + 候选者排序规则复算中奖结果。

## Rewards (奖励)

- 赢家获得 `X` 代币（可配置）。\n- 可选：答对但未中奖者获得少量参与分 `Y`（用于鼓励参与）。\n- 限制：每个 `epoch` 每个用户最多获得 `maxRewardsPerEpoch` 次奖励（默认 1）防止刷题。

## Edge cases / constraints

- **无密码登录**：存在冒用学号风险；本系统以课堂演示为主，不保证强身份。\n- **超时**：错过 `reveal` 的 commit 视为无效（不进候选池）。\n- **多开**：允许同一学号多设备登录会影响公平（实现上可做“最后登录设备优先”或软提示）。\n- **题库泄露**：题目本身并非机密；commit-reveal 的教学重点在“承诺机制”和“可验证随机开奖”。\n+
