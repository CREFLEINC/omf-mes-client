import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { deactivateAvailability, disposeAvailability } from './asset-actions';
import type { CodeOption } from './code-options';

const t = messages.gaugeMaster.actionReasons;

const withDisposed: CodeOption[] = [
  { value: 'IN_SERVICE', label: '사용중' },
  { value: 'DISPOSED', label: '폐기' },
];

describe('사용 중지를 할 수 있는가', () => {
  it('사용 중이면 할 수 있다', () => {
    expect(deactivateAvailability(true)).toEqual({ enabled: true, reason: null });
  });

  /* 감추지 않고 사유와 함께 잠근다 — 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다. */
  it('이미 중지됐으면 사유와 함께 잠근다', () => {
    const result = deactivateAvailability(false);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.alreadyInactive);
  });

  it('잠글 때는 반드시 사유가 있다', () => {
    expect(deactivateAvailability(false).reason).not.toBeNull();
  });
});

describe('폐기를 할 수 있는가', () => {
  it('폐기되지 않은 자산이면 할 수 있다', () => {
    expect(disposeAvailability('IN_SERVICE', withDisposed)).toEqual({
      enabled: true,
      reason: null,
    });
  });

  it('이미 폐기됐으면 사유와 함께 잠근다', () => {
    const result = disposeAvailability('DISPOSED', withDisposed);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.alreadyDisposed);
  });

  /* 시드가 아직 없으면 목록이 빈다(설계 omf-mes#182) — 판정할 수 없으니 잠근다. */
  it('값 목록이 비면 판정할 수 없어 잠근다', () => {
    const result = disposeAvailability('IN_SERVICE', []);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.disposeUnavailable);
  });

  /*
   * ⭐ **「목록이 비었는가」가 아니라 「내가 쓰는 값이 거기 있는가」를 본다.**
   * 목록은 차 있는데 폐기 코드가 없으면, 이미 폐기된 자산을 「아직 안 폐기됨」으로 읽는다.
   */
  it('목록에 폐기 코드가 없으면 차 있어도 잠근다', () => {
    const result = disposeAvailability('RETIRED', [{ value: 'RETIRED', label: '퇴역' }]);

    expect(result.enabled).toBe(false);
    expect(result.reason).toBe(t.disposeUnavailable);
  });

  it('상태를 모르면 폐기되지 않은 것으로 보되 판정 자체는 목록이 정한다', () => {
    expect(disposeAvailability(null, withDisposed).enabled).toBe(true);
    expect(disposeAvailability(null, []).enabled).toBe(false);
  });

  it('두 사유는 다른 말이다', () => {
    expect(t.alreadyDisposed).not.toBe(t.disposeUnavailable);
  });
});
