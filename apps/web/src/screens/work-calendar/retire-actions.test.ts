import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { applicationNote, deactivateAvailability } from './retire-actions';

const t = messages.workCalendar.retire;

describe('deactivateAvailability', () => {
  it('쓰고 있는 캘린더는 중지할 수 있다', () => {
    expect(deactivateAvailability({ isActive: true })).toEqual({ enabled: true, reason: null });
  });

  /* 감추지 않고 사유와 함께 잠근다 — 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다. */
  it('이미 중지된 캘린더는 잠그고 사유를 준다', () => {
    expect(deactivateAvailability({ isActive: false })).toEqual({
      enabled: false,
      reason: t.alreadyInactive,
    });
  });

  /*
   * ⛔ **모르면 잠근다.** 열어 두면 확인 창이 그릴 대상을 못 찾아 눌러도 아무 일도 일어나지
   * 않는다 — W-05-11 에서 실제로 났던 결함이다.
   */
  it('대상을 아직 모르면 잠근다', () => {
    expect(deactivateAvailability(null)).toEqual({ enabled: false, reason: t.targetUnknown });
  });
});

describe('applicationNote', () => {
  /* ⭐ 계약이 시킨 것이다 — 「참조가 있으면 건수를 함께 보인 뒤 부른다」(B-4). */
  it('따르는 대상이 있으면 건수와 그 파급을 말한다', () => {
    expect(applicationNote(3)).toBe(t.applicationCount(3));
  });

  it('따르는 대상이 없으면 없다고 말한다', () => {
    expect(applicationNote(0)).toBe(t.applicationNone);
  });

  /*
   * ⛔ **모르는 것을 「없다」로 그리지 않는다**(G-9). 중지가 곧 그 대상들을 상위 층으로
   * 떨어뜨리는 일이라, 매인 대상이 있는데도 가볍게 누르게 되면 파급이 크다.
   */
  it('아직 모르면 모른다고 말한다', () => {
    expect(applicationNote(null)).toBe(t.applicationUnknown);
  });

  it('세 갈래가 서로 다른 말이다', () => {
    expect(new Set([applicationNote(3), applicationNote(0), applicationNote(null)]).size).toBe(3);
  });
});
