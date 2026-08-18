import { describe, expect, it } from 'vitest';

import { readInventoryCountId, withInventoryCountId, withoutInventoryCountId } from './entry';

/**
 * 진입 맥락은 **주소가 정본이다**(계획 결정 D-2). 재고실사에서 넘어오는 길이 실재하고,
 * 새로고침·뒤로가기·공유가 같은 실사를 열어야 한다.
 *
 * 주소는 사람이 손으로 고치는 자리라 **못 알아듣는 값을 그대로 요청에 싣지 않는다** —
 * `NaN`이 경로 조각으로 나가면 조회가 늘 실패하고 사용자에게는 「화면이 안 된다」로만 보인다.
 */

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readInventoryCountId', () => {
  it('양의 정수만 대상 실사로 읽는다', () => {
    expect(readInventoryCountId(params('count=9101'))).toBe(9101);
  });

  it('키가 없으면 직접 등록으로 연다 — 맥락이 없는 것이 정상 경로다', () => {
    expect(readInventoryCountId(params(''))).toBeNull();
  });

  it.each(['abc', '0', '-3', '1.5', '', ' ', '9101a'])(
    '못 알아듣는 값 %o은 맥락이 아니다',
    (raw) => {
      expect(readInventoryCountId(params(`count=${raw}`))).toBeNull();
    },
  );

  it('다른 주소 값이 함께 있어도 대상 실사만 읽는다', () => {
    expect(readInventoryCountId(params('tab=history&count=9101'))).toBe(9101);
  });
});

describe('withoutInventoryCountId', () => {
  it('대상 실사만 지우고 나머지 주소 값은 그대로 둔다', () => {
    const next = withoutInventoryCountId(params('tab=history&count=9101'));

    expect(next.get('count')).toBeNull();
    expect(next.get('tab')).toBe('history');
  });

  it('받은 것을 고치지 않고 새 값을 만든다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다', () => {
    const before = params('count=9101');
    const next = withoutInventoryCountId(before);

    expect(before.get('count')).toBe('9101');
    expect(next).not.toBe(before);
  });
});

describe('withInventoryCountId', () => {
  it('고른 실사만 갈아 끼우고 나머지 주소 값은 그대로 둔다', () => {
    const next = withInventoryCountId(params('tab=history&count=9101'), 9102);

    expect(next.get('count')).toBe('9102');
    expect(next.get('tab')).toBe('history');
  });

  it('받은 것을 고치지 않는다', () => {
    const before = params('');
    const next = withInventoryCountId(before, 9101);

    expect(before.get('count')).toBeNull();
    expect(next.get('count')).toBe('9101');
  });
});
