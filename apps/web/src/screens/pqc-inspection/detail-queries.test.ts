import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import {
  confirmedRound,
  draftRound,
  reinspectionRound,
  roundsResponse,
  waitingRequest,
} from './fixtures';
import { useInspectionRequestDetail } from './queries';

const detailRoute = () => ({
  match: (request: Request) =>
    new URL(request.url).pathname === '/quality/inspection-requests/1001',
  respond: () => jsonResponse(waitingRequest),
});

const roundsRoute = (items = [draftRound], capture?: (url: URL) => void) => ({
  match: (request: Request) => new URL(request.url).pathname === '/quality/inspection-results',
  respond: (request: Request) => {
    capture?.(new URL(request.url));
    return jsonResponse(roundsResponse(items));
  },
});

describe('useInspectionRequestDetail', () => {
  it('고른 의뢰의 상세를 돌려준다 — 검사기준 버전을 함께 나른다', async () => {
    const { result } = renderHookWithProviders(() => useInspectionRequestDetail(1001), {
      fetch: createStubFetch([detailRoute()]),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      inspectionRequestNo: 'IR-2026-0001',
      inspectionPlanVersionId: waitingRequest.inspectionPlanVersionId,
      targetQty: 500,
    });
  });

  it('고르기 전에는 부르지 않는다 — 부를 대상이 없다', () => {
    const { result } = renderHookWithProviders(() => useInspectionRequestDetail(null), {
      fetch: createStubFetch([]),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
