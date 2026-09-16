import { ThemeProvider, ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { QueryClient, QueryClientProvider, type DefaultOptions } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { ApiClientProvider } from '../patterns/api-context';
import { DeviceRegistrationProvider } from '../patterns/device-registration';
import { LocalNetworkProvider } from '../patterns/local-network';
import { OutboxProvider } from '../patterns/outbox';
import { useRefetchOnRegain } from '../patterns/refetch-on-regain';
import { WorkerSessionProvider } from '../patterns/worker-session';
import { createOutboxTransport } from './outbox-transport';
import { apiClient } from './api';

/**
 * 서버 상태 캐시의 기본값.
 *
 * retry 0 — query-core의 재시도 경로는 문서가 숨겨져 있으면 재시도를 무기한 보류하고,
 * 그동안 상태가 pending이라 화면이 오류를 내지 못한 채 스켈레톤에 머문다.
 *
 * networkMode always — 기본값 online은 navigator.onLine이 거짓이면 요청을 보내기도 전에
 * 보류한다. 보류에 갇히면 오프라인 안내조차 뜨지 않는다.
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

const sendOutboxEntry = createOutboxTransport(apiClient);

/*
 * 끊겼다 붙는 자리는 모든 화면에 있다. 조회 캐시 안에서 한 번 듣고 멈춘 것을 다시 받는다 - 화면마다
 * 따로 두면 빠뜨린 화면이 값을 들고도 연결을 확인하라고 말한다.
 */
const RegainWatch = () => {
  useRefetchOnRegain();

  return null;
};

export const AppProviders = ({ children }: AppProvidersProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <RegainWatch />
      <ApiClientProvider client={apiClient}>
        <DeviceRegistrationProvider>
          <LocalNetworkProvider>
            <OutboxProvider send={sendOutboxEntry}>
              <WorkerSessionProvider>
                <ThemeProvider defaultTheme="system">
                  <ToastProvider label={messages.common.shell.notifications} position="top-center">
                    {children}
                  </ToastProvider>
                </ThemeProvider>
              </WorkerSessionProvider>
            </OutboxProvider>
          </LocalNetworkProvider>
        </DeviceRegistrationProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
};
