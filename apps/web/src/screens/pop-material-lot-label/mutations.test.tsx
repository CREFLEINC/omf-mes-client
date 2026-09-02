import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderHookWithProviders } from '../../test/api-harness';
import { useLabelIssue } from './mutations';
import type { TargetRow } from './types';

/** 합성값이다 — 계약의 예시값도 실 운영 값도 쓰지 않는다(공개 저장소 경계). */
const row: TargetRow = {
  inboundReceiptLineId: 8501,
  inboundReceiptId: 8101,
  inboundReceiptNo: 'SYN-IB-0001',
  supplierId: 8201,
  plantId: 8301,
  receiptDatetime: '2026-08-27T09:12:30Z',
  itemId: 8601,
  receivedQty: 500,
  uomId: 8401,
  lotId: null,
};

describe('useLabelIssue — 사번을 모를 때', () => {
  /**
   * 지금은 단추도 함께 막혀 있어 화면으로는 여기 닿지 않는다. 그런데 이 훅을 부르는 경로가
   * 하나 더 생기면 그때 새고, 그 실수는 **서버 거절로만** 드러난다 — 나가는 자리에서 막는다.
   */
  it('⛔ 요청을 한 건도 내보내지 않는다 — 빈 사번을 대신 싣지 않는다', () => {
    let calls = 0;

    const { result } = renderHookWithProviders(() => useLabelIssue({ workerNo: null }), {
      fetch: async () => {
        calls += 1;

        throw new Error('사번을 모르는데 요청이 나갔습니다.');
      },
    });

    act(() => {
      result.current.run({ row, printerName: null, reissueReasonCode: null });
    });

    expect(calls).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });
});
