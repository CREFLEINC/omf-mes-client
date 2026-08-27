import { ToastProvider } from '@crefle/web-ui';
import { createApiClient, type ApiClient } from '@omf-mes/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  renderHook,
  type RenderHookResult,
  type RenderResult,
} from '@testing-library/react';
import type { ReactNode } from 'react';

import { appQueryDefaults } from '../app/providers';
import { ApiClientProvider } from '../patterns/api-context';

/** 테스트 전용 기준 URL. 실제로 접속하지 않으며 스텁 fetch가 모든 요청을 받는다. */
const TEST_BASE_URL = 'http://api.test';

export type StubFetch = (request: Request) => Promise<Response>;

export interface StubRoute {
  match: (request: Request) => boolean;
  respond: (request: Request) => Response;
}

export const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

/**
 * 규칙에 없는 요청은 조용히 404로 두지 않고 던진다 — 스텁을 빠뜨린 테스트가
 * 조회 실패 경로를 도는 것처럼 통과하면 안 된다.
 */
export const createStubFetch =
  (routes: StubRoute[]): StubFetch =>
  async (request: Request): Promise<Response> => {
    const route = routes.find((candidate) => candidate.match(request));

    if (route === undefined) {
      throw new Error(`스텁에 없는 요청입니다: ${request.method} ${request.url}`);
    }

    return route.respond(request);
  };

export interface ProviderOptions {
  fetch: StubFetch;
}

export type ProvidedRenderHookResult<TResult> = RenderHookResult<TResult, unknown> & {
  apiClient: ApiClient;
};

/**
 * 앱의 캐시 기본값을 그대로 쓴다. 여기서 값을 다시 적으면 앱이 바뀌어도 테스트는 옛
 * 값으로 계속 통과한다 — 오프라인으로 보고될 때 조회가 보류되는 실패가 그런 갈래다.
 * 다시 조회하지 않게 만드는 값만 덮는다.
 */
const createProviders = (fetch: StubFetch) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      ...appQueryDefaults,
      queries: { ...appQueryDefaults.queries, staleTime: 0 },
    },
  });
  const apiClient = createApiClient({ baseUrl: TEST_BASE_URL, fetch });

  const Providers = ({ children }: { children: ReactNode }): ReactNode => (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ToastProvider>{children}</ToastProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );

  return { apiClient, Providers };
};

/** 훅을 앱과 같은 데이터 계층 구성으로 돌린다. */
export const renderHookWithProviders = <TResult,>(
  hook: () => TResult,
  options: ProviderOptions,
): ProvidedRenderHookResult<TResult> => {
  const { apiClient, Providers } = createProviders(options.fetch);
  const result = renderHook(hook, { wrapper: Providers });

  return { ...result, apiClient };
};

export type ProvidedRenderResult = RenderResult & { apiClient: ApiClient };

/** 화면을 앱과 같은 프로바이더 구성으로 렌더한다. */
export const renderWithProviders = (
  ui: ReactNode,
  options: ProviderOptions,
): ProvidedRenderResult => {
  const { apiClient, Providers } = createProviders(options.fetch);
  const result = render(<Providers>{ui}</Providers>);

  return { ...result, apiClient };
};
