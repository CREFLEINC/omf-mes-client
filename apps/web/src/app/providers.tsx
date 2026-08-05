import { ThemeProvider, ToastProvider } from '@crefle/web-ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiClientProvider } from '../patterns/api-context';
import { apiClient } from './api';

/**
 * 서버 상태 캐시의 기본값.
 * - refetchOnWindowFocus: 편집 중인 폼이 있는 화면에서 창 포커스마다 재조회하면 값이 흔들린다.
 * - staleTime 30초: 마스터 자료는 초 단위로 바뀌지 않는다. 탭 전환마다 재요청하지 않는다.
 * - mutations.retry 0: 멱등 키가 있어도 결과는 사용자가 보고 판단해야 한다.
 *   자동 재시도는 실패 원인을 감춘다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

/** 앱 전역 프로바이더. 데이터 계층이 가장 바깥, 표현 계층이 안쪽이다. */
export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ThemeProvider defaultTheme="system">
          <ToastProvider position="bottom-right">{children}</ToastProvider>
        </ThemeProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
};
