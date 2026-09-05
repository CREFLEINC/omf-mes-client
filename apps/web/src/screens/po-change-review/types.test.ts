import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import {
  changedFieldsSummary,
  overProducedOf,
  qtyDeltaOf,
  toAffectedWorkOrder,
  toChangeNotification,
  type ChangedField,
} from './types';

/**
 * ⭐ **픽스처를 계약 타입에서 파생한다** — 손으로 적은 객체를 두면 계약에 필수 필드가 늘어도
 * 컴파일이 잡지 못하고, 시험만 통과하는 모양이 된다.
 */
type WorkOrderResponse = components['schemas']['WorkOrder'];
type WorkOrderProgressResponse = components['schemas']['WorkOrderProgress'];

const progress = (goodQty: number): WorkOrderProgressResponse => ({
  goodQty,
  achievementRate: 0,
  completionJudgmentCode: 'NORMAL',
});

const workOrderResponse = (over: Partial<WorkOrderResponse> = {}): WorkOrderResponse => ({
  workOrderId: 13,
  workOrderNo: 'SYNTH-WO-013',
  productionPlanId: 1,
  routingOperationId: 1,
  itemId: 5001,
  orderQty: 3000,
  uomId: 7001,
  workOrderTypeCode: 'CODE-C',
  priorityNo: 1,
  statusCode: 'CODE-B',
  ...over,
});

describe('toChangeNotification', () => {
  it('확인 시각이 없으면 null이다 — 목록의 「확인」 열이 이 유무를 본다', () => {
    const row = toChangeNotification({
      productionOrderId: 31,
      productionOrderNo: 'SYNTH-PO-0031',
      itemId: 5001,
      orderQty: 4000,
      uomId: 7001,
      statusCode: 'CODE-A',
    });

    expect(row.acknowledgedAt).toBeNull();
    expect(row.dueDate).toBeNull();
  });

  it('확인된 건은 시각을 그대로 들고 온다', () => {
    expect(
      toChangeNotification({
        productionOrderId: 31,
        productionOrderNo: 'SYNTH-PO-0031',
        itemId: 5001,
        orderQty: 4000,
        uomId: 7001,
        statusCode: 'CODE-A',
        acknowledgedAt: '2026-09-01T09:12:00+09:00',
      }).acknowledgedAt,
    ).toBe('2026-09-01T09:12:00+09:00');
  });
});

describe('toAffectedWorkOrder', () => {
  const base = workOrderResponse();

  /*
   * ⛔ **실적을 못 받은 것과 0인 것을 가른다**(G-9). 0으로 접으면 「아직 안 만든 W/O」로 보여
   * 「이미 생산됨」 경고가 사라진다 — 반영하면 계획이 실적보다 작아지는 바로 그 경우다.
   */
  it('⛔ 실적을 못 받으면 null이다 — 0으로 접지 않는다', () => {
    expect(toAffectedWorkOrder(base).producedQty).toBeNull();
    expect(toAffectedWorkOrder(workOrderResponse({ progress: progress(0) })).producedQty).toBe(0);
  });

  /* ⛔ 불일치 표식은 서버가 세운다 — 화면이 계산하지 않는다(계약 명시). */
  it('불일치 표식을 못 받으면 거짓으로 둔다 — 화면이 계산하지 않는다', () => {
    expect(toAffectedWorkOrder(base).poMismatch).toBe(false);
    expect(toAffectedWorkOrder(workOrderResponse({ poMismatch: true })).poMismatch).toBe(true);
  });

  it('판번호를 못 받으면 null이다', () => {
    expect(toAffectedWorkOrder(base).versionNo).toBeNull();
  });
});

describe('overProducedOf', () => {
  const one = (id: number, producedQty: number | null) =>
    toAffectedWorkOrder(
      workOrderResponse({
        workOrderId: id,
        workOrderNo: `SYNTH-WO-${String(id)}`,
        ...(producedQty === null ? {} : { progress: progress(producedQty) }),
      }),
    );

  it('실적이 변경 후 수량을 넘는 것만 고른다', () => {
    expect(overProducedOf([one(13, 5000), one(14, 1200)], 4000).map((w) => w.workOrderId)).toEqual([
      13,
    ]);
  });

  it('같으면 넘은 것이 아니다 — 경계는 열려 있다', () => {
    expect(overProducedOf([one(13, 4000)], 4000)).toEqual([]);
  });

  it('실적을 모르는 건은 경고 대상이 아니다 — 모른다고 단정하지 않는다', () => {
    expect(overProducedOf([one(13, null)], 4000)).toEqual([]);
  });
});

describe('lastChange — 「무엇이 몇에서 몇으로」의 유일한 출처', () => {
  const base = {
    productionOrderId: 31,
    productionOrderNo: 'SYNTH-PO-0031',
    itemId: 5001,
    orderQty: 4000,
    uomId: 7001,
    statusCode: 'CODE-A',
  };
  const qtyField: ChangedField = {
    field: 'ORDER_QTY',
    label: '수량',
    beforeText: '5000',
    afterText: '4000',
    beforeQty: 5000,
  };
  const dueField: ChangedField = {
    field: 'DUE_DATE',
    label: '납기',
    beforeText: '2026-08-20',
    afterText: '2026-08-20',
    beforeQty: null,
  };

  it('칸이 없으면 null 이다 — 빈 배열(항목을 낼 수 없음)과 가른다', () => {
    expect(toChangeNotification(base).lastChange).toBeNull();
    expect(
      toChangeNotification({
        ...base,
        lastChange: { receivedAt: '2026-08-05T09:12:00+09:00', changedFields: [] },
      }).lastChange,
    ).toEqual({ receivedAt: '2026-08-05T09:12:00+09:00', changedFields: [] });
  });

  it('항목은 계약이 준 표시명 그대로 들고 beforeQty 가 없으면 null 이다', () => {
    const row = toChangeNotification({
      ...base,
      lastChange: {
        receivedAt: '2026-08-05T09:12:00+09:00',
        changedFields: [
          {
            field: 'ORDER_QTY',
            label: '수량',
            beforeText: '5000',
            afterText: '4000',
            beforeQty: 5000,
          },
          { field: 'DUE_DATE', label: '납기', beforeText: '2026-08-20', afterText: '2026-08-20' },
        ],
      },
    });

    expect(row.lastChange?.changedFields).toEqual([qtyField, dueField]);
  });

  /* §4-A — 감소량은 화면이 뺀다(단순 뺄셈). 수량 항목이 아니면 셀 것이 없다. */
  it('수량 변화는 이전 수량 − 변경 후 수량이고, 수량 항목이 아니면 null 이다', () => {
    expect(qtyDeltaOf(qtyField, 4000)).toBe(1000);
    expect(qtyDeltaOf(qtyField, 6000)).toBe(-1000);
    expect(qtyDeltaOf({ ...qtyField, beforeQty: null }, 4000)).toBeNull();
    expect(qtyDeltaOf(dueField, 4000)).toBeNull();
  });

  it('목록 요약은 「항목 전→후」를 잇고, 못 받았으면 null, 열거 밖이면 빈 문자열이다', () => {
    expect(changedFieldsSummary(null)).toBeNull();
    expect(changedFieldsSummary({ receivedAt: 'x', changedFields: [] })).toBe('');
    expect(changedFieldsSummary({ receivedAt: 'x', changedFields: [qtyField, dueField] })).toBe(
      '수량 5000→4000 · 납기 2026-08-20→2026-08-20',
    );
  });
});
