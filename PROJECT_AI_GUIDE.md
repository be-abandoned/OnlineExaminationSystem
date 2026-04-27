# 项目快速说明（给后续 AI）

## 1. 项目定位

这是一个在线考试系统，包含管理员端、教师端、学生端三类角色。

核心功能：

- 管理员：用户管理、班级管理、数据统计。
- 教师：题库管理、批量导入题目、试卷编辑、一键组卷、发布考试、阅卷、消息通知、个人资料。
- 学生：查看考试、开始/继续作答、自动/手动交卷、查看成绩详情、消息、个人资料。

## 2. 技术栈

- 前端：React 18、TypeScript、Vite、React Router。
- 样式：Tailwind CSS 风格 class，少量封装 UI 组件。
- 状态：Zustand，主要用于登录态。
- 拖拽：@dnd-kit/core、@dnd-kit/sortable，用于试卷题目排序。
- 表格导入：xlsx，用于题库 Excel 导入。
- 图标：lucide-react。
- 后端：Vercel Serverless Functions，位于 api 目录。
- 数据库和认证：Supabase Auth + Supabase PostgreSQL。
- 本地开发：推荐 `vercel dev`，因为项目依赖 `/api/*` Serverless API。

常用命令：

```bash
npm install
npm run check
npm run build
npm run dev
vercel dev
```

说明：

- `npm run dev` 只启动 Vite 前端。
- `vercel dev` 可同时模拟 Vercel API，适合完整本地调试。
- `npm run check` 是 TypeScript 检查，修改代码后应执行。

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

如果本地要连接真实数据库，请执行：

```bash
vercel login
vercel pull
vercel dev
```

## 4. 重要目录

```text
api/                         Vercel Serverless API
  admin.js                   管理员相关接口
  teacher.js                 教师相关接口：题库、试卷、阅卷、个人资料、题型预设
  student.js                 学生相关接口：考试、答卷、交卷、成绩、消息
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
  utils/remoteApi.ts         前端所有远程请求和 API 数据映射
  stores/authStore.ts        Zustand 登录态，localStorage key 为 oex_auth_v1

src/pages/admin/             管理员页面
src/pages/teacher/           教师页面
src/pages/student/           学生页面
src/components/ui/           基础 UI 组件：Button、Modal、Input、Select 等
src/components/questions/    题目编辑、题干展示、答案编辑、题目选择弹窗
src/components/exam/         考试时间状态相关组件
src/hooks/domain/            各业务模块查询 hooks
src/hooks/query/             自研缓存查询 hooks
src/lib/query/               自研 queryClient、queryKey、缓存失效工具
```

## 5. 路由结构

路由在 `src/App.tsx`。

学生端：

- `/student`：学生工作台
- `/student/exams/:examId`：考试详情和开始/继续作答
- `/student/attempts/:attemptId`：答题页面
- `/student/results/:attemptId`：成绩详情
- `/student/messages`：消息
- `/student/profile`：个人资料

教师端：

- `/teacher`：教师工作台
- `/teacher/questions`：题库管理
- `/teacher/questions/create/:type`：新建题目
- `/teacher/questions/:id`：编辑题目
- `/teacher/exams`：试卷列表
- `/teacher/exams/:examId/edit`：试卷编辑
- `/teacher/exams/:examId/grading`：阅卷
- `/teacher/messages`：消息
- `/teacher/profile`：个人资料

管理员端：

- `/admin`：管理员工作台
- `/admin/classes`：班级管理
- `/admin/users`：用户管理

权限保护由 `src/components/auth/RequireAuth.tsx` 负责。

## 6. 核心数据模型

核心类型在 `src/types/domain.ts`。

重要实体：

- `User`：用户，role 包括 `student`、`teacher`、`admin`。
- `Class`：班级。
- `Question`：题目，含 `type`、`stem`、`options`、`answerKey`、`defaultScore`、`gradeLevel`、`subjectId`、`difficulty`。
- `Exam`：试卷，含状态、时间、年级、学科、题型设置、班级分配。
- `ExamQuestion`：试卷题目关联，含排序和分值。
- `Attempt`：学生答卷，状态包括 `in_progress`、`submitted`、`graded`。
- `AttemptAnswer`：学生每题答案和自动/人工评分。
- `Message`：教师给学生的通知。
- `QuestionTypePreset`：题型设置预设方案。

题型：

```ts
single       单选题
multiple     多选题
true_false   判断题
blank        填空题
short        简答题
```

