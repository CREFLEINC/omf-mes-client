import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { lotFixture, shipmentFixture } from './fixtures';
import { activeLines, setLineQty, toLineDrafts } from './line-draft';
import { toSubmitLock } from './lock';
import {
  EMPTY_RECEIPT_DRAFT,
  toGoodsReceiptBody,
  toLocalDate,
  toOffsetDateTime,
  validateDraft,
} from './receipt-body';
import { toLotLineSource, toReturnLineSources, type WarehouseView } from './types';

const warehouse: WarehouseView = {
  warehouseId: 1003,
  plantId: 11,
  warehouseCode: 'SYN-WH-3',
  warehouseName: '합성 불량창고',
  isDefect: true,
  isActive: true,
};
const now = new Date(2026, 8, 3, 14, 5, 9);

describe('toGoodsReceiptBody — 되돌릴 수 없는 본문', () => {
  it('원 출하가 있으면 원천 문서와 배분 번호를 싣고 보류·판정 전으로 고정한다', () => {
    const lines = activeLines(
      setLineQty(toLineDrafts(toReturnLineSources(shipmentFixture())), 'alloc:9921', '120'),
    );
    const body = toGoodsReceiptBody({
      shipmentId: 9901,
      warehouse,
      locationId: 3102,
      lines,
      draft: { ...EMPTY_RECEIPT_DRAFT, reasonCode: 'QUALITY_DEFECT', remarks: ' 상단 긁힘 ' },
      now,
    });

    expect(body).toEqual({
      receiptTypeCode: 'RETURN',
      plantId: 11,
      warehouseId: 1003,
      receiptDatetime: toOffsetDateTime(now),
      businessDate: '2026-09-03',
      sourceDocumentTypeCode: 'SHIPMENT',
      sourceDocumentId: 9901,
      reasonCode: 'QUALITY_DEFECT',
      remarks: '상단 긁힘',
      lines: [
        {
          itemId: 2003,
          lotId: 8301,
          receiptQty: 120,
          uomId: 7001,
          qualityStatusCode: 'INSPECTION_PENDING',
          inventoryStatusCode: 'ON_HOLD',
          destinationLocationId: 3102,
          originalShipmentLotAllocationId: 9921,
        },
      ],
    });
  });

  /* 원 출하를 못 찾는 갈래가 정상이다 — 원천 문서 «둘 다» 비우고 배분 번호도 비운다. */
  it('원 출하가 없으면 원천 문서·배분 번호·빈 사유를 싣지 않는다', () => {
    const drafts = setLineQty(
      [{ source: toLotLineSource(lotFixture()), qtyText: '' }],
      'lot:8309',
      '40',
    );
    const body = toGoodsReceiptBody({
      shipmentId: null,
      warehouse,
      locationId: 3102,
      lines: activeLines(drafts),
      draft: EMPTY_RECEIPT_DRAFT,
      now,
    });

    expect(body).not.toHaveProperty('sourceDocumentTypeCode');
    expect(body).not.toHaveProperty('sourceDocumentId');
    expect(body).not.toHaveProperty('reasonCode');
    expect(body).not.toHaveProperty('remarks');
    expect(body.lines[0]).not.toHaveProperty('originalShipmentLotAllocationId');
    expect(body.lines[0]).not.toHaveProperty('inboundReceiptLineId');
  });

  it('일시는 offset 이 붙고 영업일은 그 날짜다', () => {
    expect(toOffsetDateTime(now)).toMatch(/^2026-09-03T14:05:09[+-]\d{2}:\d{2}$/);
    expect(toLocalDate(now)).toBe('2026-09-03');
  });
});

describe('validateDraft · toSubmitLock', () => {
  it('위치가 비면 필수 오류다', () => {
    expect(validateDraft(EMPTY_RECEIPT_DRAFT).destinationLocationId).toBe(
      messages.returnReceipt.form.locationRequired,
    );
    expect(validateDraft({ ...EMPTY_RECEIPT_DRAFT, locationId: '3102' })).toEqual({});
  });

  it('잠금 사유는 줄 없음 → 수량 오류 → 수량 없음 → 위치 없음 차례다', () => {
    const t = messages.returnReceipt.lock;
    const base = {
      lineCount: 0,
      activeLineCount: 0,
      hasLineErrors: false,
      hasLocation: false,
      isSaving: false,
      writeError: null,
    };

    expect(toSubmitLock(base).reason).toBe(t.noLines);
    expect(toSubmitLock({ ...base, lineCount: 2, hasLineErrors: true }).reason).toBe(t.lineErrors);
    expect(toSubmitLock({ ...base, lineCount: 2 }).reason).toBe(t.noQty);
    expect(toSubmitLock({ ...base, lineCount: 2, activeLineCount: 1 }).reason).toBe(t.noLocation);
    expect(toSubmitLock({ ...base, lineCount: 2, activeLineCount: 1, hasLocation: true })).toEqual({
      reason: undefined,
      isUncertain: false,
    });
  });

  it('응답 없이 끝난 등록은 불확실 잠금이다', () => {
    const lock = toSubmitLock({
      lineCount: 1,
      activeLineCount: 1,
      hasLineErrors: false,
      hasLocation: true,
      isSaving: false,
      writeError: { kind: 'network' },
    });

    expect(lock.isUncertain).toBe(true);
    expect(lock.reason).toBe(messages.returnReceipt.lock.uncertain);
  });
});
