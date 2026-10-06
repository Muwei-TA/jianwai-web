# 验证记录与交付边界

记录日期：2026-10-06。

**前端类型检查、19 项单元测试、生产构建以及真实浏览器 9 组闭环检查已通过。独立代码审查提出的三组问题均已修复并复审关闭。当前尚未上线。**

## 已完成的验证

| 项目 | 已记录结果 | 实际范围与证据 |
|---|---|---|
| 类型检查 | `npm run typecheck`：exit 0 | 根代理完成最后一次全量验证；实施阶段及会话修复的独立复审也执行通过 |
| 前端单元测试 | `npm test`：6 个文件、19 项通过 | 根代理最后一次全量执行通过；Vitest 5.0.3，含新增的 5 项会话资源回归 |
| 生产构建 | `npm run build`：exit 0 | 根代理最后一次全量执行通过；这是静态产物构建，不代表容器或生产服务器已运行 |
| 前端依赖扫描 | `npm audit`：232 个依赖，0 项已知漏洞 | 根代理最终执行 exit 0；`work/development/web-audit-final.json` 的全部严重程度及 total 均为 0，结论限定于本次已知依赖漏洞扫描 |
| 配套 API | SQLite HTTP suite：20 passed | 根代理已重新执行，覆盖实际服务端权限、事务及内容校验；完整说明见相邻 API 仓库 `docs/verification.md` |
| 真实浏览器闭环 | 9 组检查全部 passed | 本仓库 `e2e/core-flow.mjs`；实际隔离 SQLite + FastAPI + Vite + Chromium |
| 独立代码审查 | 三组问题全部关闭，结论 Ready to merge — Yes | 相关修复和独立回归见下节 |

单元测试覆盖 API 错误语义、CSRF token 更新、危险 URL、正文安全渲染、富文本粘贴、保存队列、409 输入保留和导出、晚到保存响应、会话切换资源清理等行为。它们与服务端 HTTP 测试及浏览器闭环互相补充，不替代真实 PostgreSQL 或生产验证。

## 真实浏览器闭环

本次 `test-results/core-flow/result.json` 的状态为 `passed`，scope 明确为隔离的 SQLite、Vite、FastAPI 和 Chromium，包含以下 9 组检查：

| 序号 | 已通过的实际检查 |
|---|---|
| 1 | 团主在界面创建限定社团、绑定邮箱的邀请码 |
| 2 | 用户真实注册、一次性邮箱验证，并从地址栏移除验证 token |
| 3 | 预览不消耗邀请码，已验证账号接受后成功入团 |
| 4 | 真实编辑器的文字链接、跨软换行加粗、图片与图注，云保存及刷新后保留 |
| 5 | 未经审核的公开投稿对游客不可见 |
| 6 | 团主查看完整固定投稿快照并审批；游客读取正文与获准媒体，390px 视口无横向溢出 |
| 7 | 社区成员发表评论成功，游客提交评论被拒绝 |
| 8 | 在首页退出登录后，私密列表内容立即清除，服务端仍拒绝匿名读取原私帖 |
| 9 | 整条实际流程没有未捕获的浏览器错误 |

结果 JSON、桌面编辑器截图和手机视口阅读截图由脚本写入 `test-results/core-flow/`，该目录被 Git 忽略。可通过下述入口重新生成，不能把未附带在克隆仓库中的本地结果文件当作远端 CI 记录。

## 审查修复与回归

| 问题 | 修复及关闭证据 |
|---|---|
| 首页退出后显示旧账号的私密标题与摘要 | Web `04c475f`：资源按用户 ID、验证状态和成员资格失效；身份变化立即屏蔽旧响应，并阻止旧请求晚到回填。logout 成功先清身份，再刷新匿名 CSRF |
| 关联回归：CSRF 刷新保持编辑状态 | 上述修复不以 CSRF token 作为资源身份键。独立运行真实脏 Tiptap 编辑器回归，确认刷新保留原输入，取消退出时不发送 logout |
| 正常 Link 默认属性和格式化 hardBreak 无法保存 | API `7b86ef7`：安全兼容可选 Link title 和 hardBreak marks。真实编辑器 JSON 直接通过 API 保存，重新读取后完全相等；最终浏览器流程也覆盖链接与跨软换行加粗 |
| 旧 revision 幂等发布未校验原帖权限 | API `6539186`：按旧帖自身当前 ACL 检查后再返回，离团后重试不能借草稿改投另一团绕过 |

独立复审定向执行了前端会话资源测试 **5 passed**、API Tiptap HTTP 测试 **2 passed** 和 ACL 测试 **3 passed**；这些属于上述完整套件的相关子集，不另加到 19/20 的总数中。完整独立审查报告位于交付工作目录 `work/development/code-review.md`。

## 复跑方式

前端安装依赖后，在本仓库运行：

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

E2E 需要相邻 `../jianwai-api` 仓库与已安装依赖的 Python 环境，默认使用其 `.venv/bin/python`。可用 `JIANWAI_API_REPO` 和 `JIANWAI_API_PYTHON` 指定实际路径。Chromium 应通过 Playwright 安装，或用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向已安装、可执行的浏览器。

脚本仅启动 loopback 端口 8015 / 5175，创建一次性 SQLite、邮件 outbox、媒体目录和临时测试账号；端口占用时拒绝启动，不连接既有部署。邮箱验证读取本次本地 outbox，未经过真实 SMTP 投递。

## 尚未验证的环境与操作

| 项目 | 当前状态 |
|---|---|
| 真实 PostgreSQL | 配套 API 已实现并配置 CI，当前本地测试与浏览器闭环仍使用 SQLite；生产数据库迁移和行锁行为尚未实际验证 |
| Docker / Compose / NGINX 整套运行 | 配置已经编写并静态检查，尚未实际构建、启动或验收容器部署 |
| SMTP 实际邮件投递 | 邮件适配已实现；尚未验证真实服务认证、投递和收件，当前闭环使用开发 outbox |
| 远端 GitHub Actions | 配置已存在，尚未在远端执行；不能将本地通过结果称为远端 CI 通过 |
| 生产上线 | 未在目标服务器部署，未验证生产 HTTPS、域名、隧道、持久数据与备份恢复 |
| 手机与无障碍实机 | 仅验证了 Chromium 390px 视口阅读布局；未验证真实移动输入法、软键盘、触摸编辑和辅助技术 |

## GitHub 同步状态

目标私有仓库为 `Muwei-TA/jianwai-web` 和 `Muwei-TA/jianwai-api`。现有 GitHub 连接器没有建仓接口，用户已经允许通过 GitHub 网页补足。当前安全登录认证尚未通过，需在安全登录界面完成交接；两个远端仓库尚未创建，推送和远端 CI 仍待完成。

部署准备见 [deployment.md](deployment.md)，素材来源见 [assets.md](assets.md)，实际功能与首轮限制见 [README](../README.md)。
