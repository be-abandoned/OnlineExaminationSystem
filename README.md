# 在线考试系统 (Online Examination System)

这是一个基于 React + TypeScript + Vite 构建的网页端在线考试系统前端项目。

## 功能特性

- **双端支持**：教师端（出题、组卷、发布、阅卷）与学生端（答题、查看成绩）。
- **丰富题型**：支持单选、多选、判断、填空、简答题。
- **模拟数据**：内置 Mock 数据层，无需后端即可完整体验核心流程。
- **响应式设计**：适配桌面端与移动端布局。

## 技术栈

- **核心框架**: React 18, TypeScript
- **构建工具**: Vite
- **样式方案**: Tailwind CSS
- **状态管理**: Zustand (配合 Persist 中间件实现本地持久化)
- **路由管理**: React Router v6

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173` 即可开始使用。

### 3. 构建生产版本

```bash
npm run build
```

构建产物位于 `dist/` 目录。

## 演示账号

系统内置了以下演示账号（密码统一为 `123456`）：

| 角色 | 手机号 | 学号/工号 | 密码 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| **教师** | `18800000001` | `T10001` | `123456` | 拥有最高管理权限 |
| **学生** | `18800000011` | `S20230001` | `123456` | 普通学生账号 |
| **学生** | `18800000012` | `S20230002` | `123456` | 另一个学生账号 |

## 数据重置

由于使用了 `localStorage` 模拟后端数据库，如果遇到数据异常或想重置系统，可以在浏览器控制台执行：

```js
localStorage.clear();
location.reload();
```

或者在页面出现错误边界时点击“清理缓存并刷新”。


## Vercel + Supabase（重构进行中）

已新增 Supabase / Vercel 基础设施文件：

- `supabase/schema.sql`：数据库表结构
- `supabase/rls.sql`：RLS 权限策略（admin/teacher/student）
- `scripts/migrate-db-to-supabase.mjs`：从 `db.json` 迁移数据
- `api/health.js`：Vercel API 健康检查
- `.env.example`：环境变量模板

迁移命令：

```bash
npm run migrate:supabase
```

迁移完成后可在 Supabase SQL Editor 执行 `supabase/rls.sql` 启用行级权限控制。

详细说明见：`docs/refactor-vercel-supabase.md`

生产发布与回滚流程见：`docs/deploy-vercel-runbook.md`
