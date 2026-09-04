import { describe, expect, it } from 'vitest';

import { judgePm, type PmTarget } from './pm-status';

const make = (overrides: Partial<PmTarget> = {}): PmTarget => ({
  pmTriggerTypeCode: 'BOTH',
  pmDue: false,
  pmDueAxisCode: null,
  ...overrides,
});

describe('judgePm', () => {
  /*
   * ⛔ 「판정 없음」과 「도래 전」은 다른 것이다 — 앞은 모르는 것이고 뒤는 정상이다(G-9).
   * 판정이 둘을 같은 값으로 내면 화면이 그것을 같은 모양으로 그릴 수밖에 없다.
   */
  it('`pmDue` 가 오지 않으면 「판정 없음」이지 「도래 전」이 아니다', () => {
    const judged = judgePm(make({ pmDue: undefined }));

    expect(judged.status).toBe('unknown');
    expect(judged.status).not.toBe('beforeDue');
  });

  it('`pmDue` 가 거짓이면 「도래 전」이다', () => {
    expect(judgePm(make({ pmDue: false }))).toEqual({ status: 'beforeDue', axis: null });
  });

  /* 판정 기준이 「하지 않음」이면 셀 것이 없다 — 채워야 할 것이 아니라 정상이다. */
  it('판정 기준이 NONE 이면 「대상 아님」이다', () => {
    expect(judgePm(make({ pmTriggerTypeCode: 'NONE', pmDue: false }))).toEqual({
      status: 'notRequired',
      axis: null,
    });
    expect(judgePm(make({ pmTriggerTypeCode: 'NONE', pmDue: undefined })).status).toBe(
      'notRequired',
    );
  });

  /*
   * ⭐ **판정 주체는 서버다.** 기준이 「하지 않음」인데도 도래가 내려왔다면 그것은 서버가
   * 아는 사실이고, 화면이 「대상 아님」으로 덮으면 도래한 툴이 화면에서만 조용해진다.
   */
  it('기준이 NONE 이어도 서버가 도래라 하면 도래로 그린다', () => {
    expect(
      judgePm(make({ pmTriggerTypeCode: 'NONE', pmDue: true, pmDueAxisCode: 'SHOT' })),
    ).toEqual({ status: 'due', axis: 'SHOT' });
  });

  it('도래한 축을 그대로 들고 온다', () => {
    expect(judgePm(make({ pmDue: true, pmDueAxisCode: 'DATE' })).axis).toBe('DATE');
  });

  /* ⛔ 축을 지어내지 않는다 — 「왜 도래했는가」를 모르면 모르는 채로 말한다. */
  it.each([null, undefined])('축이 %s 면 축 없이 도래만 말한다', (axis) => {
    expect(judgePm(make({ pmDue: true, pmDueAxisCode: axis }))).toEqual({
      status: 'due',
      axis: null,
    });
  });

  /* 네 갈래가 실제로 갈리는지 — 하나라도 뭉개지면 화면이 그것을 되살릴 수 없다. */
  it('네 모양이 서로 다른 값을 낸다', () => {
    const statuses = [
      judgePm(make({ pmTriggerTypeCode: 'NONE' })).status,
      judgePm(make({ pmDue: true })).status,
      judgePm(make({ pmDue: false })).status,
      judgePm(make({ pmDue: undefined })).status,
    ];

    expect(new Set(statuses).size).toBe(4);
  });
});
