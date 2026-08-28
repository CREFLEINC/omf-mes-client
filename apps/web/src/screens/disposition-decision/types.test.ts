import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  decisionUomIdOf,
  formatDate,
  formatDateTime,
  formatQty,
  toDecisionRow,
  toDetailView,
  toLotRow,
  toNonconformanceRow,
  totalAffectedQty,
  type DispositionDecision,
  type Nonconformance,
  type NonconformanceLot,
} from './types';

/**
 * ⚠ 아래 코드 문자열은 **지어낸 자리표시**다 — 처분·심각도·부적합 상태의 실제 값 목록은
 * 아직 확정되지 않았다. 확정값으로 읽지 않는다.
 */
const lot = (overrides: Partial<NonconformanceLot> = {}): NonconformanceLot => ({
  nonconformanceLotId: 9001,
  lotId: 8001,
  lotNo: 'LOT-TEST-0088',
  affectedQty: 320,
  uomId: 7001,
  qualityStatusBeforeCode: 'CODE-D',
  qualityStatusAfterCode: 'CODE-E',
  ...overrides,
});

const nonconformance = (overrides: Partial<Nonconformance> = {}): Nonconformance => ({
  nonconformanceId: 1001,
  nonconformanceNo: 'NC-TEST-0042',
  itemId: 5001,
  severityCode: 'CODE-B',
  description: '도장 표면 박리',
  statusCode: 'CODE-C',
  openedAt: '2026-08-12T09:30:00+09:00',
  /*
   * ⚠ 계약이 새로 필수로 요구하는 넷이다(집계·단위·처분 진행·LOT). **화면이 아직 읽지
   * 않는다** — 그것을 어떻게 쓸지는 별건(#570)이고, 여기서는 픽스처가 계약을 만족하게만 둔다.
   * 그래서 `lots` 는 종전 기본값과 같은 빈 배열이다.
   */
  affectedQtyTotal: 320,
  uomId: 7001,
  dispositionProgressCode: 'NOT_STARTED',
  lots: [],
  ...overrides,
});

const decision = (overrides: Partial<DispositionDecision> = {}): DispositionDecision => ({
  dispositionDecisionId: 3001,
  nonconformanceId: 1001,
  dispositionTypeCode: 'CODE-A',
  decisionQty: 200,
  uomId: 7001,
  reason: '표면만 손상돼 재작업으로 회복된다',
  decidedBy: 4001,
  decidedAt: '2026-08-12T14:20:00+09:00',
  ...overrides,
});

describe('formatQty', () => {
  it('정수는 소수점 없이 보인다', () => {
    expect(formatQty(320)).toBe('320');
  });

  it('소수는 여섯 자리까지 보인다', () => {
    expect(formatQty(120.5)).toBe('120.5');
  });

  it('값이 없으면 빈 자리를 나타내는 글자를 낸다 — 0을 지어내지 않는다', () => {
    expect(formatQty(undefined)).toBe(messages.dispositionDecision.values.unknownQty);
  });

  it('유한하지 않은 수도 빈 자리로 다룬다', () => {
    expect(formatQty(Number.NaN)).toBe(messages.dispositionDecision.values.unknownQty);
  });
});

describe('formatDateTime', () => {
  it('분까지만 보이고 시간대를 옮기지 않는다', () => {
    expect(formatDateTime('2026-08-12T14:20:35+09:00')).toBe('2026-08-12 14:20');
  });

  it('형태가 다르면 원문을 그대로 둔다', () => {
    expect(formatDateTime('알 수 없음')).toBe('알 수 없음');
  });

  it('RFC 3339가 허용하는 소문자 구분자도 받는다 — 원문이 그대로 새지 않는다', () => {
    expect(formatDateTime('2026-08-12t14:20:35+09:00')).toBe('2026-08-12 14:20');
  });

  it('오프셋을 옮기지 않고 벽시계 시각을 그대로 보인다', () => {
    expect(formatDateTime('2026-08-12T05:20:00Z')).toBe('2026-08-12 05:20');
  });

  it('날짜만 필요한 자리는 날짜만 낸다', () => {
    expect(formatDate('2026-08-12T14:20:35+09:00')).toBe('2026-08-12');
  });
});

