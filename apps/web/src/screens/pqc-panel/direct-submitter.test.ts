import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useDirectSubmitter } from './direct-submitter';

const BODY = {
  inspectionRequestId: 7101,
  inspectedQty: 5,
  acceptedQty: 5,
  rejectedQty: 0,
  heldQty: 0,
  uomId: 1,
  inspectedAt: '2026-11-24T09:00:00+09:00',
  statusCode: 'DRAFT',
  overallJudgmentCode: 'ACCEPTED',
} as const;

describe('useDirectSubmitter', () => {
  it.each(['DRAFT', 'CONFIRMED'] as const)(
    '%s 저장이 서버에 닿으면 탭 줄 상태 칩 건수를 곧바로 다시 센다(#356)',
    async (statusCode) => {
      const { result, queryClient } = renderHookWithProviders(() => useDirectSubmitter(), {
        fetch: async () => jsonResponse({ inspectionResultId: 1 }, { status: 201 }),
      });
      const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

      act(() => result.current.enqueue('', { ...BODY, statusCode }));

      await waitFor(() => expect(result.current.sentCount).toBe(1));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: INSPECTION_HUB_COUNTS_KEY });
    },
  );

  it('서버가 거부하면 건수를 다시 세지 않는다', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDirectSubmitter(), {
      fetch: async () => jsonResponse({ code: 'VALIDATION_FAILED', message: 'x' }, { status: 400 }),
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => result.current.enqueue('', BODY));

    await waitFor(() => expect(result.current.rejection).not.toBeNull());
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: INSPECTION_HUB_COUNTS_KEY });
  });
});
