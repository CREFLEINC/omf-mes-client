FROM node:24.19.0-alpine AS build

RUN npm install --global pnpm@11.20.0

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile --filter @omf-mes/web...

COPY apps/web apps/web
COPY packages packages

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN pnpm -r typecheck
RUN TZ=Asia/Seoul pnpm --filter @omf-mes/web exec vitest run --maxWorkers=4 --testTimeout=15000
RUN pnpm --filter @omf-mes/web build

FROM nginx:1.28.3-alpine AS runtime

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --output-document=- http://127.0.0.1:8080/healthz >/dev/null || exit 1
