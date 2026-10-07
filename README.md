# 黑匣子 · Web

邀请制兴趣社团社区前端，V0.1。React + TypeScript + Vite + Tiptap，配套 `jianwai-api` 服务端。

深墨与纸白的刊物界面，社团通过邀请码加入，公开文章与社团内容按服务端权限展示。页面连接真实 API，账号与草稿不由浏览器模拟角色或 localStorage 冒充后端。没有嵌入虚构私密帖子。

## 运行

需要Node.js 24，先按API仓库README启动后端。

```bash
npm ci
npm run dev
```

访问 `http://localhost:5173`。默认 `/api` 代理到 `http://127.0.0.1:8000`；可用`.env`中的`VITE_API_PROXY_TARGET`调整代理目标。生产始终使用同源API。

## 页面和能力

| 页面 | 路由 | 行为 |
| --- | --- | --- |
| 首页与社团 | `/`、`/clubs`、`/clubs/:id` | 实际有权阅读的内容、加载/错误/空状态 |
| 账号 | `/register`、`/login`、`/verify` | 注册、邮箱验证、登录退出；Cookie会话 |
| 找回密码 | `/forgot-password`、`/reset-password` | 通过注册邮箱的一次性链接设置新密码 |
| 入团 | `/join` | 预览不消耗，验证邮箱后接受邀请 |
| 创作间 | `/workspace` | 多草稿与本人投稿状态 |
| 写作 | `/write/:id` | 富文本云保存、版本冲突保留输入、导出、预览、发布 |
| 阅读 | `/posts/:id` | 安全正文、动态附件、按资格评论 |
| 审核 | `/reviews` | 团主阅读固定完整快照后通过/退回 |

富文本支持H2/H3、粗体/斜体/下划线、列表、引用、剧透、图片与图注/画面描述、图集、链接卡片、分隔线以及独立封面。正文格式以Tiptap JSON与服务端契约一致保存；外部HTML粘贴净化，自定义节点内部复制粘贴保留结构。图片上传到API，不保存任意外部图片地址。

保存有串行队列与revision版本号；服务器返回409时保留本页输入并提供导出/显式重新加载，不静默覆盖。提交发布先保存，后端绑定不可变版本。

## 验证与构建

```bash
npm run typecheck
npm test
npm run build
```

跨仓真实浏览器验证：

```bash
npx playwright install chromium
npm run test:e2e
```

要求API仓库位于相邻`../jianwai-api`且已安装`.venv`；可用`JIANWAI_API_REPO`和`JIANWAI_API_PYTHON`指定。脚本只启动专用loopback端口8015/5175和临时数据库，若端口被占用会拒绝运行，不连接既有部署。结果在被忽略的`test-results/core-flow`；如使用已安装浏览器可设`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。

## 部署与文档

前端Docker镜像由NGINX提供静态内容与API反向代理。两个仓库相邻放置，在API仓库运行compose。具体启动、HTTPS、SMTP、数据库与媒体卷配置见[部署说明](docs/deployment.md)。

- [架构](docs/architecture.md)
- [接口契约](docs/api-contract.md)
- [实施计划](docs/superpowers/plans/2026-10-06-core-community.md)
- [测试与交付范围](docs/verification.md)
- [视觉和资产来源](docs/assets.md)

这是第一轮开发版本。尚未完成移动端真实输入法/软键盘与无障碍实机验证；暂无图片高级裁剪、图集拖排、多人实时协作和草稿历史回滚。后端SMTP、PostgreSQL、生产部署状态以配套API说明及验证记录为准。
