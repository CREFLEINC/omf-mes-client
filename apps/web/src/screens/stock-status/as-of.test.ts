import { describe, expect, it } from 'vitest';

import { formatAsOf, formatTransactionAt } from './as-of';

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

describe('formatTransactionAt — 표의 최근 거래 표기', () => {
  /*
   * 계약이 주는 값은 시간대까지 붙은 25자다. 그대로 그리면 열에서 여러 줄로 접힌다 —
   * 브라우저 확인 F-B2가 드러낸 자리다.
   *
   * **정확한 값은 시간대가 없는 표기로 검사한다.** 시간대가 붙은 값의 현지 표기는 실행 환경의
   * 시간대에 따라 달라져, 기대값을 박으면 테스트가 코드가 아니라 **실행 환경을 검사**하게 된다.
   */
  it('계약 값을 「MM-DD HH:mm」으로 줄인다', () => {
    expect(formatTransactionAt('2026-08-06T09:12:00')).toBe('08-06 09:12');
  });

  it('한 자리 수를 0으로 채운다', () => {
    expect(formatTransactionAt('2026-01-02T03:04:00')).toBe('01-02 03:04');
  });

  /*
   * 시간대를 **무시하지 않는다.** 같은 순간을 가리키는 두 표기가 같은 결과를 내야 한다 —
   * 시간대를 잘라 버리고 앞자리만 읽으면 이 단언이 깨진다. 실행 환경과 무관하게 성립한다.
   */
  it('같은 순간을 가리키는 두 표기가 같은 결과를 낸다', () => {
    expect(formatTransactionAt('2026-08-06T09:12:00+09:00')).toBe(
      formatTransactionAt('2026-08-06T00:12:00Z'),
    );
  });

  /* 계약 값이 그대로 새어 나오지 않는다 — 25자가 아니라 11자다. */
  it('시간대가 붙은 계약 값을 그대로 돌려주지 않는다', () => {
    const shortened = formatTransactionAt('2026-08-06T09:12:00+09:00');

    expect(shortened).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/);
    expect(shortened).not.toContain('2026');
  });

  it('값이 없으면 표기하지 않는다 — 호출부가 대시로 둔다', () => {
    expect(formatTransactionAt(null)).toBeNull();
    expect(formatTransactionAt('')).toBeNull();
  });

  /* 깨진 값에 표기를 지어내면 사용자가 그 시각에 움직인 것으로 읽는다. */
  it('깨진 값에는 표기를 지어내지 않는다', () => {
    expect(formatTransactionAt('어제쯤')).toBeNull();
  });
});
