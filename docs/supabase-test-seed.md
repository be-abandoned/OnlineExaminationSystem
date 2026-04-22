# Supabase 测试数据初始化方案

本文档用于在 Supabase 测试环境初始化一套可重复执行的数据集，重点解决“无账号导致无法登录”的问题。

## 1. 适用范围与安全保护

- 仅用于测试环境，禁止在生产环境执行。
- 脚本内置三层保护：
  - `SEED_ENV` 必须是 `test`
  - `SEED_CONFIRM` 必须是 `I_UNDERSTAND_THIS_WILL_WRITE_DATA`
  - `SEED_ALLOWED_PROJECT_REF` 必须与 `SUPABASE_URL` 解析出的 project ref 完全一致

## 2. 表结构与约束摘要

基于 `supabase/schema.sql`：

- `users`
  - 主键：`id(uuid)`
  - 约束：`role in ('student','teacher','admin')`、`status in ('active','disabled')`
  - 唯一：`unique(role, school_no)`
  - 外键：`class_id -> classes.id`
- `classes`
  - 外键：`teacher_id -> users.id`
- `questions`
  - 外键：`teacher_id -> users.id`
  - 约束：`type in ('single','multiple','true_false','blank','short')`
- `exams`
  - 外键：`teacher_id -> users.id`
  - 约束：`status in ('draft','published','closed')`
- `exam_questions`
  - 外键：`exam_id -> exams.id`，`question_id -> questions.id`
- `exam_assignments`
  - 外键：`exam_id -> exams.id`，`student_id -> users.id`
- `attempts`
  - 外键：`exam_id -> exams.id`，`student_id -> users.id`
  - 约束：`status in ('in_progress','submitted','graded')`
- `attempt_answers`
  - 外键：`attempt_id -> attempts.id`，`question_id -> questions.id`
- `messages`
  - 外键：`teacher_id -> users.id`

认证同步：
- `schema.sql` 已定义触发器 `on_auth_user_created`，在写入 `auth.users` 后自动同步/更新 `public.users`。

## 3. 初始化数据覆盖范围

脚本：`scripts/seed-supabase-test-data.mjs`

- 账号数据（11个）：
  - 管理员：2
  - 教师：3
  - 学生：6（含1个禁用账号）
- 业务数据：
  - 班级：3
  - 题目：4（单选/判断/填空）
  - 试卷：3（`published/draft/closed` 各1）
  - 组卷关联：4
  - 分配记录：7
  - 作答记录：2
  - 作答明细：3
  - 消息：2（全体学生 + 指定学生）

说明：
- 当前库约束仅支持 `admin/teacher/student` 三种角色，脚本提供 9+ 账号并覆盖多角色业务流程。
- 所有记录使用固定 UUID + `upsert`，可重复执行，不会重复插入脏数据。

## 4. 执行步骤

1. 配置环境变量（建议写入 `.env.local`）：

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_ANON_KEY=...

SEED_ENV=test
SEED_CONFIRM=I_UNDERSTAND_THIS_WILL_WRITE_DATA
SEED_ALLOWED_PROJECT_REF=<你的测试项目ref>
SEED_DEFAULT_PASSWORD=<强密码，至少12位且包含大小写+数字+特殊字符>
```

2. 运行脚本：

```bash
npm run seed:supabase:test
```

## 5. 校验项

脚本会自动校验：

- 数据写入校验：按固定 UUID 校验 9 张业务表写入数量。
- 登录校验：
  - `admin/admin`
  - `teacher/T10001`
  - `student/S20230001`
- 禁用账号校验：
  - `student/S20240002` 账号状态为 `disabled`（用于前端登录后状态拦截校验）。

如果任一校验失败，脚本会直接返回非零退出码并输出错误信息。

## 6. 默认测试账号

邮箱规则：`${role}.${schoolNo}@oex.local`（系统自动生成）

- 管理员：`admin`、`A10002`
- 教师：`T10001`、`T10002`、`T10003`
- 学生：`S20230001` ~ `S20230004`、`S20240001`、`S20240002(禁用)`

密码：
- 全部账号默认使用 `SEED_DEFAULT_PASSWORD` 指定密码。
