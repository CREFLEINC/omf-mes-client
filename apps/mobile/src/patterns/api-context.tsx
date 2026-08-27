import type { ApiClient } from '@omf-mes/api-client';
import { createContext, use, type ReactNode } from 'react';

// 기준 URL 같은 설정은 app/ 이 소유한다 — 허용 의존 규칙이 patterns → app 참조를 막는다.
const ApiClientContext = createContext<ApiClient | null>(null);

export interface ApiClientProviderProps {
  client: ApiClient;
  children: ReactNode;
}

export const ApiClientProvider = ({ client, children }: ApiClientProviderProps) => {
  return <ApiClientContext value={client}>{children}</ApiClientContext>;
};

export const useApiClient = (): ApiClient => {
  const client = use(ApiClientContext);

  if (client === null) {
    throw new Error('useApiClient는 ApiClientProvider 안에서만 쓸 수 있습니다.');
  }

  return client;
};
