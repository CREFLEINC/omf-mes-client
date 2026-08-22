import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { deactivateAvailability, disposeAvailability, type RetireTarget } from './asset-actions';
import type { CodeOption } from './code-options';

const t = messages.gaugeMaster.actionReasons;

const target = (overrides: Partial<RetireTarget> = {}): RetireTarget => ({
  isActive: true,
  statusCode: 'IN_SERVICE',
  ...overrides,
});

const withDisposed: CodeOption[] = [
  { value: 'IN_SERVICE', label: '사용중' },
  { value: 'DISPOSED', label: '폐기' },
];

describe('사용 중지를 할 수 있는가', () => {
  it('사용 중이면 할 수 있다', () => {
    expect(deactivateAvailability(target())).toEqual({ enabled: true, reason: null });
  });

  /* 감추지 않고 사유와 함께 잠근다 — 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다. */
  it('이미 중지됐으면 사유와 함께 잠근다', () => {
    const result = deactivateAvailability(target({ isActive: false }));

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.alreadyInactive);
  });

  it('잠글 때는 반드시 사유가 있다', () => {
    expect(deactivateAvailability(target({ isActive: false })).reason).not.toBeNull();
  });
});

describe('폐기를 할 수 있는가', () => {
  it('폐기되지 않은 자산이면 할 수 있다', () => {
    expect(disposeAvailability(target(), withDisposed)).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it('이미 폐기됐으면 사유와 함께 잠근다', () => {
    const result = disposeAvailability(target({ statusCode: 'DISPOSED' }), withDisposed);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.alreadyDisposed);
  });

  /* 시드가 아직 없으면 목록이 빈다(설계 omf-mes#182) — 판정할 수 없으니 잠근다. */
  it('값 목록이 비면 판정할 수 없어 잠근다', () => {
    const result = disposeAvailability(target(), []);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.disposeUnavailable);
  });

  /*
   * ⭐ **「목록이 비었는가」가 아니라 「내가 쓰는 값이 거기 있는가」를 본다.**
   * 목록은 차 있는데 폐기 코드가 없으면, 이미 폐기된 자산을 「아직 안 폐기됨」으로 읽는다.
   */
  it('목록에 폐기 코드가 없으면 차 있어도 잠근다', () => {
    const result = disposeAvailability(target({ statusCode: 'RETIRED' }), [
      { value: 'RETIRED', label: '퇴역' },
    ]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.disposeUnavailable);
  });

  /*
   * ⛔ **모르면 잠근다.** 열어 두면 확인 창이 그릴 대상을 못 찾아 눌러도 아무 일도
   * 일어나지 않는다 — 사용자는 잘못 눌렀다고 여기고 다시 누르며, 화면은 계속 침묵한다.
   */
  it('상세를 못 받았으면 둘 다 잠그고 그 사유를 밝힌다', () => {
    expect(disposeAvailability(null, withDisposed)).toEqual({
      enabled: false,
      reason: t.targetUnknown,
    });
    expect(deactivateAvailability(null)).toEqual({ enabled: false, reason: t.targetUnknown });
  });

  it('「모른다」는 「이미 했다」와 다른 말이다', () => {
    expect(t.targetUnknown).not.toBe(t.alreadyDisposed);
    expect(t.targetUnknown).not.toBe(t.alreadyInactive);
  });

  it('두 사유는 다른 말이다', () => {
    expect(t.alreadyDisposed).not.toBe(t.disposeUnavailable);
  });
});
