import { describe, expect, it } from 'vitest';

import { EMPTY_INTERVAL, type IntervalDraft } from './interval';
import { toDowntimeCreate, toOffsetDateTime, type DowntimeDraft } from './post-request';
import { EQUIPMENT_ID } from './fixtures';

const interval = (overrides: Partial<IntervalDraft> = {}): IntervalDraft => ({
  ...EMPTY_INTERVAL,
  startedAt: { date: '2026-08-11', time: '14:20' },
  endedAt: { date: '2026-08-11', time: '15:07' },
  ...overrides,
});

const draft = (overrides: Partial<DowntimeDraft> = {}): DowntimeDraft => ({
  interval: interval(),
  reasonCode: 'MOLD_CHANGE',
  breakdownId: null,
  remarks: '',
  ...overrides,
});

describe('toOffsetDateTime', () => {
  it('offset을 붙여 낸다 — 없으면 같은 글자가 지역마다 다른 순간이 된다', () => {
    expect(toOffsetDateTime(new Date(2026, 7, 11, 14, 20, 0))).toMatch(
      /^2026-08-11T14:20:00[+-]\d{2}:\d{2}$/,
    );
  });
});

describe('toDowntimeCreate', () => {
  it('계약이 필수로 둔 셋을 채운다', () => {
    const body = toDowntimeCreate(EQUIPMENT_ID, draft());

    expect(body?.equipmentId).toBe(EQUIPMENT_ID);
    expect(body?.reasonCode).toBe('MOLD_CHANGE');
    expect(body?.startedAt).toMatch(/^2026-08-11T14:20:00/);
  });

  it('「아직 진행 중」이면 **끝 시각 칸 자체를 싣지 않는다**', () => {
    const body = toDowntimeCreate(
      EQUIPMENT_ID,
      draft({ interval: interval({ stillOngoing: true }) }),
    );

    /* 「진행 중」이라는 별도 값이 아니라 **끝의 부재**가 그 뜻이다. */
    expect(body).not.toBeNull();
    expect('endedAt' in (body ?? {})).toBe(false);
  });

  it('본문에 진행 중 깃발이나 작업 축을 지어내지 않는다', () => {
    const body = toDowntimeCreate(EQUIPMENT_ID, draft());

    expect(Object.keys(body ?? {}).sort()).toEqual([
      'endedAt',
      'equipmentId',
      'reasonCode',
      'startedAt',
    ]);
  });

  it('고장 연결과 메모는 있을 때만 싣는다', () => {
    const linked = toDowntimeCreate(
      EQUIPMENT_ID,
      draft({ breakdownId: 5301, remarks: '  합성 메모  ' }),
    );

    expect(linked?.breakdownId).toBe(5301);
    /* 앞뒤 공백은 내용이 아니다 — 그대로 보내면 빈 메모가 값 있는 메모로 남는다. */
    expect(linked?.remarks).toBe('합성 메모');

    const bare = toDowntimeCreate(EQUIPMENT_ID, draft({ remarks: '   ' }));
    expect('remarks' in (bare ?? {})).toBe(false);
    expect('breakdownId' in (bare ?? {})).toBe(false);
  });

  it('설비·사유·시작 중 하나라도 없으면 만들지 않는다', () => {
    expect(toDowntimeCreate(null, draft())).toBeNull();
    expect(toDowntimeCreate(EQUIPMENT_ID, draft({ reasonCode: null }))).toBeNull();
    expect(
      toDowntimeCreate(
        EQUIPMENT_ID,
        draft({ interval: interval({ startedAt: { date: '', time: '' } }) }),
      ),
    ).toBeNull();
  });

  it('끝이 시작보다 앞선 본문은 만들지 않는다 — 저장이 통째로 실패한다', () => {
    const body = toDowntimeCreate(
      EQUIPMENT_ID,
      draft({ interval: interval({ endedAt: { date: '2026-08-11', time: '13:00' } }) }),
    );

    expect(body).toBeNull();
  });
});
