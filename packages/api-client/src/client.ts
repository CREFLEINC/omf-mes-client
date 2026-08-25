import createClient from 'openapi-fetch';

import type { paths } from './generated/api';
import { createEtagStore, type EtagStore } from './etag-store';

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: (request: Request) => Promise<Response>;
}

export interface ApiClient {
  client: ReturnType<typeof createClient<paths>>;
  etags: EtagStore;
}

/**
 * 배열 질의를 **쉼표로 잇는다** — 계약이 그렇게 정해 두었다(`style: form` · `explode: false`).
 *
 * ⛔ **기본 직렬화(`explode: true`)를 그대로 두면 안 된다.** `openapi-fetch` 는 배열을
 * `k=a&k=b` 로 반복해 보내는데, 계약이 정한 것은 `k=a,b` 다. 두 모양은 **서버가 다르게
 * 읽는다** — 반복 키를 하나만 취하는 구현에서는 조건이 조용히 좁아지고, 그 결과는 화면에
 * 오류가 아니라 **모자란 목록**으로 나타나 알아채기 어렵다.
 *
 * ⭐ **모든 배열 질의가 한 규약을 쓴다** — 계약의 배열 질의는 지금 둘(설비 유형·대상 식별자)
 * 이고 둘 다 같은 표기다. 화면마다 직렬화를 다시 정하면 그 규약이 흩어진다.
 */
const serializeQuery = (query: Record<string, unknown>): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    /* 빈 배열은 조건이 아니다 — 보내면 「빈 조건」이 되어 서버가 거절한다. */
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.map(String).join(','));
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
};

/**
 * 계약 기반 클라이언트. 응답의 ETag를 경로별로 자동 캡처한다 —
 * 저장 응답의 ETag까지 받아 갱신해야 연속 수정 시 재조회가 필요 없다(공유계약 B-1).
 */
export const createApiClient = (options: ApiClientOptions): ApiClient => {
  const etags = createEtagStore();
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    querySerializer: serializeQuery,
  });

  client.use({
    onResponse({ request, response }) {
      const etag = response.headers.get('ETag');
      if (etag !== null) {
        etags.capture(new URL(request.url).pathname, etag);
      }
      return response;
    },
  });

  return { client, etags };
};
