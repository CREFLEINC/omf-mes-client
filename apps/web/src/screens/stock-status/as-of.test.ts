import { describe, expect, it } from 'vitest';

import { formatAsOf } from './as-of';

/**
 * 「응답이 도착한 시각」을 고정 값으로 넣는다. 이 함수 안에서 `new Date()`를 부르면
 * 아무것도 안 했는데 시각이 계속 바뀌고, 테스트가 실행 환경의 시각을 검사하게 된다.
 */
const at = (text: string): number => new Date(text).getTime();

describe('formatAsOf — 조회 시점 표기', () => {
  it('분까지만 낸다', () => {
    expect(formatAsOf(at('2026-08-08T09:12:34'))).toBe('2026-08-08 09:12');
  });

  it('한 자리 수를 0으로 채운다', () => {
    expect(formatAsOf(at('2026-01-02T03:04:00'))).toBe('2026-01-02 03:04');
  });

  /*
   * `useQuery`의 `dataUpdatedAt`은 아직 받은 자료가 없으면 0이다.
   * 그때 1970년을 내면 사용자가 그 시각의 재고를 본 것으로 읽는다.
   */
  it('아직 받은 자료가 없으면 표기하지 않는다', () => {
    expect(formatAsOf(0)).toBeNull();
    expect(formatAsOf(null)).toBeNull();
  });

  /* 같은 값을 넣으면 늘 같은 결과다 — 다시 그려도 시각이 흔들리지 않는다. */
  it('같은 값이면 몇 번을 불러도 같다', () => {
    const updatedAt = at('2026-08-08T09:12:34');

    expect(formatAsOf(updatedAt)).toBe(formatAsOf(updatedAt));
  });
});
