# 间外 Web 核心闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 延续 V2 视觉且实际连接 API 的响应式社区网站。

**Architecture:** React 路由页面、统一 API/Session 层、Tiptap 编辑器与安全正文 renderer 分离。所有权限以后端响应为准；云草稿带 revision，无本地身份模拟。

**Tech Stack:** React、TypeScript、Vite、Tiptap 3.31.4；依赖锁定。

**Spec:** docs/architecture.md, docs/api-contract.md

## Global Constraints
- 遵守 docs/architecture.md 与 docs/api-contract.md，接口字段与 Tiptap JSON 完全一致。
- 用户授权开发与创建新仓库；沿用 V2 设计。范围外功能记录 backlog，不扩张首版。
- 私有仓库拟定 Muwei-TA/jianwai-web 与 Muwei-TA/jianwai-api。现有 GitHub 连接器缺少建仓接口，用户已允许通过 GitHub 网页补足；当前远端创建和同步的实际阻塞是安全登录流程尚未完成，本地实施持续进行。
- 不触碰旧 jianwai-prototype 的源码与远端；分离工作目录和提交。禁止生产演示登录、默认密码、私密内容静态打包。

## Review Focus
- 两账号同时兑换一次性邀请码，不得产生两个有效兑换；绑定、撤销和离团重试一致。
- 草稿快速编辑/保存失败/旧版本冲突不丢用户输入，审核绑定不可变快照。
- 知道帖子/媒体 ID 的未授权账号也不能看到私密数据；列表、详情与评论一致。
- 手工伪造富文本 JSON、URL、媒体类型和他人 assetId 时服务端拒绝，前端不注入任意 HTML。
- 中文标题、窄屏与长文本不溢出；未登录/未验证/无社团状态可清晰继续流程。

---

### Task 1: API、会话与内容浏览
**Files:** package.json, src/api.ts, src/types.ts, src/App.tsx, src/pages/Home.tsx, src/pages/Auth.tsx, src/pages/Clubs.tsx, src/styles.css, tests/api.test.ts
**Interfaces:** api<T>(path,options) 同源 credentials+CSRF；Session 在内存中。全部路径和字段与契约一致。
- [x] 写并运行 API 失败语义/会话刷新测试，禁止把 401/409当成功。
- [x] 建 React/Vite 工程，路由首页/社团/邀请/登录注册/验证；复用 V2 合法素材与视觉。
- [x] 类型检查与测试通过；实施窄屏导航和真实空/错/加载态并提交。浏览器已验证 390px 阅读视口，未作移动端实机验收。

### Task 2: 富文本、多草稿与审核
**Files:** src/editor/*, src/pages/Editor.tsx, src/pages/Post.tsx, src/pages/Workspace.tsx, src/pages/Reviews.tsx, tests/editor.test.ts
**Interfaces:** Tiptap 节点定义与后端 validator 一致；保存传 revision；发布只引用最后已保存版本。
- [x] 写并运行安全 URL/renderer/保存队列行为测试：旧保存不得覆写新输入、409 保留输入且可以导出、本地附件失败不假成功。
- [x] 实现选区格式、块插入、图片图注/图集、链接卡片、剧透、独立封面、预览、发布范围、作者状态页和固定快照审核。
- [x] 实现帖子阅读与纯文本评论，真实邀请码生成/一次展示/兑换/撤销和离团。
- [x] 测试、类型检查、生产构建通过；提交实现并报告限制，修复后为 6 个测试文件、19 项通过。
- [x] 修复首页退出后的旧身份私密资源残留；新增 5 项回归，包含旧响应、账号切换及真实脏编辑器在 CSRF 刷新后保留输入；独立复审关闭。

### Task 3: 集成与交付（根代理负责）
**Files:** Dockerfile, nginx.conf, .github/workflows/ci.yml, README.md, e2e/
**Interfaces:** /api 反向代理 API，SPA fallback；prod 安全头与私密响应不缓存。
- [x] 真实后端联调完成浏览器 9 组检查：账号验证、入团、富文本与图片保存刷新、审批、游客阅读、评论和首页退出隐私；390px 阅读视口无横向溢出。
- [x] 完成部署、验证与资产授权记录；三组审查问题修复并复审关闭，见 docs/verification.md。
- [x] 根代理统一提交最终部署、CI、E2E、README 与验证材料（随本次本地交付提交保存）。
- [ ] 完成安全登录后创建两个私有 GitHub 仓库并推送；网页补足已获允许，当前阻塞为登录流程，尚未完成远端同步。
