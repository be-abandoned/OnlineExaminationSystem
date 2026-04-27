# 项目 AI 开发指南

本文档面向后续参与本项目的 AI 或开发者，用于快速理解系统边界、技术栈、核心业务规则和修改代码时的验证要求。

## 1. 项目定位

本项目是一个在线考试系统，已按管理员、教师、学生三类角色组织功能。

- 管理员：用户管理、班级管理、数据统计。
- 教师：题库管理、Excel 批量导入题目、试卷编辑、一键组卷、发布考试、阅卷、消息通知、个人资料维护。
- 学生：查看考试、开始或继续作答、自动或手动交卷、查看成绩详情、查看消息、维护个人资料。

系统已部署到 Vercel，并以 Supabase Auth 与 Supabase PostgreSQL 作为认证和业务数据源。

## 2. 技术栈

- 前端：React 18、TypeScript、Vite、React Router。
- 样式：Tailwind CSS class，配合少量封装 UI 组件。
- 状态管理：Zustand，主要用于登录态。
- 拖拽排序：`@dnd-kit/core`、`@dnd-kit/sortable`，用于试卷题目排序。
- 表格导入：`xlsx`，用于题库和用户 Excel 导入。
- 图标：`lucide-react`。
- 后端：Vercel Serverless Functions，代码位于 `api/`。
- 数据库与认证：Supabase Auth + Supabase PostgreSQL。
- 本地完整调试：推荐使用 `vercel dev`，因为业务功能依赖 `/api/*` Serverless API。

常用命令：

```bash
npm install
npm run check
npm run build
npm run dev
vercel dev
```

说明：

- `npm run dev` 只启动 Vite 前端服务。
- `vercel dev` 会同时模拟 Vercel API，适合完整本地调试。
- 修改代码后至少执行 `npm run check`。

## 3. 环境变量

前端 Supabase 匿名客户端使用：

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

后端 Serverless API 使用 Service Role：

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

如果本地需要连接真实 Supabase 项目，通常需要先执行：

```bash
vercel login
vercel pull
vercel dev
```

注意：`SUPABASE_SERVICE_ROLE_KEY` 只能在服务端使用，不能暴露给前端。

## 4. 关键目录

```text
api/                         Vercel Serverless API
  admin.js                   管理员接口：用户、班级、统计、用户导入
  teacher.js                 教师接口：题库、试卷、阅卷、消息、个人资料、题型预设
  student.js                 学生接口：考试、答卷、交卷、成绩、消息
  login.js                   登录辅助接口
  health.js                  健康检查

server/
  supabase.js                Supabase service role client，以及 assertAdmin/assertTeacher/assertStudent 权限校验
  authIdentity.js            服务端账号身份辅助

supabase/
  schema.sql                 数据库表结构
  rls.sql                    RLS 策略

src/
  App.tsx                    路由入口
  types/domain.ts            前端核心领域类型和常量
  utils/remoteApi.ts         前端远程请求与 API DTO 映射
  stores/authStore.ts        Zustand 登录态，localStorage key 为 oex_auth_v1

src/pages/admin/             管理员页面
src/pages/teacher/           教师页面
src/pages/student/           学生页面
src/components/ui/           基础 UI 组件：Button、Modal、Input、Select 等
src/components/questions/    题目编辑、题干展示、答案编辑、题目选择弹窗
src/components/exam/         考试时间状态相关组件
src/hooks/domain/            业务查询 hooks
src/hooks/query/             自研缓存查询 hooks
src/lib/query/               queryClient、queryKey、缓存失效工具
```

## 5. 路由结构

路由定义在 `src/App.tsx`，权限保护由 `src/components/auth/RequireAuth.tsx` 负责。

学生端：

- `/student`：学生工作台。
- `/student/exams/:examId`：考试详情，开始或继续作答。
- `/student/attempts/:attemptId`：答题页面。
- `/student/results/:attemptId`：成绩详情。
- `/student/messages`：消息。
- `/student/profile`：个人资料。

教师端：

- `/teacher`：教师工作台。
- `/teacher/questions`：题库管理。
- `/teacher/questions/create/:type`：新建题目。
- `/teacher/questions/:id`：编辑题目。
- `/teacher/exams`：试卷列表。
- `/teacher/exams/:examId/edit`：试卷编辑。
- `/teacher/exams/:examId/grading`：阅卷。
- `/teacher/messages`：消息。
- `/teacher/profile`：个人资料。

管理员端：

- `/admin`：管理员工作台。
- `/admin/classes`：班级管理。
- `/admin/users`：用户管理。

## 6. 数据模型

核心类型和常量集中在 `src/types/domain.ts`。修改业务逻辑前，优先查看这里的领域定义。

主要实体：

- `User`：用户，`role` 包括 `student`、`teacher`、`admin`。
- `Class`：班级。
- `Question`：题目，包含 `type`、`stem`、`options`、`answerKey`、`defaultScore`、`gradeLevel`、`subjectId`、`difficulty`。
- `Exam`：试卷，包含状态、时间、年级、学科、题型设置、班级分配。
- `ExamQuestion`：试卷题目关联，包含排序和分值。
- `Attempt`：学生答卷，状态包括 `in_progress`、`submitted`、`graded`。
- `AttemptAnswer`：学生每题答案、自动评分、人工评分。
- `Message`：教师发给学生的通知。
- `QuestionTypePreset`：题型设置预设方案。

