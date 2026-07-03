# PBL · AI 智能对话前端

基于 **Vue 3 + TypeScript + Vite** 构建的 AI 聊天应用前端，配合 FastAPI 后端（默认 `http://localhost:8000`）实现流式对话、文件分析、意图识别与多会话管理。

## ✨ 功能特性

- 🔐 **用户认证**：登录 / 注册，基于 JWT Token 鉴权，自动注入到请求头。
- 💬 **多会话管理**：创建、切换、删除会话；按"今天 / 昨天 / 更早"自动分组。
- ⚡ **流式对话**：基于 SSE（Server-Sent Events）逐字渲染 AI 回复，支持会话标题自动生成。
- 📎 **文件上传与分析**：支持 Word（.doc/.docx）、TXT 文件上传，附带文件分析能力。 
- 🏷️ **意图识别标签**：在每条 AI 消息上展示识别到的意图（RAG 检索、智能对话、文件分析、在线搜索）。
- 📝 **Markdown 渲染**：启用 GFM 与换行支持，支持代码块、表格、引用、链接等。
- 📚 **引用来源展示**：RAG 检索结果可显示来源片段。
- 🎨 **响应式 UI**：自定义 CSS 变量主题，干净的聊天气泡式布局。
- 🛡️ **友好的错误提示**：根据 HTTP 状态码（400/401/403/404/429/5xx）给出本地化错误信息。

## 🧱 技术栈

| 类型 | 技术 |
| --- | --- |
| 框架 | Vue 3.5（`<script setup>` + Composition API） |
| 语言 | TypeScript 6 |
| 构建 | Vite 8 |
| HTTP | Axios 1.18 |
| 流式通信 | 原生 `fetch`|
| Markdown | marked 18 |
| 代码规范 | `@vue/tsconfig`|

## 📁 项目结构

```
PBL/
├── index.html                  # 入口 HTML
├── vite.config.ts              # Vite 配置（含 /api 代理到 FastAPI）
├── tsconfig.json               # TS 根配置
├── tsconfig.app.json           # 应用 TS 配置（含 @/* 路径别名）
├── tsconfig.node.json          # Node 端 TS 配置
├── package.json
└── src/
    ├── main.ts                 # 应用入口
    ├── App.vue                 # 根组件，登录/聊天视图切换
    ├── style.css               # 全局样式与 CSS 变量
    ├── env.d.ts                # Vite 类型声明
    ├── api/
    │   └── request.ts          # axios 实例，拦截器注入 Token
    ├── types/
    │   └── user.ts             # 用户与认证响应类型
    └── components/
        ├── LoginView.vue       # 登录 / 注册页
        └── ChatLayout.vue      # 主聊天界面（侧栏 + 消息区 + 输入区）
```

## 🔧 环境要求

- Node.js ≥ 18（推荐 20+）
- 包管理器：npm（也可使用 pnpm / yarn）
- 后端服务：FastAPI，默认监听 `http://localhost:8000`

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 构建生产包
npm run build

# 4. 本地预览生产构建
npm run preview
```

> 启动前请确保后端 FastAPI 服务已运行，否则登录、对话、文件上传等接口会失败。

## ⚙️ 配置说明

### Vite 代理

[vite.config.ts](file:///e:/Code/PBL/PBL/vite.config.ts) 中将所有 `/api` 请求代理到 `http://localhost:8000`，并会去掉 `/api` 前缀：

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

如需修改后端地址，调整 `target` 即可。

### 路径别名

`@` 指向 `src/`，在 [tsconfig.app.json](file:///e:/Code/PBL/PBL/tsconfig.app.json) 与 [vite.config.ts](file:///e:/Code/PBL/PBL/vite.config.ts) 中均已配置：

```ts
import request from '@/api/request'
import type { AuthResponse } from '@/types/user'
```

### 主题变量

全局 CSS 变量定义于 [src/style.css](file:///e:/Code/PBL/PBL/src/style.css)，可按需替换：

```css
:root {
  --bg-primary: #f7f7f8;
  --bg-sidebar: #ffffff;
  --border-color: #e5e5e5;
  --primary-color: #42b983;
  --text-main: #333;
  --text-sub: #888;
}
```

## 🔌 后端接口约定

前端依赖以下接口（实际路径已通过代理去掉 `/api` 前缀）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/user/login` | 登录，返回 `access_token` 与 `user` |
| POST | `/user/register` | 注册 |
| GET | `/chat/conversation/list` | 获取会话列表 |
| POST | `/chat/conversation/create` | 新建会话 |
| GET | `/chat/conversation/{id}/history` | 获取指定会话的历史消息 |
| POST | `/chat/agent/stream` | 流式对话（SSE，普通对话） |
| POST | `/upload/file` | 上传文件（`multipart/form-data`） |
| POST | `/upload/analyze` | 文件分析（带 `file_ids`） |
| DELETE | `/upload/{file_id}` | 删除已上传文件 |

### SSE 数据格式

流式接口每条事件以 `data:` 前缀 + JSON 文本发送，消息之间用 `\n\n` 分隔。支持的字段：

- `content`：增量文本内容
- `intent`：字符串或字符串数组（意图标识）
- `title`：会话标题（用于自动更新侧栏）
- `type: 'sources'` + `sources`：引用来源
- `[DONE]`：流结束标志

意图标识与前端展示映射（见 [ChatLayout.vue](file:///e:/Code/PBL/PBL/src/components/ChatLayout.vue)）：

| intent 值 | 标签 | 图标 | 颜色 |
| --- | --- | --- | --- |
| `rag_chat_tool` | RAG 检索 | 📚 | #4CAF50 |
| `chat` | 智能对话 | 💬 | #2196F3 |
| `file_analysis` | 文件分析 | 📄 | #FF9800 |
| `tavily_search_tool` | 在线搜索 | 🔍 | #9C27B0 |

## 📦 部署

```bash
npm run build
```

构建产物位于 `dist/`，可托管到任意静态服务器（Nginx / Vercel / Cloudflare Pages 等）。部署时需将 `/api/*` 反向代理到 FastAPI 后端，例如 Nginx：

```nginx
location /api/ {
    proxy_pass http://localhost:8000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_buffering off;            # SSE 必须关闭缓冲
    proxy_read_timeout 300s;
}
```

> ⚠️ SSE 流式接口要求代理关闭缓冲（`proxy_buffering off;`），否则会出现消息一次性吐出的现象。

## 📝 备注

- Token 与 `userId` 存储于 `localStorage`，登出时清除。
- 401 响应会在 [request.ts](file:///e:/Code/PBL/PBL/src/api/request.ts) 拦截器中自动跳转到 `/login`。
- 当前会话发生新消息后，会话会自动置顶到侧栏首位。
