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

# 사용자 등록 폼의 초기 비밀번호 기본값. 비우면 화면 코드의 기본값으로 떨어지므로,
# 배포처마다 다른 값을 쓸 때만 넘긴다.
#
# ⛔ **시험(`vitest`) «뒤», 빌드 «앞»이 이 선언의 자리다.** 위로 올리면 넘긴 값이
#    `import.meta.env` 로 시험 실행에까지 들어간다 — vite 는 `process.env` 의 `VITE_*` 를
#    `.env` 파일보다 먼저 읽는다. 그러면 등록 폼의 기본값이 «넘긴 값»으로 바뀌고, 그 값이
#    화면 규칙(숫자+알파벳 8자)을 우연히 어기면 **코드와 무관하게 CI 에서만** 등록 시험이
#    깨진다. 시험이 보는 기본값은 언제나 코드 상수 하나여야 한다.
#
# ⚠ 이 값은 **빌드 산출물 JS 에 박힌다** — 그것이 실제로 드러나는 자리다. 최종 이미지는
#   아래 nginx 단계라 이 `build` 단계의 `ARG`·`ENV` 는 배포 이미지 이력에 남지 않는다.
ARG VITE_DEFAULT_INITIAL_PASSWORD=
ENV VITE_DEFAULT_INITIAL_PASSWORD=${VITE_DEFAULT_INITIAL_PASSWORD}

# 관리웹 사이드바에 표기할 릴리스 태그(`web-vX.Y.Z`). 비우면 화면이 「개발 빌드」로 표기한다.
#
# ⛔ 자리는 위 선언과 같은 이유로 **시험 «뒤», 빌드 «앞»**이다. 태그마다 값이 바뀌므로 위로
#    올리면 시험 층의 캐시까지 매 릴리스 무효가 된다.
ARG VITE_APP_VERSION=
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

RUN pnpm --filter @omf-mes/web build

FROM nginx:1.28.3-alpine AS runtime

COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --output-document=- http://127.0.0.1:8080/healthz >/dev/null || exit 1