学科和年级常量也在 `domain.ts`。

## 7. 数据访问和缓存

前端请求集中在 `src/utils/remoteApi.ts`。

- Supabase Auth 登录注册由前端匿名客户端处理。
- 业务写入和多数敏感读取走 `/api/admin`、`/api/teacher`、`/api/student`。
- 后端使用 Supabase service role key，并通过 `assertAdmin`、`assertTeacher`、`assertStudent` 校验业务角色。

查询缓存是自研实现：

- `src/lib/query/queryClient.ts`
- `src/hooks/query/useCachedQuery.ts`
- `src/lib/query/invalidate.ts`
- `src/lib/query/queryKey.ts`

业务查询 hooks 在 `src/hooks/domain/`。

注意：如果某个列表修改后页面不刷新，优先检查：

1. 失效的 query key 是否和查询用的 key 完全一致。
2. 是否需要 `removeByResource` 或 `queryClient.setQueryData`。
3. 当前页面是否维护了本地 visible state。

## 8. 登录和用户资料

登录态：`src/stores/authStore.ts`。

- 使用 Zustand persist。
- localStorage key：`oex_auth_v1`。
- `me` 中缓存用户资料。

教师个人资料曾经只更新本地缓存，现已改为调用远程接口写入 `public.users`。

相关文件：

- `src/pages/teacher/TeacherProfile.tsx`
- `src/utils/remoteApi.ts` 中 `teacherUpdateProfileRemote`
- `api/teacher.js` 中 `resource === "profile"`

如果用户在前端改了学科但数据库没变，题库/组卷会按数据库的 `subject_id` 为准。

## 9. 教师题库管理

页面：`src/pages/teacher/QuestionBankList.tsx`

功能：

- 题目列表。
- 题型/年级/编号筛选。
- 批量导入 Excel。
- 批量删除，使用中置确认弹窗。
- 导入和删除后会主动刷新题目列表。

题目编辑器：`src/components/questions/QuestionEditor.tsx`

当前规则：

- 教师新建题目时，年级和学科默认使用教师资料。
- 学科和年级在题目编辑器中只读显示，不允许教师创建其他学科题目。
- 后端保存题目时强制写入数据库中教师的 `subject_id`，防止前端绕过。
- 题目列表后端也按教师学科过滤。

后端：`api/teacher.js` 中 `resource === "questions"`。

## 10. 教师试卷编辑

页面：`src/pages/teacher/TeacherExamEdit.tsx`

核心功能：

- 编辑试卷标题、年级、学科、考试时间、时长。
- 题型设置：每类题目的目标数量和默认分值。
- 题型预设方案：全教师共用，最多 6 个，只支持保存、应用、删除，不支持修改。
- 添加题目：通过题目选择弹窗从题库选择。
- 试卷题目拖拽排序：使用 dnd-kit。
- 单题分值编辑。
- 全选/取消全选当前筛选下可见题目，删除选中题目。
- 一键组卷：从题库随机补齐题型设置缺口。

一键组卷规则：

- 点击后先显示中置确认弹窗。
- 弹窗内有 1-5 难度滑条。
- 难度只影响随机权重，不强制完全匹配。
- 当前筛选是某题型时，只补齐该题型。
- 当前筛选是全部时，补齐所有缺少的题型。
- 只从未被当前试卷选择的题目中抽取。
- 只从当前试卷 `gradeLevel` 和 `subjectId` 匹配的题目中抽取。
- 确认后在弹窗内展示各题型添加数量和平均难度。

试卷作答次数：

- 已改为不限制。
- 教师保存试卷时 `attemptLimit: 0`。
- 后端保存试卷时 `attempt_limit: 0`。

后端：`api/teacher.js` 中 `resource === "exams"`。

## 11. 学生考试和答题

考试详情：`src/pages/student/StudentExam.tsx`

规则：

- 考试未开始时点击开始会提示。
- 考试结束后不能进入。
- 作答次数显示为“不限制，考试时间内未交卷可继续进入答题”。

答题页：`src/pages/student/StudentAttempt.tsx`

功能：

- 倒计时。
- 自动保存答案。
- 时间到自动交卷。
- 手动交卷使用中置确认弹窗。
- 点击确认交卷后弹窗内显示进度条。
- 交卷完成后自动跳转学生工作台 `/student`。

开始/继续作答后端：`api/student.js`。

当前规则：

