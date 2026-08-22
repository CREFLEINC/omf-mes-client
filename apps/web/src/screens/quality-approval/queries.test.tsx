import { describe, expect, it } from 'vitest';

import { renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import { useApprovalRequestDetail, useConcessionCandidates, useConcessionDetail } from './queries';

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

describe('condition query guards', () => {
  it('승인 상세 성공 전에는 후보와 조건 상세를 열거나 /0 요청을 만들지 않는다', () => {
    const urls: string[] = [];
    const fetch: StubFetch = async (request) => {
      urls.push(request.url);
      return new Response('{}');
    };

    const { result } = renderHookWithProviders(
      () => ({ candidates: useConcessionCandidates(null), detail: useConcessionDetail(null) }),
      { fetch },
    );

    expect(result.current.candidates.fetchStatus).toBe('idle');
    expect(result.current.detail.fetchStatus).toBe('idle');
    expect(urls).toEqual([]);
  });
});
