import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  qualityApprovalKeys,
  UOM_REFERENCE_PATH,
  useApprovalRequestDetail,
  useConditionUoms,
} from './queries';

describe('useApprovalRequestDetail', () => {
  it('선택이 없으면 상세 조회를 열지 않고 /0 요청도 만들지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return new Response('{}');
    };

    const { result } = renderHookWithProviders(() => useApprovalRequestDetail(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
    expect(urls).toEqual([]);
  });
});

describe('useConditionUoms', () => {
  it('사용 전에는 UOM 목록을 요청하지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return jsonResponse({});
    };
    const { result } = renderHookWithProviders(() => useConditionUoms(false), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });

  it('고정 키로 includeInactive만 보내 한 번 조회한다', async () => {
    const urls: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      urls.push(url);
      const items = [{ uomId: 901, uomCode: 'SYNTH-EA', uomName: '합성 낱개' }];
      return jsonResponse({ items, page: { page: 1, size: 20, total: 1 } });
    };
    const { result } = renderHookWithProviders(() => useConditionUoms(true), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(1);
    });
    expect(qualityApprovalKeys.uoms).toEqual(['quality-approval', 'condition-uoms']);
    expect(urls.map(({ pathname }) => pathname)).toEqual([UOM_REFERENCE_PATH]);
    expect(urls.map((url) => Object.fromEntries(url.searchParams))).toEqual([
      { includeInactive: 'true' },
    ]);
  });
});
