import { describe, expect, it } from 'vitest';

import {
  canSubmit,
  qtyProblem,
  toOutboxDraft,
  type InboundReceiptLine,
  type VarianceDraft,
} from './variance';

const line = (overrides: Partial<InboundReceiptLine> = {}): InboundReceiptLine =>
  ({
    inboundReceiptLineId: 55,
    inboundReceiptId: 8,
    lineNo: 1,
    purchaseOrderLineId: 41,
    itemId: 31,
    receivedQty: 480,
    uomId: 9,
    supplierLotMissing: false,
    inspectionRequired: true,
    statusCode: 'RECEIVED',
    ...overrides,
  }) as InboundReceiptLine;

const draft = (overrides: Partial<VarianceDraft> = {}): VarianceDraft => ({
  line: line(),
  varianceTypeCode: 'SHORT',
  varianceQty: '20',
  reasonCode: '',
  ...overrides,
});

describe('대상 수량', () => {
  it('적지 않았거나 숫자가 아니거나 0 이하면 쓸 수 없다', () => {
    expect(qtyProblem('')).toBe('empty');
    expect(qtyProblem('스물')).toBe('notNumber');
    expect(qtyProblem('0')).toBe('notPositive');
    expect(qtyProblem('-5')).toBe('notPositive');
    expect(qtyProblem('20')).toBeNull();
  });
});

describe('등록 조건', () => {
  it('사번과 줄과 유형과 수량이 있으면 등록할 수 있다', () => {
    expect(canSubmit(draft(), true)).toBe(true);
    expect(canSubmit(draft(), false)).toBe(false);
  });

  it('줄이나 유형이 없으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ line: null }), true)).toBe(false);
    expect(canSubmit(draft({ varianceTypeCode: '' }), true)).toBe(false);
  });

  it('수량이 쓸 수 없으면 등록할 수 없다', () => {
    expect(canSubmit(draft({ varianceQty: '0' }), true)).toBe(false);
  });

  /* 사유를 모를 때 기록 자체가 막히면 안 된다. 무엇이 틀렸나는 유형이 이미 받는다. */
  it('사유를 비워도 등록할 수 있다', () => {
    expect(canSubmit(draft({ reasonCode: '' }), true)).toBe(true);
  });
});

describe('등록 본문', () => {
  const NOW = new Date(2026, 8, 2, 9, 12);

  it('줄의 단위를 그대로 옮기고 경로에 줄 번호를 넣는다', () => {
    const entry = toOutboxDraft(draft(), line(), NOW, '900028');
    const body = entry.body as { varianceTypeCode: string; varianceQty: number; uomId: number };

    expect(body.varianceTypeCode).toBe('SHORT');
    expect(body.varianceQty).toBe(20);
    expect(body.uomId).toBe(9);
    expect(entry.path).toBe('/logistics/inbound-receipt-lines/55/variances');
    expect(entry.workerNo).toBe('900028');
    expect(entry.confirmation).toBe('pending');
  });

  /* 차이를 부호로 담지 않는다. 방향은 유형이 말한다. */
  it('수량을 양수로 싣는다', () => {
    const body = toOutboxDraft(draft({ varianceQty: ' 20 ' }), line(), NOW, '900028').body as {
      varianceQty: number;
    };

    expect(body.varianceQty).toBe(20);
  });

  it('사유를 비웠으면 빈 문자가 아니라 비운 값으로 싣는다', () => {
    const body = toOutboxDraft(draft(), line(), NOW, '900028').body as { reasonCode: unknown };

    expect(body.reasonCode).toBeNull();
  });

  it('사유를 골랐으면 그대로 싣는다', () => {
    const body = toOutboxDraft(draft({ reasonCode: 'DAMAGED' }), line(), NOW, '900028').body as {
      reasonCode: unknown;
    };

    expect(body.reasonCode).toBe('DAMAGED');
  });
});
