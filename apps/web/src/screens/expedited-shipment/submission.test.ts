import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  quantityLimitsOf,
  reasonError,
  submitLockReason,
  targetLineOf,
  toShipmentCreateBody,
  type SubmissionInput,
} from './submission';
import type { ProductionLotCandidate, ShipmentRequestTarget } from './types';

const t = messages.expeditedShipment.lock;

const lot: ProductionLotCandidate = {
  lotId: 9001,
  lotNo: 'SYNTH-LOT-0001',
  itemId: 5001,
  initialQty: 500,
  uomId: 7001,
  statusCode: 'NORMAL',
  held: false,
};

const target: ShipmentRequestTarget = {
  shipmentRequestId: 3001,
  shipmentRequestNo: 'SYNTH-SR-0470',
  requestedShipDate: '2026-09-01',
  lines: [
    {
      shipmentRequestLineId: 4001,
      lineNo: 1,
      itemId: 5001,
      allocatedQty: 500,
      shippedQty: 200,
      uomId: 7001,
    },
  ],
};

const input = (overrides: Partial<SubmissionInput> = {}): SubmissionInput => ({
  lot,
  release: { kind: 'no-known-block' },
  target,
  warehouseId: 2001,
  draft: { ...EMPTY_DRAFT, qty: '300', reason: '고객 라인 정지 — 당일 납품 요청' },
  isSaving: false,
  ...overrides,
});

describe('targetLineOf', () => {
  it('고른 LOT의 품목과 맞는 라인을 집는다', () => {
    expect(targetLineOf(input())?.shipmentRequestLineId).toBe(4001);
  });

  it('품목이 다르면 라인이 없다 — 그 지시로는 이 LOT을 낼 수 없다', () => {
    expect(targetLineOf(input({ lot: { ...lot, itemId: 5999 } }))).toBeNull();
  });
});

describe('quantityLimitsOf', () => {
  it('LOT 수량과 배정 잔여를 낸다 — 잔여는 배정에서 출하분을 뺀 값이다', () => {
    expect(quantityLimitsOf(input())).toEqual({ lotQty: 500, remainingQty: 300 });
  });

  it('LOT이나 라인이 없으면 상한을 내지 않는다', () => {
    expect(quantityLimitsOf(input({ lot: null }))).toBeNull();
    expect(quantityLimitsOf(input({ target: null }))).toBeNull();
  });
});

describe('reasonError', () => {
  it('⛔ 사유는 필수다 — 공백만으로는 통과하지 못한다', () => {
    expect(reasonError('')).toBe(messages.expeditedShipment.reason.required);
    expect(reasonError('   ')).toBe(messages.expeditedShipment.reason.required);
  });

  it('너무 길면 막는다', () => {
    expect(reasonError('가'.repeat(501))).toBe(messages.expeditedShipment.reason.tooLong);
    expect(reasonError('가'.repeat(500))).toBeUndefined();
  });
});

describe('submitLockReason', () => {
  it('다 갖춰지면 잠그지 않는다', () => {
    expect(submitLockReason(input())).toBeUndefined();
  });

  /*
   * ⭐ 순서가 «사용자가 채우는 순서»다(G-3 — 하나만 낸다). 순서가 흐트러지면 아직 LOT도 안
   * 고른 사람에게 「사유를 입력하세요」라고 말하게 된다.
   */
  it('LOT을 고르기 전에는 LOT부터 말한다 — 뒤 칸의 사유를 먼저 내지 않는다', () => {
    expect(submitLockReason(input({ lot: null, draft: EMPTY_DRAFT }))).toBe(t.selectLot);
  });

  it('⛔ Release가 아니면 그것부터 말한다 — 수량·사유보다 앞선다', () => {
    expect(submitLockReason(input({ release: { kind: 'held' }, draft: EMPTY_DRAFT }))).toBe(
      t.notReleasable,
    );
  });

  it('지시를 못 골랐거나 맞는 라인이 없으면 대상부터 말한다', () => {
    expect(submitLockReason(input({ target: null }))).toBe(t.selectTarget);
    expect(submitLockReason(input({ lot: { ...lot, itemId: 5999 } }))).toBe(t.selectTarget);
  });

  it('수량이 어긋나면 수량을 말한다', () => {
    expect(submitLockReason(input({ draft: { ...EMPTY_DRAFT, qty: '400', reason: '사유' } }))).toBe(
      t.qty,
    );
  });

  it('사유가 비면 사유를 말한다', () => {
    expect(submitLockReason(input({ draft: { ...EMPTY_DRAFT, qty: '300', reason: '' } }))).toBe(
      t.reason,
    );
  });

  it('창고가 정해지지 않으면 창고를 말한다', () => {
    expect(submitLockReason(input({ warehouseId: null }))).toBe(t.warehouse);
  });

  /* 「고쳐서 풀 것」이 아니라 「기다려야 할 것」이라 맨 앞이다. */
  it('진행 중이 다른 모든 사유보다 앞선다', () => {
    expect(submitLockReason(input({ isSaving: true, lot: null }))).toBe(t.saving);
  });
});

