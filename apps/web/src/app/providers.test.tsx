import { ToastProvider } from '@crefle/web-ui';
import { createApiClient } from '@omf-mes/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiClientProvider } from '../patterns/api-context';
import { WarehouseLocationScreen } from '../screens/warehouse-location/screen';
import { appQueryDefaults } from './providers';

/**
 * 서버에 닿지 못할 때 화면이 「불러오는 중」에 갇히지 않는지 본다.
 *
 * 이 테스트는 **앱이 실제로 쓰는 캐시 기본값**(appQueryDefaults)으로 돈다.
 * 화면 테스트가 쓰는 하네스는 재시도를 꺼 두므로 이 결함을 잡지 못한다 —
 * 결함이 재시도 경로에 있기 때문이다. 두 설정이 갈라지지 않게 여기서 정본을 직접 검사한다.
 */

/** 연결이 거부됐을 때 브라우저가 겪는 것 — 응답이 없고 fetch가 예외를 던진다. */
const refusingFetch = async (): Promise<Response> => {
  throw new TypeError('Failed to fetch');
};

/**
 * jsdom의 기본 visibilityState는 'visible'이라 숨겨진 문서를 흉내 내야 한다.
 * 이 값이 이 결함이 브라우저에서만 드러난 이유다.
 */
const setVisibility = (value: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true });
};

afterEach(() => {
  setVisibility('visible');
});

const renderWithAppDefaults = () => {
  const queryClient = new QueryClient({ defaultOptions: appQueryDefaults });
  const apiClient = createApiClient({ baseUrl: 'http://api.test', fetch: refusingFetch });

  render(
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={['/master-data/warehouse-location']}>
            <WarehouseLocationScreen />
          </MemoryRouter>
        </ToastProvider>
      </ApiClientProvider>
    </QueryClientProvider>,
  );
};

describe('앱 캐시 기본값 — 조회 실패의 종결', () => {
  it('보이는 문서에서 조회 실패가 오류 배너로 종결된다', async () => {
    setVisibility('visible');
    renderWithAppDefaults();

    expect(
      await screen.findByText('목록을 불러오지 못했습니다', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: '창고 목록을 불러오는 중' }),
    ).not.toBeInTheDocument();
  }, 10000);

  /*
   * 문서가 숨겨져 있으면 query-core는 재시도를 무기한 보류한다(focusManager.isFocused()).
   * 자동 재시도가 있으면 그 보류 구간에 갇혀 화면이 영원히 스켈레톤에 머문다.
   */
  it('숨겨진 문서에서도 조회 실패가 오류 배너로 종결된다 — 보류에 갇히지 않는다', async () => {
    setVisibility('hidden');
    renderWithAppDefaults();

    expect(
      await screen.findByText('목록을 불러오지 못했습니다', undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: '창고 목록을 불러오는 중' }),
    ).not.toBeInTheDocument();
  }, 10000);

  it('조회 재시도를 자동으로 하지 않는다 — 재시도는 「다시 시도」로 사용자가 고른다', () => {
    expect(appQueryDefaults.queries?.retry).toBe(0);
  });

  it('첫 요청은 오프라인 보고와 무관하게 나간다', () => {
    expect(appQueryDefaults.queries?.networkMode).toBe('always');
    expect(appQueryDefaults.mutations?.networkMode).toBe('always');
  });
});
