import { describe, expect, it } from 'vitest';

import { readSourceLineId, readSourceReceiptId, withSourceLineId } from './entry';

/**
 * 진입 맥락은 **주소가 정본이다**(계획 결정 2). 새로고침·뒤로가기·공유가 같은 초과분을 열어야 한다.
 *
 * 주소는 사람이 손으로 고치는 자리라 **못 알아듣는 값을 그대로 요청에 싣지 않는다** —
 * `NaN`이 경로 조각으로 나가면 조회가 늘 실패하고 사용자에게는 「화면이 안 된다」로만 보인다.
 */

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readSourceReceiptId', () => {
  it('양의 정수만 대상 전표로 읽는다', () => {
    expect(readSourceReceiptId(params('receipt=9101'))).toBe(9101);
  });

  it('키가 없으면 맥락이 없는 것으로 본다', () => {
    expect(readSourceReceiptId(params(''))).toBeNull();
  });

  it.each(['abc', '0', '-3', '1.5', '', ' ', '9101a'])(
    '못 알아듣는 값 %o은 맥락이 아니다',
    (raw) => {
      expect(readSourceReceiptId(params(`receipt=${raw}`))).toBeNull();
    },
  );
});

describe('readSourceLineId', () => {
  it('양의 정수만 고른 줄로 읽는다', () => {
    expect(readSourceLineId(params('receipt=9101&line=9111'))).toBe(9111);
  });

  it('키가 없으면 아직 고르지 않은 것으로 본다', () => {
    expect(readSourceLineId(params('receipt=9101'))).toBeNull();
  });

  it.each(['abc', '0', '-3', '1.5'])('못 알아듣는 값 %o은 선택이 아니다', (raw) => {
    expect(readSourceLineId(params(`receipt=9101&line=${raw}`))).toBeNull();
  });
});

describe('withSourceLineId', () => {
  it('고른 줄만 갈아 끼우고 나머지 주소 값은 그대로 둔다', () => {
    const next = withSourceLineId(params('receipt=9101&line=9111'), 9112);

    expect(next.get('receipt')).toBe('9101');
    expect(next.get('line')).toBe('9112');
  });

  it('받은 것을 고치지 않고 새 값을 만든다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다', () => {
    const before = params('receipt=9101');
    const next = withSourceLineId(before, 9111);

    expect(before.get('line')).toBeNull();
    expect(next).not.toBe(before);
  });
});
