import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { EMPTY_FILTERS, toListQuery } from './filters';
import { queueResponse, waitingRequest } from './fixtures';
import { useInspectionQueue } from './queries';

const queueRoute = (capture?: (request: Request) => void) => ({
  match: (request: Request) => new URL(request.url).pathname === '/quality/inspection-requests',
  respond: (request: Request) => {
    capture?.(request);
    return jsonResponse(queueResponse());
  },
});

describe('useInspectionQueue', () => {
  it('대기 큐를 표의 줄로 옮겨 돌려준다', async () => {
    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery(EMPTY_FILTERS, 1)),
      { fetch: createStubFetch([queueRoute()]) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.rows).toHaveLength(3);
    expect(result.current.data?.rows[0]).toMatchObject({
      inspectionRequestId: waitingRequest.inspectionRequestId,
      inspectionRequestNo: waitingRequest.inspectionRequestNo,
      statusCode: 'REQUESTED',
    });
  });

  it('자재 LOT 이 없는 건은 null 로 모은다 — undefined 와 섞이면 그리는 쪽이 두 갈래를 다 다뤄야 한다', async () => {
    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery(EMPTY_FILTERS, 1)),
      { fetch: createStubFetch([queueRoute()]) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.rows[2]?.lotId).toBeNull();
  });

  it('조건이 없으면 쪽과 크기만 보낸다 — 기간을 싣지 않는다', async () => {
    let sent: URL | undefined;

    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery(EMPTY_FILTERS, 1)),
      {
        fetch: createStubFetch([
          queueRoute((request) => {
            sent = new URL(request.url);
          }),
        ]),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sent?.searchParams.get('inspectionTypeCode')).toBe('IQC');
    expect(sent?.searchParams.get('pendingOnly')).toBe('true');
    expect(sent?.searchParams.get('page')).toBe('1');
    expect(sent?.searchParams.get('size')).toBe('50');
    expect(sent?.searchParams.has('requestedFrom')).toBe(false);
    expect(sent?.searchParams.has('requestedTo')).toBe(false);
    expect(sent?.searchParams.has('statusCode')).toBe(false);
  });

  it('채운 조건을 질의로 싣는다', async () => {
    let sent: URL | undefined;

    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery({ itemId: 2001, supplierId: 3003, keyword: 'IR' }, 2)),
      {
        fetch: createStubFetch([
          queueRoute((request) => {
            sent = new URL(request.url);
          }),
        ]),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(sent?.searchParams.get('itemId')).toBe('2001');
    expect(sent?.searchParams.get('supplierId')).toBe('3003');
    expect(sent?.searchParams.get('q')).toBe('IR');
    expect(sent?.searchParams.get('page')).toBe('2');
  });

  it('조회가 실패하면 실패로 남는다 — 빈 목록으로 접지 않는다', async () => {
    const { result } = renderHookWithProviders(
      () => useInspectionQueue(toListQuery(EMPTY_FILTERS, 1)),
      {
        fetch: createStubFetch([
          {
            match: () => true,
            respond: () => jsonResponse({ message: '서버 오류' }, { status: 500 }),
          },
        ]),
      },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
  });
});
