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
 * - networkMode 'always': 기본값은 브라우저가 오프라인이라고 보고하면 요청을 **보류**해
 *   조회가 영원히 「불러오는 중」에 머물고 오류도 나지 않는다. 사용자가 빠져나올 방법이 없다.
 *   navigator.onLine은 브라우저에 네트워크 연결이 있는지만 말하고 **우리 서버에 닿는지는
 *   말하지 않는다** — 이 화면의 서버는 같은 기기(목 서버)나 사내망에 있을 수 있다.
 *   실패는 보류하지 말고 오류로 드러내 「다시 시도」를 사용자가 고르게 한다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      networkMode: 'always',
    },
    mutations: { retry: 0, networkMode: 'always' },
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
