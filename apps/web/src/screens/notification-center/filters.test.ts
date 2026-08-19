import { describe, expect, it } from 'vitest';

import { URL_KEYS, withPeriod } from './filters';

describe('withPeriod', () => {
  it('기간 두 키를 주소에 심는다', () => {
    const next = withPeriod(new URLSearchParams(''), { from: '2026-08-01', to: '2026-08-07' });

    expect(next.get(URL_KEYS.from)).toBe('2026-08-01');
    expect(next.get(URL_KEYS.to)).toBe('2026-08-07');
  });

  it('이미 있던 기간은 덮어쓴다', () => {
    const next = withPeriod(new URLSearchParams('from=2026-01-01&to=2026-01-02'), {
      from: '2026-08-01',
      to: '2026-08-07',
    });

    expect(next.toString()).toBe('from=2026-08-01&to=2026-08-07');
  });

  it('기간과 상관없는 키를 지우지 않는다 — 기본값을 채우는 김에 조건이 사라지면 안 된다', () => {
    /*
     * ⭐ 새 `URLSearchParams`를 만들어 넣는 형태(전례 `integration-sync/screen.tsx`)를 그대로
     * 베끼면 이 단언이 깨진다. 조건이 늘어나는 뒤 회차일수록 손실이 커지는 자리다.
     */
    const next = withPeriod(new URLSearchParams('unread=1&ev=SYN-EVENT-01'), {
      from: '2026-08-01',
      to: '2026-08-07',
    });

    expect(next.get('unread')).toBe('1');
    expect(next.get('ev')).toBe('SYN-EVENT-01');
  });

  it('받은 주소를 바꾸지 않는다 — 부르는 쪽이 든 값이 몰래 달라지면 안 된다', () => {
    const params = new URLSearchParams('unread=1');

    withPeriod(params, { from: '2026-08-01', to: '2026-08-07' });

    expect(params.toString()).toBe('unread=1');
  });
});
