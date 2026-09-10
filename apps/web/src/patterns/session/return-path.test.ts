import { describe, expect, it } from 'vitest';

import { HOME_PATH, readReturnPath, resolveReturnPath } from './return-path';

describe('readReturnPath — 돌아갈 수 있는 주소만 꺼낸다', () => {
  it('앱 안의 주소는 그대로 꺼낸다', () => {
    expect(readReturnPath({ from: '/master-data/warehouse-location' })).toBe(
      '/master-data/warehouse-location',
    );
  });

  it('질의 문자열이 붙은 주소도 그대로 꺼낸다', () => {
    expect(readReturnPath({ from: '/logistics/stock-adjust?count=9101' })).toBe(
      '/logistics/stock-adjust?count=9101',
    );
  });

  it('실려 온 값이 없으면 꺼낼 것이 없다', () => {
    expect(readReturnPath(undefined)).toBeNull();
    expect(readReturnPath(null)).toBeNull();
    expect(readReturnPath({})).toBeNull();
    expect(readReturnPath({ from: 42 })).toBeNull();
  });

  /**
   * ⛔ **바깥으로 나가는 주소를 그대로 쓰지 않는다.** 이동 상태는 브라우저 히스토리에 남는
   * 값이라 이 앱이 쓴 것이라고 단정할 수 없다 — 검사 없이 넘기면 로그인 직후 남의 사이트로
   * 나가는 길이 되고, 그 화면은 방금 로그인한 사람에게 우리 화면처럼 보인다.
   */
  it('절대 주소로 나가지 않는다', () => {
    expect(readReturnPath({ from: 'https://evil.example/steal' })).toBeNull();
    expect(readReturnPath({ from: 'http://evil.example' })).toBeNull();
  });

  /**
   * ⚠ **`//`로 시작하는 값이 함정이다.** 「`/`로 시작하면 내부 주소」라는 검사 하나만 두면
   * 프로토콜 상대 주소가 그대로 통과해 바깥으로 나간다.
   */
  it('프로토콜 상대 주소로 나가지 않는다', () => {
    expect(readReturnPath({ from: '//evil.example/steal' })).toBeNull();
  });

  it('상대 주소는 받지 않는다', () => {
    expect(readReturnPath({ from: 'dashboard' })).toBeNull();
  });

  /** 자기 자신으로 돌려보내면 로그인이 끝나지 않는다. */
  it('로그인 화면으로 되돌리지 않는다', () => {
    expect(readReturnPath({ from: '/login' })).toBeNull();
    expect(readReturnPath({ from: '/login?next=/dashboard' })).toBeNull();
  });
});

describe('resolveReturnPath — 없으면 첫 화면으로', () => {
  it('막힌 주소가 있으면 그리로 간다', () => {
    expect(resolveReturnPath({ from: '/quality/lot-status' })).toBe('/quality/lot-status');
  });

  it('막힌 주소가 없으면 첫 화면으로 간다', () => {
    expect(resolveReturnPath(null)).toBe(HOME_PATH);
  });

  it('돌아갈 수 없는 주소가 실려 와도 첫 화면으로 간다', () => {
    expect(resolveReturnPath({ from: '//evil.example' })).toBe(HOME_PATH);
  });
});
