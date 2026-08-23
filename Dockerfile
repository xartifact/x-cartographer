# ---- 依赖安装（monorepo 根）----
FROM oven/bun:1-alpine AS deps
WORKDIR /app

# 仅复制各 workspace 的 package.json + 锁文件，最大化层缓存
COPY package.json bun.lock* ./
COPY apps/web/package.json ./apps/web/
COPY apps/server/package.json ./apps/server/
COPY apps/cli/package.json ./apps/cli/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/

RUN bun install --frozen-lockfile --ignore-scripts

# ---- 构建 web（Vite 产物）----
FROM deps AS build
WORKDIR /app

COPY . .

# 生产 API 地址：默认同源（由 compose 同端口反代 /api）；可用 VITE_API_URL 覆盖
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

RUN bun run --cwd apps/web build

# ---- 运行时（bun 直接跑 TS 源码）----
FROM oven/bun:1-alpine AS runner
WORKDIR /app

# 复制安装好的依赖（含 workspace 链接）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/cli/node_modules ./apps/cli/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# 工作区 package.json（运行时保持 workspace:^ 解析）
COPY package.json tsconfig.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY apps/cli/package.json ./apps/cli/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/db/package.json ./packages/db/

# 服务器 TS 源码 + 源码引用的 schema/迁移
COPY apps/server/src ./apps/server/src
COPY packages/shared/src ./packages/shared/src
COPY packages/ui/src ./packages/ui/src
COPY packages/db/src ./packages/db/src

# 前端构建产物（由 gateway 静态托管 /）
COPY --from=build /app/apps/web/dist ./apps/web/dist

ENV NODE_ENV=production
ENV PORT=8787
ENV HOST=0.0.0.0

EXPOSE 8787

CMD ["bun", "run", "apps/server/src/index.ts"]