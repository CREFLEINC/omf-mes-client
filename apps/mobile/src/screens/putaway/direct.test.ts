import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  groupPendingLots,
  modeTextOf,
  reasonTextOf,
  toDirectDraft,
  verdictKindOf,
  verdictTextOf,
  type PendingLot,
} from './direct';

const d = messages.putaway.direct;

const lot = (overrides: Partial<PendingLot> = {}): PendingLot => ({
  lotId: 41,
  lotNo: 'RM-LOT-0101',
  itemId: 31,
  itemCode: 'RM-1001',
  itemName: '수지A',
  qty: 1000,
  uomCode: 'EA',
  lotStatusCode: 'NORMAL',
  inboundLotId: 5,
  inboundLotNo: 'IL-0005',
  supplierName: '대성정밀',
  inboundClosedAt: '2026-11-17T09:00:00Z',
  ...overrides,
});

describe('적치 대기 LOT 묶음(피처 009)', () => {
  it('US1-1 입하 LOT · 품목으로 묶고 서버가 준 차례를 지킨다', () => {
    const groups = groupPendingLots([
      lot({ lotId: 1, lotNo: 'A-1' }),
      lot({ lotId: 2, lotNo: 'B-1', itemId: 32, itemCode: 'RM-2002', inboundLotNo: 'IL-0007' }),
      lot({ lotId: 3, lotNo: 'A-2' }),
    ]);

    expect(groups.map((group) => group.lots.map((each) => each.lotNo))).toEqual([
      ['A-1', 'A-2'],
      ['B-1'],
    ]);
    expect(groups[0]?.source).toBe('IL-0005, 대성정밀');
  });

  it('입하 LOT 이 없는 이전 흐름 LOT 은 「입하 LOT 없음(이전 흐름)」 묶음', () => {
    const [group] = groupPendingLots([
      lot({ inboundLotId: undefined, inboundLotNo: undefined, supplierName: undefined }),
    ]);

    expect(group?.source).toBe(d.noInboundLot);
  });
});

describe('판정 · 이유 문구(피처 009)', () => {
  it('US1-3 지정 위치는 기록, US2-1 미지정은 확인, 그 밖은 막힘', () => {
    expect(verdictKindOf('DESIGNATED')).toBe('record');
    expect(verdictKindOf('UNDESIGNATED')).toBe('confirm');
    for (const code of [
      'NOT_FOUND',
      'INACTIVE',
      'OTHER_PLANT',
      'STAGING',
      'NOT_LEAF',
      'DEFECT_LOT_NEEDS_DEFECT_WAREHOUSE',
      'NORMAL_LOT_IN_DEFECT_WAREHOUSE',
      'RESTRICTED_LOCATION',
    ] as const) {
      expect(verdictKindOf(code)).toBe('blocked');
    }
  });

  it('US2-8 판정 코드로 PDA 문구를 꺼낸다 — 모르는 코드는 null', () => {
    expect(verdictTextOf('RESTRICTED_LOCATION')).toBe(d.verdict.RESTRICTED_LOCATION);
    expect(verdictTextOf('SOMETHING')).toBeNull();
    expect(reasonTextOf('RECEIVING')).toBe(d.reason.RECEIVING);
    expect(reasonTextOf('SOMETHING')).toBeNull();
    expect(modeTextOf('TEMPORARY')).toBe(d.mode.TEMPORARY);
    expect(modeTextOf(null)).toBeNull();
  });
});

describe('적치 기록 대기열 건(피처 009)', () => {
  const now = new Date(2026, 10, 18, 9, 42);

  it('US1-4 지정 위치는 확인 표시 없이 위치 · 업무 기준일을 실어 `:putaway` 로', () => {
    const draft = toDirectDraft(
      lot(),
      { locationId: 5, locationCode: 'WH01-A01-03' },
      false,
      now,
      '900028',
    );

    expect(draft.path).toBe('/logistics/putaway-pending-lots/41:putaway');
    expect(draft.method).toBe('POST');
    expect(draft.confirmation).toBe('pending');
    expect(draft.workerNo).toBe('900028');
    expect(draft.summary).toBe('RM-LOT-0101 → WH01-A01-03');
    expect(draft.body).toEqual({
      locationId: 5,
      businessDate: '2026-11-18',
      occurredAt: now.toISOString(),
    });
  });

  it('US2-2 [미지정 위치 적치]는 confirmUndesignated=true 를 싣는다', () => {
    const draft = toDirectDraft(
      lot(),
      { locationId: 9, locationCode: 'WH01-B02-01' },
      true,
      now,
      '900028',
    );

    expect(draft.body).toMatchObject({ locationId: 9, confirmUndesignated: true });
  });
});
