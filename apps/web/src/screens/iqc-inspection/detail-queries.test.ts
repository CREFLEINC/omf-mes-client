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
import { useInspectionRequestDetail, useInspectionRounds } from './queries';
import { latestRound, toInspectionResultRound } from './types';

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

describe('useInspectionRounds', () => {
  it('그 의뢰의 회차를 돌려준다', async () => {
    const { result } = renderHookWithProviders(() => useInspectionRounds(1001), {
      fetch: createStubFetch([roundsRoute()]),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]).toMatchObject({ inspectionRound: 1, statusCode: '작성중' });
  });

  it('기간을 보내지 않는다 — 한 의뢰의 회차를 읽는 경로에 기간을 실으면 없는 기간을 지어낸다', async () => {
    let sent: URL | undefined;

    const { result } = renderHookWithProviders(() => useInspectionRounds(1001), {
      fetch: createStubFetch([
        roundsRoute([draftRound], (url) => {
          sent = url;
        }),
      ]),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sent?.searchParams.get('inspectionRequestId')).toBe('1001');
    expect(sent?.searchParams.has('inspectedFrom')).toBe(false);
    expect(sent?.searchParams.has('inspectedTo')).toBe(false);
  });

  it('고르기 전에는 부르지 않는다', () => {
    const { result } = renderHookWithProviders(() => useInspectionRounds(null), {
      fetch: createStubFetch([]),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('latestRound', () => {
  it('회차가 없으면 아직 아무도 손대지 않은 의뢰다', () => {
    expect(latestRound([])).toBeNull();
  });

  it('가장 큰 회차를 고른다 — 서버가 주는 차례를 믿지 않는다', () => {
    const rounds = [reinspectionRound, confirmedRound].map(toInspectionResultRound);

    expect(latestRound(rounds)?.inspectionRound).toBe(2);
  });

  it('차례가 뒤집혀 와도 같은 회차를 고른다', () => {
    const rounds = [confirmedRound, reinspectionRound].map(toInspectionResultRound);

    expect(latestRound(rounds)?.inspectionRound).toBe(2);
  });
});