- 如果存在 `in_progress` 答卷，则返回它继续作答。
- 如果没有未交卷答卷，只要在考试时间内就允许创建新答卷。
- 不再限制历史提交次数。

成绩详情：`src/pages/student/StudentResultDetail.tsx`

注意：

- 曾经因为 `useMemo` 写在条件 return 后导致 React #310 白屏。
- 现在 hooks 都放在条件 return 前。
- 后续改该文件时必须遵守 React Hooks 顺序规则。

## 12. 阅卷和评分

教师阅卷页面：`src/pages/teacher/TeacherGrading.tsx`

评分工具：`src/utils/scoring.ts`

测试：`src/utils/scoring.test.ts`

一般逻辑：

- 客观题可自动评分。
- 简答题需要人工评分和评语。
- 成绩发布后学生才能看到分数、解析、参考答案等详情。

## 13. 消息系统

教师消息：`src/pages/teacher/TeacherMessages.tsx`
学生消息：`src/pages/student/StudentMessages.tsx`

消息类型支持面向全部学生或指定学生。

## 14. 数据库结构

数据库 SQL：

- `supabase/schema.sql`
- `supabase/rls.sql`

主要表包括：

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

如果新增表，需要提醒用户在 Supabase SQL Editor 执行迁移 SQL。

## 15. 近期重要业务规则变更

1. 教师题库：
   - 教师只能创建自己学科题目。
   - 教师只能查看自己学科题目。
   - 学科筛选已从题库管理移除。
   - 批量导入题目时，最终学科以后端数据库中教师 `subject_id` 为准。

2. 教师个人资料：
   - 修改年级/学科会写入 Supabase `users` 表。
   - 保存成功后同步本地登录态。

3. 题型预设：
   - 全教师共用。
   - 最多 6 个。
   - 默认收起。
   - 只支持保存、应用、删除，不支持修改。

4. 一键组卷：
   - 中置弹窗确认。
   - 支持难度权重。
   - 只抽当前试卷年级和学科的题。

5. 学生作答次数：
   - 全部试卷不限制作答次数。
   - 考试时间内，未交卷可继续进入。
   - 已交卷后，在考试时间内也可重新开始新答卷。

6. 删除/导入刷新：
   - 题库导入和删除后需要刷新当前列表。
   - 注意 query key 必须一致。

## 16. 常见坑

### React Hooks 顺序

不要在条件 return 后新增 hooks，例如：

```tsx
if (!data) return ...
const x = useMemo(...)
```

这会导致生产环境 React #310：Rendered more hooks than during the previous render。

应改为：

```tsx
const x = useMemo(...)
if (!data) return ...
```

### 本地开发接口 404

如果使用 `npm run dev`，Vite 只服务前端，`/api/*` 可能不可用。

完整本地调试请用：

```bash
vercel dev
```

### 登录态缓存

`authStore` 会缓存 `me`。如果数据库用户信息已改但前端没更新，可能出现本地显示和数据库不一致。

必要时清理 localStorage 中 `oex_auth_v1` 或重新登录。

### 教师学科错误

题目保存、导入、一键组卷最终应以数据库 `users.subject_id` 和当前试卷 `subjectId` 为准。

如果题目出现错误学科，优先检查：

```sql
select id, display_name, school_no, role, subject_id
from public.users
where role = 'teacher';
```

### PowerShell 命令

Windows PowerShell 老版本不支持 `&&`。需要分开执行：

```powershell
node --check api/student.js
node --check api/teacher.js
```

## 17. 修改代码后的验证建议

前端/类型检查：

```bash
npm run check
```

后端 API 语法检查：

```bash
node --check api/student.js
node --check api/teacher.js
node --check api/admin.js
```

如果改了 Supabase 工具：

```bash
node --check server/supabase.js
```

如果改了评分逻辑：

```bash
npm test
```

## 18. 给后续 AI 的工作建议

1. 修改前先看 `src/types/domain.ts`，确认领域类型。
2. 涉及后端数据写入时，同时检查 `src/utils/remoteApi.ts` 和对应 `api/*.js`。
3. 涉及页面数据刷新时，检查对应 `src/hooks/domain/*Query.ts` 和 query key。
4. 涉及用户身份、学科、年级时，以数据库 `users` 表为权威来源。
5. 涉及学生答题和成绩详情时，特别注意 React Hooks 顺序。
6. 不要新增注释，除非用户明确要求。
7. 修改完成后至少运行 `npm run check`。