题型枚举：

```ts
single       单选题
multiple     多选题
true_false   判断题
blank        填空题
short        简答题
```

学科和年级常量也在 `src/types/domain.ts`。

## 7. 数据访问原则

前端业务请求集中在 `src/utils/remoteApi.ts`。

- 登录、登出、注册等认证行为通过前端 Supabase 匿名客户端处理。
- 业务写入和多数敏感读取必须走 `/api/admin`、`/api/teacher`、`/api/student`。
- 后端 API 使用 Supabase service role key，并通过 `assertAdmin`、`assertTeacher`、`assertStudent` 校验业务角色。
- 不要重新引入本地 mock、localStorage 业务数据源或绕过 `remoteApi.ts` 的业务读写路径。

后端聚合接口：

- `/api/admin?resource=...`
- `/api/teacher?resource=...`
- `/api/student?resource=...`

## 8. 查询缓存

项目使用自研查询缓存，而不是 React Query。

相关文件：

- `src/lib/query/queryClient.ts`
- `src/hooks/query/useCachedQuery.ts`
- `src/lib/query/invalidate.ts`
- `src/lib/query/queryKey.ts`
- `src/hooks/domain/`

如果列表修改后页面没有刷新，优先检查：

1. 失效的 query key 是否和查询使用的 key 完全一致。
2. 是否需要调用 `removeByResource` 或 `queryClient.setQueryData`。
3. 页面是否维护了额外的本地 visible state。

## 9. 登录与用户资料

登录态位于 `src/stores/authStore.ts`。

- 使用 Zustand persist。
- localStorage key 为 `oex_auth_v1`。
- `me` 中缓存当前用户业务资料。

认证账号在 Supabase Auth 中，业务档案在 `public.users` 中。涉及身份、角色、年级、学科时，以数据库 `users` 表为权威来源。

教师个人资料已改为远程写入 `public.users`，相关文件：

- `src/pages/teacher/TeacherProfile.tsx`
- `src/utils/remoteApi.ts` 中的 `teacherUpdateProfileRemote`
- `api/teacher.js` 中 `resource === "profile"` 的分支

保存成功后，需要同步更新本地登录态，避免页面显示仍使用旧的 `authStore.me`。

如果用户资料在数据库中已变化但前端未同步，可能是 `authStore` 缓存导致。必要时清理 localStorage 中的 `oex_auth_v1` 或重新登录。

## 10. 教师题库管理

页面：`src/pages/teacher/QuestionBankList.tsx`。

题目编辑器：`src/components/questions/QuestionEditor.tsx`。

后端入口：`api/teacher.js` 中 `resource === "questions"`。

当前规则：

- 题库支持题型、年级、编号筛选。
- 题库支持 Excel 批量导入题目。
- 题库支持批量删除，删除前使用中置确认弹窗。
- 教师只能创建自己学科的题目。
- 教师只能查看自己学科的题目。
- 题库管理中已移除学科筛选。
- 教师新建题目时，年级和学科默认使用教师资料。
- 题目编辑器中，学科和年级只读展示，不允许教师创建其他学科题目。
- 后端保存题目时，最终学科强制使用数据库中教师的 `subject_id`，防止前端绕过。
- 后端题目列表也必须按教师学科过滤。
- 批量导入题目时，最终学科同样以后端数据库中教师的 `subject_id` 为准。
- 导入和删除题目后，需要主动刷新当前题目列表。

如果题目出现错误学科，优先检查：

```sql
select id, display_name, school_no, role, subject_id
from public.users
where role = 'teacher';
```

## 11. 教师试卷编辑

页面：`src/pages/teacher/TeacherExamEdit.tsx`。

后端入口：`api/teacher.js` 中 `resource === "exams"`。

核心功能：

- 编辑试卷标题、年级、学科、考试时间、考试时长。
- 设置各题型目标数量和默认分值。
- 管理题型预设方案。
- 从题库弹窗中添加题目。
- 使用 dnd-kit 对试卷题目拖拽排序。
- 编辑单题分值。
- 全选或取消全选当前筛选下的可见题目。
- 删除选中题目。
- 一键组卷，从题库中随机补齐题型设置缺口。

题型预设规则：

- 全教师共用。
- 最多 6 个。
- 默认收起。
- 只支持保存、应用、删除，不支持修改。

一键组卷规则：

- 点击后先显示中置确认弹窗。
- 弹窗内提供 1 到 5 的难度滑条。
- 难度只影响随机权重，不要求完全匹配。
- 当前筛选为某个题型时，只补齐该题型。
- 当前筛选为全部时，补齐所有缺少的题型。
- 只从未被当前试卷选择的题目中抽取。
- 只抽取与当前试卷 `gradeLevel` 和 `subjectId` 匹配的题目。
- 确认后，在弹窗内展示各题型添加数量和平均难度。

