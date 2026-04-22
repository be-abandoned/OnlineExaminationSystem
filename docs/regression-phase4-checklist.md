# 阶段4回归测试清单

本文档用于 Vercel + Supabase 重构后的主流程回归。

## 1. 自动化检查（已执行）

- `npm run check`：通过
- `npm run test -- --run`：通过（`src/utils/scoring.test.ts`，5/5）
- `npm run lint`：未通过（当前仓库存在历史与增量混合规则问题，合计 77 条，非本阶段单点阻断）

## 2. 管理员端冒烟

- 登录管理员账号
- 用户管理：
  - 列表加载
  - 新建/编辑用户
  - 批量启用/禁用
  - 单个删除/批量删除
  - Excel 批量导入
- 班级管理：
  - 列表加载
  - 新建/编辑班级
  - 删除班级（检查学生脱班）
- 工作台统计：
  - 学生/教师/管理员数量显示

## 3. 教师端冒烟

- 登录教师账号
- 题库：
  - 列表加载
  - 新建/编辑/删除
  - 批量删除
- 试卷：
  - 新建试卷
  - 编辑试卷信息
  - 选题入卷、排序、设置分值
  - 保存草稿
  - 发布到班级
- 阅卷：
  - 答卷列表可见
  - 选择答卷后详情可见
  - 保存人工分
  - 发布/撤回成绩
- 消息：
  - 发送全体公告
  - 发送指定学生公告
  - 已发送列表展示

## 4. 学生端冒烟

- 登录学生账号
- 工作台：
  - 我的考试列表可见
  - 详情跳转正常
- 考试详情：
  - 规则、题目预览正常
  - 开始/继续作答可用
- 作答页：
  - 保存答案
  - 倒计时显示
  - 手动交卷/自动交卷
- 结果页：
  - 未出分时受限显示
  - 出分后显示总分、题目明细、解析、评语
- 消息中心：
  - 接收全体公告
  - 接收定向公告

## 5. 数据一致性核对

- 发布试卷后：
  - `exam_assignments` 与班级学生数量一致
- 提交答卷后：
  - `attempts.status = submitted`
  - `attempt_answers.auto_score` 已更新（客观题）
- 教师阅卷后：
  - `attempt_answers.manual_score` 与评语更新
  - `attempts.total_score` 与明细汇总一致
  - `attempts.score_published` 状态正确

## 6. 上线前确认

- Supabase 已执行 `supabase/schema.sql`
- Supabase 已执行 `supabase/rls.sql`
- Vercel 环境变量已配置：
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
