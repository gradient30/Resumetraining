# 健康恢复阶段性训练 — Resumetraining

久坐办公人士的颈肩腰腹日常训练，术后一年循序渐进的 8 周方案。手机优先的单页应用，带存储：建档、每日打卡、腰围记录、疼痛评分。

> **这不是专家会诊，也不是个人处方。** 本方案是对照 NICE NG59、WHO 2023、WHO 2020 与 Cochrane 椎间盘突出术后康复综述（CD003007）做的文献审核（2026-11-16），具体组数、次数是按指南原则翻译的实用起点，不是哪条指南直接规定的。基线评估、McGill 改良卷腹、任何负重铰链/深蹲/提重物，都要线下康复师看过之后才能定。出现红旗症状（大小便、会阴麻木、双腿无力等）立即就医。

## 适用人群（本项目按此人建档）

- 成年男性，76kg、180cm，BMI 23.5，体重标准，重点是减腰腹脂肪（按腰围算，不按体重算）
- 长期坐办公室，日常极少运动
- 腰 5 骶 1 椎间盘突出微创手术，术后 1 年，术后 1 个月已恢复上班，医生已建议早该开始锻炼
- 作息：07:00 起床，20:30 到家

## 功能

- **引导建档（首次使用）**：3 步——① 基础情况（年龄、腰围、身高体重预填 180cm/76kg、睡眠、久坐时长、日均步数）② 症状筛查（当前腰痛 0–10 分、腿痛/腿麻/腿无力，NICE 红旗筛查，勾中任何一项不进训练、先提示就医）③ 基线与偏好（单腿站、靠墙静蹲 60–70° 两个低风险自测，每天可练时间、器械、优先部位）。填完自动定起始阶段。
- **阶段自动分配**：单腿站 ≥30 秒、靠墙静蹲 ≥60 秒、腰痛 ≤3 分、无腿部症状 → 从第 2 阶段开始；其余从第 1 阶段起步。第 3 阶段不靠问卷进，要靠两周打卡、疼痛都在 3 分以下才能升级。
- **每日打卡**：晨间、微休息次数、核心、步行分钟、睡前拉伸，0–10 分疼痛评分，选完按 24 小时规则给继续/减量/停练反馈，备注。
- **腰围记录**：每周同一时间、肚脐同一位置量，自动画趋势线，标 NHS 94/102 cm 参考线，显示较首次变化。局部减脂做不到，目标是腰围慢慢下来，一般 4–12 周见变化。
- **8 周分阶段计划**：第 1–2 周适应期、第 3–4 周建立期、第 5–8 周进阶期，剂量随阶段切换；动作库 22 个动作，全部用手绘 SVG 拟人示意图（无真人照片、无外部图片链接，避免版权问题）。
- **呼吸跟练器**：吸 4 – 屏 2 – 呼 6。
- **红旗信号、24 小时进阶规则、坐姿工位建议**：每 30 分钟起来走 2–3 分钟，每小时争取 5–10 分钟。
- **不做的动作**：仰卧起坐、卷腹、负重弯腰、负重扭转、突然发力、高冲击跑跳。

## 技术栈

- 前端：Vite + React 18 + TypeScript，手机优先单页应用，中文界面
- 后端：Cloudflare Workers（`src/worker.ts`，无框架，直接处理 `/api/*`，其余路径回退到静态资源）
- 数据库：Cloudflare D1（SQLite），表：`profiles`、`check_ins`、`waist_entries`，迁移在 `migrations/0001_init.sql`
- 离线备用：部署前 / API 不可用时用 localStorage 兜底；部署后 D1 是唯一可信来源
- 部署：GitHub Actions（`.github/workflows/deploy.yml`），推到 `main` 即自动跑 D1 迁移并部署到 Cloudflare

## 本地运行

```bash
npm install
npm run dev        # http://localhost:5173，/api 会代理到本地 Worker（需另开 wrangler）
npm run build      # 生成 dist/
```

本地预览 Worker（含 D1 本地库）：

```bash
npx wrangler dev
```

## 部署到 Cloudflare（首次，约 10 分钟）

1. 创建 D1 数据库（只需一次）：
   ```bash
   npx wrangler d1 create resumetraining-db
   ```
   把输出里的 `database_id` 填进 `wrangler.toml` 的 `<YOUR_D1_DATABASE_ID>`，并跑一次本地迁移：
   ```bash
   npx wrangler d1 migrations apply resumetraining-db --local
   ```
2. 在 GitHub 仓库 Settings → Secrets and variables → Actions 里加两个 Secrets：
   - `CLOUDFLARE_API_TOKEN`：Cloudflare 后台 → My Profile → API Tokens → Create Token，用 **Edit Cloudflare Workers** 模板；不要把 token 写进任何文件
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 后台右侧 Account ID
3. 推到 `main` 分支，GitHub Actions 会自动：`npm ci` → `npm run build` → `wrangler d1 migrations apply --remote` → `wrangler deploy`。
4. 部署后打开 Cloudflare 给的 `*.workers.dev` 地址，第一次打开先完成建档向导。

免费级够用：D1 免费 5GB、每天 500 万次读；Workers 每天 10 万次请求；个人使用远不到上限。KV、R2 不是必需的，本项目没用到。

## 文件结构

```
Resumetraining/
├── .github/workflows/deploy.yml   # 推 main 自动部署 + D1 迁移
├── migrations/0001_init.sql       # profiles / check_ins / waist_entries
├── src/
│   ├── App.tsx                    # 今日 / 计划 / 记录 / 档案 四个标签页
│   ├── data.ts                    # 动作、剂量、阶段、红旗、24 小时规则
│   ├── api.ts                     # D1 API + localStorage 兜底
│   ├── svg.tsx                    # 手绘 SVG 拟人示意图
│   ├── worker.ts                  # Cloudflare Worker：/api/* + 静态资源回退
│   ├── main.tsx / index.css
│   └── components/
│       ├── Onboarding.tsx         # 3 步建档向导 + 红旗拦截
│       ├── CheckIn.tsx            # 每日打卡 + 疼痛反馈
│       ├── Waist.tsx              # 腰围趋势图（94/102 cm 参考线）
│       └── Breathing.tsx          # 呼吸跟练器
├── wrangler.toml                  # Workers + 静态资源 + D1 绑定
└── README.md
```

## 来源

- NICE NG59 — Low back pain and sciatica in over 16s（2016，2026-07-29 更新）
- WHO 2023 — 慢性原发性腰痛非手术管理指南；WHO 2020 — 体力活动与久坐行为指南
- Cochrane CD003007 — 椎间盘突出术后康复（证据至 2013 年，低至极低质量）
- NASS 2012 — 腰椎间盘突出伴神经根病指南（无足够证据推荐特定理疗方案）
- 完整审核报告见原研究目录（不随本仓库发布）：`research_notes/lumbar-recovery-exercise-audit-20261116-0508/report.md`
