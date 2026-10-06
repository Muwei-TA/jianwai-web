# 前端运行与部署

使用 Node.js 24。安装 `npm ci`，开发 `npm run dev`，类型检查 `npm run typecheck`，测试 `npm test`，生产构建 `npm run build`。前端通过同源 `/api/v1` 请求后端，浏览器不保存登录 token。

开发访问 `http://localhost:5173`，由 Vite 将 `/api` 转到 `127.0.0.1:8000`。后端应把前端 URL 加入 ALLOWED_ORIGINS。跨端口直接调用后端会使会话与 Cookie 行为不同，不是默认配置。

`Dockerfile` 使用 Node 编译，再由 NGINX 提供静态文件、SPA路由和 API代理。将 web/api 两仓库放在相邻目录，在 API 仓库使用 `compose.yaml` 统一启动。NGINX 的 API upstream 名称是 api:8000，单独运行前端镜像需要提供同名服务。完整部署与 HTTPS 入口配置见 API 仓库 docs/deployment.md。

本仓库的 CI 只验证前端构建、单元测试和容器构建。实际账号/邀请/草稿/审核跨仓联调结果单独记录在 docs/verification.md，静态构建成功不代表后端或邮件已部署。
