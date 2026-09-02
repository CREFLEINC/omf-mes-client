import { describe, expect, it } from 'vitest';

import type { Location } from '../../patterns/locations';
import type { PutawayTask } from '../putaway/putaway';
import {
  canSubmit,
  isAlreadyPutAway,
  toOutboxDraft,
  type TemporaryDraft,
} from './temporary';

const task = (overrides: Partial<PutawayTask> = {}): PutawayTask =>
  ({
    putawayTaskId: 90,
    putawayTaskNo: 'PT-2026-0007',
    goodsReceiptLineId: 12,
    itemId: 31,
    lotId: 4,
    taskQty: 120,
    uomId: 9,
    fromLocationId: 1,
    recommendedLocationId: 5,
    warehouseId: 2,
    priorityNo: 1,
    statusCode: 'ASSIGNED',
    ...overrides,
  }) as PutawayTask;

const location = (overrides: Partial<Location> = {}): Location =>
  ({
    locationId: 9,
    warehouseId: 2,
    locationCode: 'TMP-01',
    locationName: '임시 자리',
    locationTypeCode: 'FLOOR',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
    ...overrides,
  }) as Location;

const draft = (overrides: Partial<TemporaryDraft> = {}): TemporaryDraft => ({
  location: location(),
  reasonCode: 'FULL',
  remarks: '',
  ...overrides,
});

describe('이미 적치된 건', () => {
  /* 실제 적치 위치는 완료된 건에만 채워진다. 또 적으면 같은 지시에 두 기록이 남는다. */
  it('실제 적치 위치가 있으면 이미 적치된 것으로 본다', () => {
    expect(isAlreadyPutAway(task())).toBe(false);
    expect(isAlreadyPutAway(task({ actualLocationId: 9 }))).toBe(true);
  });

  it('이미 적치된 건은 등록할 수 없다', () => {
    expect(canSubmit(task({ actualLocationId: 9 }), draft(), true)).toBe(false);
  });
});

describe('등록 조건', () => {
  it('위치와 사유가 있으면 등록할 수 있다', () => {
    expect(canSubmit(task(), draft(), true)).toBe(true);
  });

  /* 사유와 비고 중 하나는 있어야 한다. 서버가 둘 다 비면 막는다. */
  it('사유가 없어도 비고가 있으면 등록할 수 있다', () => {
    expect(canSubmit(task(), draft({ reasonCode: '', remarks: '통로에 둠' }), true)).toBe(true);
  });

  it('사유와 비고가 둘 다 비면 등록할 수 없다', () => {
    expect(canSubmit(task(), draft({ reasonCode: '', remarks: '   ' }), true)).toBe(false);
  });

  it('위치를 고르지 않으면 등록할 수 없다', () => {
    expect(canSubmit(task(), draft({ location: null }), true)).toBe(false);
  });

  /* 누가 한 일인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 등록할 수 없다', () => {
    expect(canSubmit(task(), draft(), false)).toBe(false);
  });

  it('지시가 없으면 등록할 수 없다', () => {
    expect(canSubmit(null, draft(), true)).toBe(false);
  });
});

describe('등록 본문', () => {
  const NOW = new Date(2026, 8, 2, 9, 12);

  it('임시로 둔 위치와 업무 기준일을 싣고 경로에 지시 번호를 넣는다', () => {
    const entry = toOutboxDraft(task(), draft(), location(), NOW, '900028');
    const body = entry.body as {
      actualLocationId: number;
      reasonCode: unknown;
      remarks: unknown;
      businessDate: string;
    };

    expect(body.actualLocationId).toBe(9);
    expect(body.reasonCode).toBe('FULL');
    expect(body.remarks).toBeNull();
    expect(body.businessDate).toBe('2026-09-02');
    expect(entry.path).toBe('/logistics/putaway-tasks/90:complete-temporary');
    expect(entry.workerNo).toBe('900028');
    expect(entry.confirmation).toBe('pending');
  });

  it('비운 항목은 빈 문자가 아니라 비운 값으로 싣는다', () => {
    const body = toOutboxDraft(
      task(),
      draft({ reasonCode: '', remarks: '  통로에 둠  ' }),
      location(),
      NOW,
      '900028',
    ).body as { reasonCode: unknown; remarks: unknown };

    expect(body.reasonCode).toBeNull();
    expect(body.remarks).toBe('통로에 둠');
  });

  /* 정상 적치와 다른 경로로 보낸다. 같은 경로로 보내면 정위치 이동 대상을 찾을 수 없다. */
  it('정상 적치와 다른 경로로 보낸다', () => {
    const entry = toOutboxDraft(task(), draft(), location(), NOW, '900028');

    expect(entry.path).toContain(':complete-temporary');
    expect(entry.path.endsWith(':complete')).toBe(false);
  });
});
