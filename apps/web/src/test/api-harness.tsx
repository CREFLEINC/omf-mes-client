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
import { MemoryRouter } from 'react-router';

import { ApiClientProvider } from '../patterns/api-context';

/** 테스트 전용 기준 URL. 실제로 접속하지 않으며 스텁 fetch가 모든 요청을 받는다. */
const TEST_BASE_URL = 'http://api.test';

export type StubFetch = (request: Request) => Promise<Response>;

export interface StubRoute {
  match: (request: Request) => boolean;
  respond: (request: Request) => Response;
}

/** 본문이 있는 응답을 만든다. 계약 응답은 전부 JSON이다. */
export const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

/**
 * 요청을 규칙 목록에 맞춰 응답한다.
 * 규칙에 없는 요청은 조용히 404로 두지 않고 던진다 — 스텁을 빠뜨린 테스트가
 * 「조회 실패」 경로를 도는 것처럼 통과하면 안 된다.
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

const unstubbedFetch: StubFetch = async (request: Request): Promise<Response> => {
  throw new Error(`요청 스텁이 없습니다: ${request.method} ${request.url}`);
};

export interface ProviderOptions {
  fetch?: StubFetch;
  /** 초기 URL. 조회 조건을 URL로 두는 화면의 시작 상태를 정한다. */
  route?: string;
}

interface TestEnvironment {
  queryClient: QueryClient;
  apiClient: ApiClient;
  Providers: ({ children }: { children: ReactNode }) => ReactNode;
}

const createEnvironment = (options: ProviderOptions): TestEnvironment => {
  /*
   * 재시도를 끈다 — 실패가 즉시 드러나야 테스트가 원인을 가리키지 않고 느려지기만 하는 일이 없다.
   * networkMode는 앱과 같은 값을 쓴다(app/providers.tsx). 여기서만 기본값을 두면
   * 「오프라인으로 보고될 때 조회가 보류된다」는 실패를 테스트가 통과시켜 버린다.
   */
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  const apiClient = createApiClient({
    baseUrl: TEST_BASE_URL,
    fetch: options.fetch ?? unstubbedFetch,
  });
  const route = options.route ?? '/';

  const Providers = ({ children }: { children: ReactNode }): ReactNode => (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </ToastProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );

  return { queryClient, apiClient, Providers };
};

export type ProvidedRenderResult = RenderResult & {
  queryClient: QueryClient;
  apiClient: ApiClient;
};

/** 화면을 앱과 같은 프로바이더 구성으로 렌더한다. */
export const renderWithProviders = (
  ui: ReactNode,
  options: ProviderOptions = {},
): ProvidedRenderResult => {
  const { queryClient, apiClient, Providers } = createEnvironment(options);

  const result = render(<Providers>{ui}</Providers>);

  return { ...result, queryClient, apiClient };
};

export type ProvidedRenderHookResult<TResult> = RenderHookResult<TResult, unknown> & {
  queryClient: QueryClient;
  apiClient: ApiClient;
};

/** 화면 없이 훅만 검사할 때 쓴다. 프로바이더 구성은 renderWithProviders와 같다. */
export const renderHookWithProviders = <TResult,>(
  hook: () => TResult,
  options: ProviderOptions = {},
): ProvidedRenderHookResult<TResult> => {
  const { queryClient, apiClient, Providers } = createEnvironment(options);

  const result = renderHook(hook, { wrapper: Providers });

  return { ...result, queryClient, apiClient };
};
