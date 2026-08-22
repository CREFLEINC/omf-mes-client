import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  describeReference,
  lookupNote,
  productionOrderReferenceKeys,
  resolveReference,
  usePlantReferenceLookup,
  useUomReferenceLookup,
  type ReferenceSource,
} from './reference-lookups';

const PLANTS_PATH = '/mdm/plants';
const UOMS_PATH = '/mdm/uoms';

const isExactly = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));
      return stub(request);
    },
  };
};

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '3101', label: 'PLANT-SYN-01 · Synthetic Plant One' }],
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

describe('production-order reference lookups', () => {
  it('plant와 UOM 목록을 비활성 포함 계약 요청으로 각각 읽어 code · name entries로 낸다', async () => {
    const { fetch, urls } = recordingFetch([
      {
        match: (request) => isExactly(request, PLANTS_PATH),
        respond: () =>
          jsonResponse({
            items: [
              {
                plantId: 3101,
                legalEntityId: 1101,
                businessUnitId: 2101,
                plantCode: 'PLANT-SYN-01',
                plantName: 'Synthetic Plant One',
                timezoneCode: 'Asia/Seoul',
                isActive: true,
              },
            ],
            page: { page: 1, size: 25, total: 1 },
          }),
      },
      {
        match: (request) => isExactly(request, UOMS_PATH),
        respond: () =>
          jsonResponse({
            items: [
              {
                uomId: 8101,
                uomCode: 'SYN-EA',
                uomName: 'Synthetic Each',
                decimalScale: 0,
                isActive: true,
              },
            ],
            page: { page: 1, size: 25, total: 2 },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => ({ plants: usePlantReferenceLookup(), uoms: useUomReferenceLookup() }),
      { fetch },
    );

    await waitFor(() => expect(result.current.plants.entries).toHaveLength(1));
    await waitFor(() => expect(result.current.uoms.entries).toHaveLength(1));

    expect(result.current.plants).toMatchObject({
      entries: [{ value: '3101', label: 'PLANT-SYN-01 · Synthetic Plant One' }],
      isLoading: false,
      isError: false,
      truncated: false,
    });
    expect(result.current.uoms).toMatchObject({
      entries: [{ value: '8101', label: 'SYN-EA · Synthetic Each' }],
      isLoading: false,
      isError: false,
      truncated: true,
    });
    expect(typeof result.current.plants.refetch).toBe('function');
    expect(typeof result.current.uoms.refetch).toBe('function');
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.get('includeInactive')).toBe('true');
      expect(url.searchParams.has('page')).toBe(false);
      expect(url.searchParams.has('size')).toBe(false);
    }
    expect(productionOrderReferenceKeys.plants).not.toEqual(productionOrderReferenceKeys.uoms);
  });

  it('각 목록 실패를 독립된 error state로 보존한다', async () => {
    const { fetch } = recordingFetch([
      {
        match: (request) => isExactly(request, PLANTS_PATH),
        respond: () => jsonResponse({ message: 'synthetic plant failure' }, { status: 500 }),
      },
      {
        match: (request) => isExactly(request, UOMS_PATH),
        respond: () => jsonResponse({ items: [], page: { page: 1, size: 25, total: 0 } }),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => ({ plants: usePlantReferenceLookup(), uoms: useUomReferenceLookup() }),
      { fetch },
    );

    await waitFor(() => expect(result.current.plants.isError).toBe(true));
    await waitFor(() => expect(result.current.uoms.isLoading).toBe(false));

    expect(result.current.plants.entries).toEqual([]);
    expect(result.current.uoms.isError).toBe(false);
  });
});

describe('resolveReference', () => {
  it('failed, loading, named, truncated, unknown 순서로 상태를 고른다', () => {
    expect(
      resolveReference(source({ isError: true, isLoading: true, truncated: true }), 3101),
    ).toEqual({
      kind: 'failed',
    });
    expect(resolveReference(source({ isLoading: true, truncated: true }), 3101)).toEqual({
      kind: 'loading',
    });
    expect(resolveReference(source({ truncated: true }), 3101)).toEqual({
      kind: 'named',
      label: 'PLANT-SYN-01 · Synthetic Plant One',
    });
    expect(resolveReference(source({ entries: [], truncated: true }), 3101)).toEqual({
      kind: 'truncated',
    });
    expect(resolveReference(source({ entries: [] }), 3101)).toEqual({ kind: 'unknown' });
  });

  it('없는 참조 값은 unknown이며 어떤 결과에도 내부 ID를 담지 않는다', () => {
    const states = [
      resolveReference(source(), null),
      resolveReference(source(), undefined),
      resolveReference(source({ entries: [] }), 3199),
      resolveReference(source({ isError: true }), 3101),
    ];

    expect(states).toEqual([
      { kind: 'unknown' },
      { kind: 'unknown' },
      { kind: 'unknown' },
      { kind: 'failed' },
    ]);
    for (const state of states) expect(JSON.stringify(state)).not.toContain('3199');
  });
});

describe('describeReference', () => {
  it('failed, truncated, loading, unknown 설명을 서로 다른 i18n 문구로 낸다', () => {
    const descriptions = [
      describeReference({ kind: 'failed' }),
      describeReference({ kind: 'truncated' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'unknown' }),
    ];

    expect(new Set(descriptions).size).toBe(4);
    expect(describeReference({ kind: 'named', label: 'PLANT-SYN-01 · Synthetic Plant One' })).toBe(
      'PLANT-SYN-01 · Synthetic Plant One',
    );
  });
});

describe('lookupNote', () => {
  it('failed, loading, truncated lookup note를 서로 다른 i18n 문구로 낸다', () => {
    const notes = [
      lookupNote(source({ isError: true })),
      lookupNote(source({ isLoading: true })),
      lookupNote(source({ truncated: true })),
    ];

    expect(notes.every((note) => note !== undefined)).toBe(true);
    expect(new Set(notes).size).toBe(3);
  });
});
