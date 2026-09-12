import { ThemeProvider, ToastProvider } from '@crefle/web-ui';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiClientProvider } from '../patterns/api-context';
import { SessionProvider } from '../patterns/session';
import { apiClient } from './api';

/**
 * 서버 상태 캐시의 기본값.
 *
 * **실패는 언제나 오류로 종결돼야 한다.** 화면이 실패를 표현하는 수단은 오류 배너와
 * 「다시 시도」뿐이고, 그 둘은 쿼리가 오류 상태에 들어가야 렌더된다.
 * 아래 두 값이 그 종결을 보장한다 — 하나라도 빠지면 화면이 「불러오는 중」에 갇힌다.
 *
 * - **retry 0**: 재시도를 두면 실패와 재시도 사이에 **보류 구간**이 생긴다.
 *   query-core의 재시도 경로는 `focusManager.isFocused()`가 거짓이면(= 문서가 숨겨져 있으면)
 *   재시도를 **무기한 보류**한다. 그동안 상태는 pending이라 오류가 나지 않고,
 *   실패를 이미 인지했는데도(`failureReason`이 차 있다) 화면은 스켈레톤에 머문다.
 *   보류는 networkMode로 우회되지 않는다 — 포커스 조건이 먼저 걸린다.
 *   자동 재시도가 없으면 이 구간 자체가 사라지고, 재시도는 사용자가 「다시 시도」로 고른다.
 *   mutations가 이미 같은 이유로 0이었다(자동 재시도는 실패 원인을 감춘다).
 * - **networkMode 'always'**: 첫 요청이 나가는 것을 보장한다.
 *   기본값 'online'이면 `onlineManager`가 오프라인일 때 **요청을 보내기도 전에** 보류한다.
 *   navigator.onLine이 거짓이라는 것은 「브라우저에 네트워크 연결이 없다」는 뜻이지
 *   「우리 서버에 닿지 못한다」는 뜻이 아니다 — 서버가 같은 기기에 있는 경우
 *   (개발 중 목 서버, 산업용 패널 PC의 POP 셸)에는 랜선이 빠져도 127.0.0.1은 닿는다.
 *   닿는지는 보내 봐야 알 수 있다.
 *
 * 그 밖의 값:
 * - refetchOnWindowFocus: 편집 중인 폼이 있는 화면에서 창 포커스마다 재조회하면 값이 흔들린다.
 * - staleTime 30초: 마스터 자료는 초 단위로 바뀌지 않는다. 탭 전환마다 재요청하지 않는다.
 */
export const appQueryDefaults: DefaultOptions = {
  queries: {
    retry: 0,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    networkMode: 'always',
  },
  mutations: { retry: 0, networkMode: 'always' },
};

const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * 앱 전역 프로바이더. 데이터 계층이 가장 바깥, 표현 계층이 안쪽이다.
 *
 * **세션은 데이터와 표현 사이에 둔다.** 요청 계층보다 안쪽인 것은 세션이 요청의 결과이기
 * 때문이고, 표현 계층보다 바깥인 것은 셸(상단 바)과 화면이 **함께** 읽기 때문이다.
 */
export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <SessionProvider>
          <ThemeProvider defaultTheme="system">
            <ToastProvider position="bottom-right">{children}</ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
};
