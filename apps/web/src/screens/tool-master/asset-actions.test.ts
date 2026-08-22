import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  deactivateAvailability,
  disposeAvailability,
  labelNote,
  referenceNote,
  type RetireTarget,
} from './asset-actions';

const t = messages.toolMaster.actionReasons;
const r = messages.toolMaster.retire;

const target = (overrides: Partial<RetireTarget> = {}): RetireTarget => ({
  isActive: true,
  statusCode: 'IN_SERVICE',
  ...overrides,
});

const statusOptions = [
  { value: 'IN_SERVICE', label: '사용중' },
  { value: 'DISPOSED', label: '폐기' },
];

describe('deactivateAvailability', () => {
  it('쓰고 있는 툴은 중지할 수 있다', () => {
    expect(deactivateAvailability(target())).toEqual({ enabled: true, reason: null });
  });

  /* 감추지 않고 사유와 함께 잠근다 — 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다. */
  it('이미 중지된 툴은 잠그고 사유를 준다', () => {
    expect(deactivateAvailability(target({ isActive: false }))).toEqual({
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

describe('disposeAvailability', () => {
  it('운용 중인 툴은 폐기할 수 있다', () => {
    expect(disposeAvailability(target(), statusOptions)).toEqual({ enabled: true, reason: null });
  });

  it('이미 폐기된 툴은 잠그고 사유를 준다', () => {
    expect(disposeAvailability(target({ statusCode: 'DISPOSED' }), statusOptions)).toEqual({
      enabled: false,
      reason: t.alreadyDisposed,
    });
  });

  it('대상을 아직 모르면 잠근다', () => {
    expect(disposeAvailability(null, statusOptions)).toEqual({
      enabled: false,
      reason: t.targetUnknown,
    });
  });

  /*
   * ⭐ **「목록이 비었는가」가 아니라 「내가 쓰는 코드값이 그 목록에 있는가」를 본다.**
   * 목록이 차 있어도 폐기 코드가 없으면 이미 폐기된 자산을 「아직 안 폐기됨」으로 읽는다.
   */
  it('폐기 코드값이 목록에 없으면 잠근다 — 목록이 차 있어도', () => {
    expect(disposeAvailability(target(), [{ value: 'IN_SERVICE', label: '사용중' }])).toEqual({
      enabled: false,
      reason: t.disposeUnavailable,
    });
  });

  it('코드값 목록이 비어도 잠근다', () => {
    expect(disposeAvailability(target(), []).enabled).toBe(false);
  });
});

describe('referenceNote', () => {
  /* ⭐ 계약이 시킨 것이다 — 「참조가 있으면 건수를 함께 보인 뒤 부른다」(B-4). */
  it('참조가 있으면 건수를 말한다', () => {
    expect(referenceNote(3)).toBe(r.referenceCount(3));
  });

  it('참조가 없으면 없다고 말한다', () => {
    expect(referenceNote(0)).toBe(r.referenceNone);
  });

  /*
   * ⛔ **모르는 것을 「없다」로 그리지 않는다**(G-9). 셀 수 없는 것을 없다고 하면 매인 자료가
   * 있는데도 가볍게 누르게 된다 — 계약이 `NOT_COUNTABLE` 이면 `null` 이라고 못박은 이유다.
   */
  it.each([null, undefined])('건수가 %s 면 셀 수 없다고 말한다', (count) => {
    expect(referenceNote(count)).toBe(r.referenceUnknown);
  });

  it('세 갈래가 서로 다른 말이다', () => {
    expect(new Set([referenceNote(3), referenceNote(0), referenceNote(null)]).size).toBe(3);
  });
});

describe('labelNote', () => {
  /* 참조 건수와 **다른 축**이다 — 라벨은 시스템 밖에 나가 있어 회수할 수 없다. */
  it('발행된 라벨이 있으면 회차를 말한다', () => {
    expect(labelNote(2)).toBe(r.labelIssued(2));
  });

  /* 할 말이 없을 때 빈 줄을 세우지 않는다. */
  it.each([0, null])('발행 회차가 %s 면 아무 말도 하지 않는다', (count) => {
    expect(labelNote(count)).toBeNull();
  });
});
