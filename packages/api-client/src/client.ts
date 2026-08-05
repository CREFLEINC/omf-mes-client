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
 * 계약 기반 클라이언트. 응답의 ETag를 경로별로 자동 캡처한다 —
 * 저장 응답의 ETag까지 받아 갱신해야 연속 수정 시 재조회가 필요 없다(공유계약 B-1).
 */
export const createApiClient = (options: ApiClientOptions): ApiClient => {
  const etags = createEtagStore();
  const client = createClient<paths>({ baseUrl: options.baseUrl, fetch: options.fetch });

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