试卷作答次数规则：

- 全部试卷不限制作答次数。
- 教师保存试卷时，前端 `attemptLimit` 应为 `0`。
- 后端保存试卷时，数据库 `attempt_limit` 应为 `0`。

## 12. 学生考试与答题

考试详情页：`src/pages/student/StudentExam.tsx`。

答题页：`src/pages/student/StudentAttempt.tsx`。

成绩详情页：`src/pages/student/StudentResultDetail.tsx`。

后端入口：`api/student.js`。

考试详情规则：

- 考试未开始时，点击开始应提示不能进入。
- 考试结束后不能进入答题。
- 作答次数显示为“不限制，考试时间内未交卷可继续进入答题”。

开始或继续作答规则：

- 如果存在 `in_progress` 答卷，则返回该答卷继续作答。
- 如果没有未交卷答卷，只要仍在考试时间内，就允许创建新答卷。
- 不再限制历史提交次数。
- 已交卷后，只要仍在考试时间内，也可以重新开始新答卷。

答题页功能：

- 倒计时。
- 自动保存答案。
- 时间到自动交卷。
- 手动交卷使用中置确认弹窗。
- 确认交卷后，弹窗内显示进度条。
- 交卷完成后自动跳转学生工作台 `/student`。

重要注意：

- 修改 `StudentResultDetail.tsx` 时必须遵守 React Hooks 顺序规则。
- 曾经因为 `useMemo` 写在条件 return 后导致生产环境 React #310 白屏。
- 新增 hooks 必须放在条件 return 之前。

错误写法：

```tsx
if (!data) return ...
const x = useMemo(...)
```

正确写法：

```tsx
const x = useMemo(...)
if (!data) return ...
```

## 13. 阅卷与评分

教师阅卷页面：`src/pages/teacher/TeacherGrading.tsx`。

评分工具：`src/utils/scoring.ts`。

测试文件：`src/utils/scoring.test.ts`。

规则：

- 客观题可自动评分。
- 简答题需要人工评分和评语。
- 成绩发布后，学生才能查看分数、解析、参考答案等详情。
- 修改评分逻辑后应执行测试。

## 14. 消息系统

教师消息页：`src/pages/teacher/TeacherMessages.tsx`。

学生消息页：`src/pages/student/StudentMessages.tsx`。

消息支持面向全部学生或指定学生。

## 15. 数据库结构

数据库 SQL 文件：

- `supabase/schema.sql`
- `supabase/rls.sql`

主要表：

- `users`
- `classes`
- `questions`
- `exams`
- `exam_questions`
- `exam_assignments`
- `attempts`
- `attempt_answers`
- `messages`
- `message_reads`
- `question_type_presets`

如果新增表或修改表结构，需要提醒用户在 Supabase SQL Editor 中执行迁移 SQL。

## 16. 常见问题

### 本地开发接口 404

`npm run dev` 只启动 Vite 前端，`/api/*` 可能不可用。需要完整本地调试时，请使用：

```bash
vercel dev
```

### 登录态与数据库不一致

`authStore` 会缓存 `me`。如果数据库用户信息已修改但前端没有更新，可能出现本地显示与数据库不一致。必要时清理 localStorage 中的 `oex_auth_v1` 或重新登录。

### 教师学科错误

题目保存、题目导入、一键组卷最终应以数据库 `users.subject_id` 和当前试卷 `subjectId` 为准。不要信任前端传入的教师学科作为最终依据。

### PowerShell 命令兼容

部分 Windows PowerShell 版本不支持 `&&`。需要分开执行命令，例如：

```powershell
node --check api/student.js
node --check api/teacher.js
```

## 17. 修改后的验证建议

通用前端和类型检查：

```bash
npm run check
```

生产构建：

```bash
npm run build
```

后端 API 语法检查：

```bash
node --check api/student.js
node --check api/teacher.js
node --check api/admin.js
```

如果修改了 Supabase 服务端工具：

```bash
node --check server/supabase.js
```

如果修改了评分逻辑：

```bash
npm test
```

## 18. AI 工作原则

1. 修改前先查看 `src/types/domain.ts`，确认领域类型和常量。
2. 涉及后端数据写入时，同时检查 `src/utils/remoteApi.ts` 和对应的 `api/*.js`。
3. 涉及页面刷新时，同时检查 `src/hooks/domain/*Query.ts`、`queryKey` 和缓存失效逻辑。
4. 涉及用户身份、角色、学科、年级时，以数据库 `users` 表为权威来源。
5. 涉及学生答题和成绩详情时，特别注意 React Hooks 顺序。
6. 不要新增本地 mock、localStorage 业务数据源或绕过 `/api/*` 的业务读写路径。
7. 不要移除 `xlsx` 相关导入功能，题库导入和用户导入是生产功能。
8. 除非用户明确要求，不要新增无必要注释。
9. 修改完成后至少运行 `npm run check`；涉及 API、评分或数据库工具时，按第 17 节补充验证。
