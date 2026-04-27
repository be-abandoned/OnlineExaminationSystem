# Online Examination System — 项目介绍（给 Codex / 下一位开发者）

## 1. 项目概览

这是一个在线考试系统，包含三类角色：
- 学生：查看被分配的考试、作答、交卷、查看结果、查看公告
- 教师：题库管理、组卷发布、阅卷与发布成绩、发布公告
- 管理员：用户管理、班级管理、统计

项目已部署到 Vercel，并以 Supabase（Postgres + Auth）为唯一数据源。

## 2. 技术栈

**前端**
- React + TypeScript + Vite
- 路由：`react-router-dom`（History 模式）
- 状态：Zustand
- UI：Tailwind CSS

**后端**
- Vercel Serverless Functions（`/api/*`）
- Node.js（ESM）

**数据库**
- Supabase Postgres
- Supabase Auth：负责注册/登录与 Session 令牌

## 3. 目录结构（关键）

- `src/`：前端代码
  - `src/pages/`：页面（student/teacher/admin/auth）
  - `src/utils/remoteApi.ts`：前端统一数据访问层（只应调用 `/api/*`，并做 DTO 映射）
  - `src/lib/supabase.ts`：浏览器端 Supabase client（anon key）
  - `src/stores/authStore.ts`：登录态（Zustand persist）
- `api/`：Vercel Functions（生产后端）
  - `api/login.js`：保留的登录辅助（当前业务主要走 Supabase Auth）
  - `api/health.js`：健康检查
  - `api/admin.js`：管理员聚合接口
  - `api/teacher.js`：教师聚合接口
  - `api/student.js`：学生聚合接口
- `server/`：服务端共享模块（被 `/api/*` 引用）
  - `server/supabase.js`：service role 的 Supabase admin client + assertAdmin/Teacher/Student
  - `server/authIdentity.js`：将 `(role, schoolNo)` 映射为 Auth Email 的规则
- `supabase/`
  - `supabase/schema.sql`：数据库建表 + 触发器（UUID 版本，含旧字段兼容迁移）
  - `supabase/rls.sql`：RLS 策略（admin/teacher/student）

## 4. 数据模型（高层）

核心表（public schema）：
- `users`：业务档案（UUID 主键，role/class 等业务字段；不管理密码）
- `classes`：班级
- `questions`：题库（归属 teacher）
- `exams`：试卷（归属 teacher）
- `exam_questions`：试卷题目关联
- `exam_assignments`：试卷分配到学生（发布到班级后展开到学生）
- `attempts`：学生作答记录
- `attempt_answers`：作答明细
- `messages`：公告（teacher 发布，按 target 可全体/定向）

## 5. 认证与登录（Supabase Auth）

- 认证账号存在 `auth.users`，业务档案存在 `public.users`
- `supabase/schema.sql` 提供触发器：`auth.users insert -> public.users upsert`
- 项目使用一个“虚拟 email”策略把 `(role, schoolNo)` 映射为 email：
  - `buildAuthEmail(role, schoolNo) -> ${role}.${schoolNo}@oex.local`
  - 目的：让用户仍然以“角色 + 学号/工号 + 密码”登录，但底层使用 Supabase Auth 的 email/password

重要：前端登录应走 `supabase.auth.signInWithPassword`，成功后再按 `auth.user.id` 读取 `public.users`。

## 6. API 设计（<= 10 Functions）

为避免 Vercel Hobby 12 functions 限制，后端已聚合：
- `/api/admin?resource=...`
- `/api/teacher?resource=...`
- `/api/student?resource=...`

其中 `resource` 取值包括（示例，详见对应文件）：
- admin：`users`、`classes`、`stats`、`users-import`
- teacher：`questions`、`exams`、`exam-content`、`exam-detail`、`classes`、`grading`、`messages`、`dashboard`
- student：`exams`、`attempts`、`messages`

前端所有读写都应该通过 `src/utils/remoteApi.ts` 访问这些接口（或走 Supabase Auth 的登录/登出）。

## 7. 环境变量

本地（`.env.local`）与 Vercel（Production/Preview）建议都配置：

前端（Vite）：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

后端（Vercel Functions）：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

注意：`SUPABASE_SERVICE_ROLE_KEY` 仅允许在服务端使用。

## 8. 常用命令

- `npm install`
- `npm run dev`：前端开发服务器（Vite，仅前端；如需连同 `/api/*` 本地跑，使用 `vercel dev`）
- `npm run build`：生产构建（TypeScript build + Vite build）
- `npm run check`：类型检查（tsc -b --noEmit）
- `npm run test -- --run`：单测
- `npm run sync:auth-users`：把 `public.users` 同步到 `auth.users`（用于历史账号迁移）

## 9. 部署与验收

- Vercel 部署说明：`docs/deploy-vercel-runbook.md`
- 回归清单：`docs/regression-phase4-checklist.md`
- `vercel.json` 已配置 SPA rewrite（History 路由）

## 10. 约束与注意事项

- **唯一数据源**：所有业务读写必须经由 `src/utils/remoteApi.ts` → `/api/*`，或通过 `supabase.auth` 做登录/登出。不要再引入本地 mock / localStorage 数据源。
- **xlsx 导入保留**：`src/pages/admin/UserImportModal.tsx`（用户批量导入）与 `src/pages/teacher/QuestionBankList.tsx`（题目批量导入）仍依赖 `xlsx`，用于解析上传的表格并通过 `/api/*` 写入 Supabase；这是生产功能，不要移除。
- **`authStore.updateProfile` 目前不写后端**：仅更新本地 Zustand 状态。若需要持久化用户自助改动（昵称/头像/年级/学科），需新增一个后端接口（比如 `/api/user?resource=profile`）再让 store 调它。

## 11. 已完成的清理（历史记录）

以下遗留物已在 2026-04 的清理中移除，如在旧 PR / 文档中见到可忽略：
- `src/utils/mockApi.ts`、`src/utils/mockDb.ts`、`src/utils/seed.ts`、`src/utils/storage.ts`
- `src/pages/admin/AdminBackup.tsx` 与对应的 `/admin/backup` 路由及侧边栏项
- `server.js` + `db.json` + `/api/db` 本地文件 DB 与 `npm run server` 脚本
- `vite.config.ts` 中的 `/api` → `localhost:3001` 代理
- `remoteApi.ts` 中所有 `if (!useRemote)` fallback 分支
- `在线考试系统.ps1` 一键启动脚本（依赖已删除的本地 DB）

