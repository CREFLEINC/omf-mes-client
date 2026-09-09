import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { resolvePlacements, type PlacementEntry } from './placement';
import type { DisposalTarget } from './types';

/**
 * 출발 자리를 푸는 판정의 시험.
 *
 * ⭐ **막는 갈래마다 «사유를 이름으로» 지목한다.** 「막힌다」만 단언하면 엉뚱한 사유로 막혀도
 * 통과한다 — 이 화면에서 그 오통과는 **위치를 모르는 채 보내는 것**을 놓친다.
 */

const t = messages.productDisposalRequest.placement;

const target = (over: Partial<DisposalTarget> = {}): DisposalTarget => ({
  dispositionDecisionId: 7001,
  nonconformanceNo: 'NC-2026-0071',
  dispositionTypeCode: 'SCRAP',
  decisionQty: 40,
  uomId: 3,
  reason: '재작업 불가',
  decidedBy: 12,
  decidedByName: '김품질',
  decidedAt: '2026-09-07T10:00:00+09:00',
  lotId: 9001,
  lotNo: 'FG-0288',
  itemId: 501,
  ...over,
});

const seat = (over: Partial<PlacementEntry> = {}): PlacementEntry => ({
  lotId: 9001,
  warehouseId: 11,
  locationId: 77,
  onHandQty: 40,
  ...over,
});

describe('resolvePlacements — 폐기할 LOT 이 어디 있는가', () => {
  it('LOT 하나가 한 자리에 있으면 그 창고와 위치를 낸다', () => {
    const result = resolvePlacements([target()], () => [seat()]);

    expect(result).toEqual({
      kind: 'resolved',
      warehouseId: 11,
      placements: [{ lotId: 9001, warehouseId: 11, locationId: 77 }],
    });
  });

  it('고른 것이 없으면 대상 선택을 사유로 막는다', () => {
    expect(resolvePlacements([], () => [seat()])).toEqual({
      kind: 'blocked',
      reason: t.noTarget,
    });
  });

  /** ⛔ 판정은 됐는데 LOT 이 안 실린 건이다 — 무엇을 뺄지 정할 수 없다. */
  it('LOT 을 못 받은 대상이 있으면 그것을 사유로 막는다', () => {
    expect(resolvePlacements([target({ lotId: null })], () => [seat()])).toEqual({
      kind: 'blocked',
      reason: t.lotMissing,
    });
  });

  /** ⛔ 「아직 못 받았다」와 「자리가 없다」는 사용자에게 다른 말이어야 한다. */
  it('자리를 아직 못 받았으면 조회 중을 사유로 막는다', () => {
    expect(resolvePlacements([target()], () => undefined)).toEqual({
      kind: 'blocked',
      reason: t.pending,
    });
  });

  it('자리가 비어 오면 못 찾음을 사유로 막는다', () => {
    expect(resolvePlacements([target()], () => [])).toEqual({
      kind: 'blocked',
      reason: t.notFound,
    });
  });

  /**
   * ⛔ **창고·위치를 못 채워 내려준 줄을 자리로 세지 않는다.** 세면 `null` 이 식별자 자리에
   * 실린다. 세지 않으면 「못 찾았다」로 떨어져 막힌다 — 조용히 지나가지 않는다.
   */
  it('창고나 위치가 빈 줄만 오면 못 찾음으로 막는다', () => {
    const result = resolvePlacements([target()], () => [
      seat({ warehouseId: null }),
      seat({ locationId: null }),
    ]);

    expect(result).toEqual({ kind: 'blocked', reason: t.notFound });
  });

  /**
   * ⛔ **한 LOT 이 여러 자리에 있으면 화면이 고르지 않는다.**
   *
   * 첫 줄을 집으면 **조용히 틀린 선반에서 빠진다.** 어느 선반에서 뺄지는 사람이 정할 일이다.
   */
  it('한 LOT 이 여러 자리에 있으면 나뉨을 사유로 막는다', () => {
    const result = resolvePlacements([target()], () => [
      seat({ locationId: 77 }),
      seat({ locationId: 78 }),
    ]);

    expect(result).toEqual({ kind: 'blocked', reason: t.split });
  });

  /** ⛔ 전표 하나에 출발 창고는 하나다 — 나눠 올릴 일을 한 벌로 접지 않는다. */
  it('고른 대상이 서로 다른 창고에 있으면 섞임을 사유로 막는다', () => {
    const first = target({ dispositionDecisionId: 7001, lotId: 9001 });
    const second = target({ dispositionDecisionId: 7002, lotId: 9002 });

    const result = resolvePlacements([first, second], (lotId) =>
      lotId === 9001
        ? [seat({ lotId: 9001, warehouseId: 11 })]
        : [seat({ lotId: 9002, warehouseId: 12 })],
    );

    expect(result).toEqual({ kind: 'blocked', reason: t.mixedWarehouse });
  });

  it('같은 창고의 여러 LOT 은 자리를 모두 낸다', () => {
    const first = target({ dispositionDecisionId: 7001, lotId: 9001 });
    const second = target({ dispositionDecisionId: 7002, lotId: 9002 });

    const result = resolvePlacements([first, second], (lotId) =>
      lotId === 9001
        ? [seat({ lotId: 9001, locationId: 77 })]
        : [seat({ lotId: 9002, locationId: 78 })],
    );

    expect(result).toEqual({
      kind: 'resolved',
      warehouseId: 11,
      placements: [
        { lotId: 9001, warehouseId: 11, locationId: 77 },
        { lotId: 9002, warehouseId: 11, locationId: 78 },
      ],
    });
  });
});
