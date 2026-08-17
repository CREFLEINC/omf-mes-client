import { describe, expect, it } from 'vitest';

import { inboundReceiptResponse, inboundReceiptLineResponse } from './fixtures';
import {
  EMPTY_HEADER_DRAFT,
  seedHeaderDraft,
  toSourceLineView,
  toSourceReceiptView,
} from './types';

/**
 * 계약 응답을 화면 타입으로 옮기는 자리. **쓰는 값만 옮긴다** —
 * 자리를 두지 않으면 그 값이 화면으로 샐 경로도 없다(`omf-mes#44`).
 */

describe('toSourceReceiptView', () => {
  it('업무 번호·승계 원천·상태만 옮긴다', () => {
    const view = toSourceReceiptView(inboundReceiptResponse());

    expect(view).toEqual({
      inboundReceiptNo: 'SAMPLE-IR-9101',
      supplierId: 9301,
      plantId: 9401,
      statusCode: 'SAMPLE_IR_STATUS_A',
    });
  });

  it('내부 번호(FK)를 담을 자리가 없다', () => {
    expect(Object.keys(toSourceReceiptView(inboundReceiptResponse()))).not.toContain(
      'inboundReceiptId',
    );
  });
});

describe('toSourceLineView', () => {
  it('승계에 필요한 값만 옮긴다', () => {
    expect(toSourceLineView(inboundReceiptLineResponse())).toEqual({
      inboundReceiptLineId: 9111,
      lineNo: 1,
      itemId: 9501,
      receivedQty: 12,
      uomId: 9601,
    });
  });

  it('발주 라인 번호를 옮기지 않는다 — 「초과분인가」를 화면이 판정하지 않는다(계획 결정 3)', () => {
    const view = toSourceLineView(inboundReceiptLineResponse({ purchaseOrderLineId: 9701 }));

    expect(Object.keys(view)).not.toContain('purchaseOrderLineId');
  });
});

describe('seedHeaderDraft', () => {
  it('공급사·공장을 승계하고 나머지는 비운 채로 시작한다', () => {
    const receipt = toSourceReceiptView(inboundReceiptResponse());

    expect(seedHeaderDraft(receipt.supplierId, receipt.plantId)).toEqual({
      supplierId: '9301',
      businessUnitId: '',
      plantId: '9401',
      orderDate: '',
      expectedReceiptDate: '',
    });
  });

  it('사업부·발주일을 지어내지 않는다 — 넘어온 전표에 없는 값이다', () => {
    const seeded = seedHeaderDraft(9301, 9401);

    expect(seeded.businessUnitId).toBe(EMPTY_HEADER_DRAFT.businessUnitId);
    expect(seeded.orderDate).toBe(EMPTY_HEADER_DRAFT.orderDate);
  });
});
