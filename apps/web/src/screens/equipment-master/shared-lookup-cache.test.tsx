import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ApiClientProvider } from '../../patterns/api-context';
import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  useUomCodeById,
  useUomLookup as useCollectionChannelUomLookup,
} from '../collection-channel/queries';
import { useUomLookup as useGaugeMasterUomLookup } from '../gauge-master/queries';
import { useLookupOptions as useWarehouseLookupOptions } from '../warehouse-location/queries';
import { useUomOptions } from './queries';

/*
 * #1240 — 여러 화면이 `['lookups', 'uoms']` 한 키를 나눠 쓴다.
 *
 * ⛔ 한 화면이 그 키에 응답 원형(`{ items, page }`)이 아닌 모양을 담으면, 그 화면을 거친 뒤
 * 같은 키를 원형으로 읽는 화면이 렌더 중에 던져 오류 화면으로 죽는다. 화면 하나씩 따로 재는
 * 시험은 QueryClient 를 새로 만들어 이 결합을 보지 못하므로, 여기서는 **한 캐시를 공유**한다.
 */

const uomItems = [
  { uomId: 1, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
  { uomId: 2, uomCode: 'KG', uomName: '킬로그램', decimalScale: 3, isActive: false },
];

const emptyList = () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } });

const routes: StubRoute[] = [
  {
    match: (request) => new URL(request.url).pathname === '/mdm/uoms',
    respond: () =>
      jsonResponse({ items: uomItems, page: { page: 1, size: 200, total: uomItems.length } }),
  },
  // 창고·Location 조회 훅이 함께 부르는 다른 선택 목록 — 이 시험의 관심사가 아니라 비워 둔다.
  {
    match: (request) =>
      ['/mdm/plants', '/mdm/business-units', '/mdm/partners', '/mdm/code-values'].includes(
        new URL(request.url).pathname,
      ),
    respond: emptyList,
  },
];

/** 첫 화면을 띄워 캐시를 채운 뒤, 그 캐시를 그대로 둔 채 다음 화면의 훅을 띄운다. */
const visitInOrder = async <TFirst, TSecond>(
  first: () => TFirst,
  isFirstLoaded: (result: TFirst) => boolean,
  second: () => TSecond,
) => {
  const visited = renderHookWithProviders(first, { fetch: createStubFetch(routes) });

  await waitFor(() => {
    expect(isFirstLoaded(visited.result.current)).toBe(true);
  });
  visited.unmount();

  const Providers = ({ children }: { children: ReactNode }): ReactNode => (
    <QueryClientProvider client={visited.queryClient}>
      <ApiClientProvider client={visited.apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );

  return renderHook(second, { wrapper: Providers });
};

describe('단위 조회 공유 캐시 (#1240)', () => {
  it('설비 마스터를 거친 뒤 창고·Location 단위 선택지를 푼다', async () => {
    const { result } = await visitInOrder(
      useUomOptions,
      (query) => query.data !== undefined,
      useWarehouseLookupOptions,
    );

    await waitFor(() => {
      expect(result.current.sources.uoms.entries.map((entry) => entry.label)).toEqual(['EA', 'KG']);
    });
  });

  it('설비 마스터를 거친 뒤 계측기 마스터 단위 선택지를 푼다', async () => {
    const { result } = await visitInOrder(
      useUomOptions,
      (query) => query.data !== undefined,
      useGaugeMasterUomLookup,
    );

    await waitFor(() => {
      expect(result.current.uoms.map((uom) => uom.value)).toEqual(['1', '2']);
    });
  });

  it('설비 마스터를 거친 뒤 수집 채널 단위 선택지와 식별자→코드 표를 푼다', async () => {
    const { result } = await visitInOrder(
      useUomOptions,
      (query) => query.data !== undefined,
      () => ({ lookup: useCollectionChannelUomLookup(), codeById: useUomCodeById() }),
    );

    await waitFor(() => {
      expect(result.current.lookup.uoms.map((uom) => uom.value)).toEqual(['EA', 'KG']);
    });
    expect(result.current.codeById.get(2)).toBe('KG');
  });

  it('다른 화면을 거친 뒤 설비 마스터 단위 선택지를 푼다', async () => {
    const { result } = await visitInOrder(
      useWarehouseLookupOptions,
      (lookup) => lookup.sources.uoms.entries.length > 0,
      useUomOptions,
    );

    // 다시 받기 «전», 캐시에 남은 원형으로 그리는 첫 렌더부터 배열이어야 한다 — 화면이 곧장 `.map` 한다.
    expect(Array.isArray(result.current.data)).toBe(true);

    await waitFor(() => {
      expect(result.current.data).toEqual([
        { uomId: 1, uomName: '개' },
        { uomId: 2, uomName: '킬로그램' },
      ]);
    });
  });
});