describe('toShipmentCreateBody', () => {
  it('⭐ `expedited`를 참으로, 사유를 함께 보낸다 — 이 화면의 전부다', () => {
    const body = toShipmentCreateBody(input());

    expect(body?.expedited).toBe(true);
    expect(body?.expediteReason).toBe('고객 라인 정지 — 당일 납품 요청');
  });

  it('라인 하나에 LOT 배분 하나를 싣는다 — 수량이 셋 다 같다', () => {
    const body = toShipmentCreateBody(input());

    expect(body?.lines).toHaveLength(1);
    expect(body?.lines[0]).toEqual({
      shipmentRequestLineId: 4001,
      shippedQty: 300,
      uomId: 7001,
      allocations: [{ lotId: 9001, allocatedQty: 300, uomId: 7001 }],
    });
  });

  it('상차 정보는 빈 칸을 싣지 않는다 — 빈 문자열을 값으로 보내지 않는다', () => {
    const body = toShipmentCreateBody(input());

    expect(body).not.toHaveProperty('vehicleNo');
    expect(body).not.toHaveProperty('driverName');
    expect(body).not.toHaveProperty('sealNo');
  });

  it('적은 상차 정보는 다듬어 싣는다', () => {
    const body = toShipmentCreateBody(
      input({
        draft: {
          qty: '300',
          reason: '사유',
          loading: { vehicleNo: ' 12가 3456 ', driverName: '', sealNo: 'SEAL-0092' },
        },
      }),
    );

    expect(body?.vehicleNo).toBe('12가 3456');
    expect(body?.sealNo).toBe('SEAL-0092');
    expect(body).not.toHaveProperty('driverName');
  });

  /*
   * ⭐ 게이트와 본문이 «같은 입력»에서 갈리지 않아야 한다. 갈리면 「버튼은 열렸는데 눌러도
   * 아무 일도 안 일어나는」 상태나 「막았는데 본문은 만들어지는」 상태가 생긴다.
   */
  it('⛔ 막을 사유가 하나라도 있으면 본문을 만들지 않는다', () => {
    expect(toShipmentCreateBody(input({ release: { kind: 'held' } }))).toBeNull();
    expect(toShipmentCreateBody(input({ warehouseId: null }))).toBeNull();
    expect(
      toShipmentCreateBody(input({ draft: { ...EMPTY_DRAFT, qty: '400', reason: 'x' } })),
    ).toBeNull();
    expect(
      toShipmentCreateBody(input({ draft: { ...EMPTY_DRAFT, qty: '300', reason: '' } })),
    ).toBeNull();
  });

  it('게이트가 열린 것과 본문이 만들어지는 것이 언제나 같이 간다', () => {
    const cases: SubmissionInput[] = [
      input(),
      input({ lot: null }),
      input({ target: null }),
      input({ warehouseId: null }),
      input({ release: { kind: 'inspection-pending' } }),
      input({ draft: { ...EMPTY_DRAFT, qty: '', reason: '' } }),
      input({ isSaving: true }),
    ];

    for (const one of cases) {
      const locked = submitLockReason(one) !== undefined;
      expect(toShipmentCreateBody(one) === null).toBe(locked);
    }
  });
});