describe('totalAffectedQty', () => {
  it('대상 LOT 수량을 더한다', () => {
    expect(totalAffectedQty([lot({ affectedQty: 200 }), lot({ affectedQty: 120 })])).toBe(320);
  });

  it('lots가 실려 오지 않으면 0이 아니라 undefined다 — 계약에서 required가 아니다', () => {
    expect(totalAffectedQty(undefined)).toBeUndefined();
  });

  it('빈 배열은 0이다 — 대상이 없다는 사실은 알 수 있다', () => {
    expect(totalAffectedQty([])).toBe(0);
  });
});

describe('toNonconformanceRow', () => {
  it('목록 행에 필요한 값만 옮긴다', () => {
    const row = toNonconformanceRow(nonconformance({ lots: [lot()] }));

    expect(row).toEqual({
      nonconformanceId: 1001,
      nonconformanceNo: 'NC-TEST-0042',
      itemId: 5001,
      severityCode: 'CODE-B',
      statusCode: 'CODE-C',
      openedAtText: '2026-08-12',
      affectedQtyText: '320',
    });
  });

  /*
   * ⭐ **「비어 있다」와 「받지 못했다」를 가르는 자리다.** 계약이 `lots` 를 필수로 바꿔
   * 정상 응답에서는 목록이 늘 오지만, 그 둘을 가르는 판정 자체는 그대로 지켜야 한다 —
   * 받지 못한 것을 「0」이라고 단언하면 사람은 **영향 LOT 이 없는 부적합**으로 읽는다.
   */
  it('lots가 비어 있으면 0이다 — 영향 LOT 이 없다는 사실이다', () => {
    expect(toNonconformanceRow(nonconformance({ lots: [] })).affectedQtyText).toBe('0');
  });

  it('⛔ lots를 받지 못하면 수량 칸을 비운다 — 「0」이라고 단언하지 않는다', () => {
    /* 계약은 이 칸을 필수로 두지만, 오지 않은 응답을 0으로 읽지 않는 것은 그대로다. */
    const withoutLots = { ...nonconformance(), lots: undefined } as unknown as Nonconformance;

    expect(toNonconformanceRow(withoutLots).affectedQtyText).toBe(
      messages.dispositionDecision.values.unknownQty,
    );
  });
});

describe('toLotRow', () => {
  it('품질 상태를 전이 표기로 잇는다', () => {
    expect(toLotRow(lot()).qualityStatusText).toBe('CODE-D → CODE-E');
  });

  it('LOT 번호가 없으면 빈 자리로 둔다', () => {
    expect(toLotRow(lot({ lotNo: undefined })).lotNoText).toBe(messages.common.reference.empty);
  });
});

describe('toDecisionRow', () => {
  it('판정 이력 행을 만든다', () => {
    expect(toDecisionRow(decision())).toEqual({
      dispositionDecisionId: 3001,
      dispositionTypeCode: 'CODE-A',
      decisionQtyText: '200',
      uomId: 7001,
      reason: '표면만 손상돼 재작업으로 회복된다',
      decidedAtText: '2026-08-12 14:20',
      decidedBy: 4001,
    });
  });
});

describe('toDetailView', () => {
  it('설명이 공백뿐이면 빈 상태 문구로 바꾼다', () => {
    expect(toDetailView(nonconformance({ description: '   ' })).description).toBe(
      messages.dispositionDecision.detail.emptyDescription,
    );
  });

  it('대상 LOT을 행으로 옮긴다', () => {
    expect(toDetailView(nonconformance({ lots: [lot()] })).lots).toHaveLength(1);
  });

  it('lots가 없으면 빈 목록이다', () => {
    expect(toDetailView(nonconformance()).lots).toEqual([]);
  });
});

describe('decisionUomIdOf', () => {
  it('대상 LOT의 단위로 고정한다', () => {
    expect(decisionUomIdOf([lot({ uomId: 7002 })])).toBe(7002);
  });

  it('LOT이 여럿이어도 단위가 같으면 그 단위다', () => {
    expect(decisionUomIdOf([lot({ uomId: 7002 }), lot({ uomId: 7002 })])).toBe(7002);
  });

  it('⛔ 단위가 섞이면 고르지 않는다 — 첫 LOT의 단위를 말없이 집지 않는다', () => {
    expect(decisionUomIdOf([lot({ uomId: 7001 }), lot({ uomId: 7002 })])).toBeUndefined();
  });

  it('대상 LOT이 없으면 단위를 정할 수 없다', () => {
    expect(decisionUomIdOf([])).toBeUndefined();
    expect(decisionUomIdOf(undefined)).toBeUndefined();
  });
});
