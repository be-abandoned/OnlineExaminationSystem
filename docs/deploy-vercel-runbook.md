# Vercel 生产上线 Runbook

本 Runbook 用于重构后（Vercel + Supabase）的生产发布与回滚。

## 1. 发布前 10 分钟检查

- Supabase 已执行：
  - `supabase/schema.sql`
  - `supabase/rls.sql`
- Vercel 项目环境变量（Production）已配置：
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 核对 `vercel.json`：
  - `/api/*` 保持 API 路由
  - 其余路由回退 `index.html`
- 本地质量门禁：
  - `npm run check` 通过
  - `npm run build` 通过
  - `npm run test -- --run` 通过

## 2. 发布步骤（约 10 分钟）

1. 在 Vercel 导入/绑定当前仓库。
2. Build Command 使用默认（`npm run build`）。
3. 输出目录为 `dist`（Vite）。
4. 首次先发 Preview，验证通过后 Promote 到 Production。
5. 部署后检查：
   - `GET /api/health` 返回 `ok: true`
   - 首页可打开
   - 登录接口正常

## 3. 生产验证（约 10 分钟）

- 管理员：
  - 登录
  - 用户管理增删改查
  - 班级管理
- 教师：
  - 新建题目
  - 新建试卷并发布
  - 阅卷保存与发布成绩
- 学生：
  - 查看考试
  - 开始作答并交卷
  - 查看结果页

## 4. 监控重点

- Vercel Functions 日志：
  - 5xx 比例
  - 超时与冷启动异常
- Supabase 日志：
  - RLS 拒绝
  - SQL 错误
- 业务指标：
  - 登录成功率
  - 交卷成功率
  - 阅卷保存成功率

## 5. 回滚预案（5 分钟）

1. 在 Vercel 控制台将 Production 回滚到上一个稳定部署。
2. 若涉及数据结构变更，先确认是否需要恢复 Supabase 备份快照。
3. 回滚后立即执行最小冒烟：
   - 登录
   - 打开考试列表
   - 打开 `/api/health`

## 6. 安全注意事项

- `SUPABASE_SERVICE_ROLE_KEY` 只允许在服务端（Vercel Function）使用。
- 前端只能使用 `VITE_SUPABASE_ANON_KEY`。
- 若密钥泄露，立刻轮换并更新 Vercel 环境变量。
