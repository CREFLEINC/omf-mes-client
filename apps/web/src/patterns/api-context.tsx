import type { ApiClient } from '@omf-mes/api-client';
import { createContext, use, type ReactNode } from 'react';

/**
 * 계약 클라이언트를 화면에 내려 주는 컨텍스트.
 *
 * 기준 URL 같은 설정은 app/이 소유하고 컨텍스트는 여기가 소유한다 —
 * 허용 의존 규칙이 patterns → app 참조를 막기 때문이다(app-inner-direction).
 * 이렇게 나눠 두면 테스트가 다른 클라이언트를 주입할 수 있다.
 */
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
