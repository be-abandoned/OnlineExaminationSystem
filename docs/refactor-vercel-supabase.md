# Vercel + Supabase 重构说明（阶段一）

本文档记录当前已完成的重构基础工作，以及下一阶段改造路线。

## 已完成

- 新增 Supabase 前端客户端：[src/lib/supabase.ts](../src/lib/supabase.ts)
- 新增 Supabase 数据库建表脚本：[supabase/schema.sql](../supabase/schema.sql)
- 新增 RLS 策略脚本：[supabase/rls.sql](../supabase/rls.sql)
- 新增数据迁移脚本（db.json -> Supabase）：[scripts/migrate-db-to-supabase.mjs](../scripts/migrate-db-to-supabase.mjs)
- 新增 Vercel API 健康检查：[api/health.js](../api/health.js)
- 调整 Vercel 路由重写，保留 `/api/*`： [vercel.json](../vercel.json)
- 新增环境变量模板： [.env.example](../.env.example)

## 使用步骤

1. 在 Supabase 控制台执行 `supabase/schema.sql`。
2. 复制 `.env.example` 为 `.env.local` 并填写：

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. 运行迁移脚本将 `db.json` 导入 Supabase：

```bash
npm run migrate:supabase
```

4. 启用 RLS（建议在验证迁移成功后执行）：

```sql
-- 粘贴并执行 supabase/rls.sql
```

5. 本地启动后可验证：

- `GET /api/health` 返回 `{ ok: true }`

## 下一阶段（即将实施）

- 把 `src/utils/mockApi.ts` 的读写逐步替换为异步 API 调用
- 先迁移登录、用户管理、班级管理，再迁移题库/考试/阅卷
- 引入 Supabase Auth 与 RLS 策略，移除明文密码方案
- 完成后下线 `mockDb.ts` 与 `server.js` 本地文件存储模式
