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
 * - networkMode 'always': 기본값은 navigator.onLine이 거짓이면 요청을 **보류**하고
 *   상태를 pending에 묶어 둔다 — 오류가 나지 않으니 화면은 「불러오는 중」에 머물고
 *   「다시 시도」조차 렌더되지 않는다.
 *   navigator.onLine이 거짓이라는 것은 「브라우저에 네트워크 연결이 없다」는 뜻이지
 *   「우리 서버에 닿지 못한다」는 뜻이 아니다. 이 제품에서 둘은 자주 어긋난다 —
 *   서버가 같은 기기에 있는 경우(개발 중 목 서버, 산업용 패널 PC의 POP 셸)에는
 *   랜선이 빠져 onLine이 거짓이어도 127.0.0.1은 그대로 닿는다.
 *   닿는지 여부는 요청을 보내 봐야 알 수 있으므로 보류하지 않고 보낸다.
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
