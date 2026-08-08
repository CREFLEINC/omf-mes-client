import { describe, expect, it } from 'vitest';

import { classifyExpiry, EXPIRY_SOON_DAYS } from './expiry';

/**
 * 「오늘」을 **인자로 고정한다.** 함수 안에서 `new Date()`를 부르면 이 테스트가 실행 환경의
 * 시각을 검사하게 되어, 아무것도 고치지 않았는데 어느 날 갑자기 깨진다.
 */
const TODAY = new Date(2026, 7, 8);

/** 오늘에서 며칠 뒤의 유효기한 문자열. 경계를 **날짜 계산으로** 만든다. */
const inDays = (days: number): string => {
  const at = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + days);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
};

describe('classifyExpiry — 경계', () => {
  /* 유효기한이 없는 LOT이 정상이다(계약에서 `nullable`) — 표식을 지어내지 않는다. */
  it('유효기한이 없으면 표식이 없다', () => {
    expect(classifyExpiry(null, TODAY)).toBe('none');
  });

  it('어제 지난 것은 경과다', () => {
    expect(classifyExpiry(inDays(-1), TODAY)).toBe('passed');
  });

  /*
   * **오늘은 아직 지나지 않았다.** 유효기한은 그 날까지 쓸 수 있다는 뜻이라 오늘을 경과로
   * 부르면 하루 일찍 못 쓰는 재고가 된다. 경과와 임박을 가르는 자리가 여기다.
   */
  it('오늘이면 임박이고 경과가 아니다', () => {
    expect(classifyExpiry(inDays(0), TODAY)).toBe('soon');
  });

  it('내일이면 임박이다', () => {
    expect(classifyExpiry(inDays(1), TODAY)).toBe('soon');
  });

  /* 기준일 **당일까지 포함**한다 — 「30일 안에 닥친다」는 30일째를 뺀 뜻이 아니다. */
  it('기준 일수째는 임박이다', () => {
    expect(classifyExpiry(inDays(EXPIRY_SOON_DAYS), TODAY)).toBe('soon');
  });

  /* 바로 바깥 — 이것이 임박으로 나오면 경계가 하루 밀린 것이다. */
  it('기준 일수 + 1일째는 표식이 없다', () => {
    expect(classifyExpiry(inDays(EXPIRY_SOON_DAYS + 1), TODAY)).toBe('none');
  });

  it('한참 뒤면 표식이 없다', () => {
    expect(classifyExpiry(inDays(365), TODAY)).toBe('none');
  });
});

describe('classifyExpiry — 기준 일수 상수', () => {
  /*
   * **판정식이 이 상수를 통해서만 읽는다.** 위 경계 단언이 전부 `EXPIRY_SOON_DAYS`에서
   * 날짜를 만들므로, 상수를 바꾸면 판정도 함께 움직여야 통과한다 — 판정식에 숫자를 직접
   * 적어 두면 상수만 고쳤을 때 화면이 상수와 다른 날짜를 임박이라고 말하게 된다.
   */
  it('기준 일수가 30일이다', () => {
    expect(EXPIRY_SOON_DAYS).toBe(30);
  });

  /* 기준이 확정되면(품목별인지 고정값인지) 고칠 자리가 이 상수 하나임을 값으로 못 박는다. */
  it('상수가 양의 정수다', () => {
    expect(Number.isInteger(EXPIRY_SOON_DAYS)).toBe(true);
    expect(EXPIRY_SOON_DAYS).toBeGreaterThan(0);
  });
});

describe('classifyExpiry — 시각과 깨진 값', () => {
  /*
   * **날짜로만 견준다.** 「오늘」에 시각이 붙어 있어도 같은 날이면 결과가 같아야 한다 —
   * 시각까지 견주면 오후에 연 화면과 오전에 연 화면이 다른 표식을 낸다.
   */
  it('오늘의 시각이 판정을 바꾸지 않는다', () => {
    const morning = new Date(2026, 7, 8, 0, 1);
    const night = new Date(2026, 7, 8, 23, 59);

    expect(classifyExpiry(inDays(EXPIRY_SOON_DAYS), morning)).toBe('soon');
    expect(classifyExpiry(inDays(EXPIRY_SOON_DAYS), night)).toBe('soon');
    expect(classifyExpiry(inDays(-1), night)).toBe('passed');
  });

  /* 해가 바뀌는 자리에서 날짜 계산이 밀리지 않는다. */
  it('해를 넘겨도 날짜 수로 센다', () => {
    const yearEnd = new Date(2026, 11, 20);

    expect(classifyExpiry('2027-01-05', yearEnd)).toBe('soon');
    expect(classifyExpiry('2026-12-19', yearEnd)).toBe('passed');
    expect(classifyExpiry('2027-03-01', yearEnd)).toBe('none');
  });

  /*
   * **깨진 값에 표식을 지어내지 않는다.** 없는 날짜를 `Date`에 그냥 넘기면 다음 달로 굴러가
   * (`2026-02-31` → 3월 3일) 서버가 준 적 없는 날짜를 화면이 판정하게 된다.
   */
  it('없는 날짜와 형식이 다른 값은 표식이 없다', () => {
    expect(classifyExpiry('2026-02-31', TODAY)).toBe('none');
    expect(classifyExpiry('2026-13-01', TODAY)).toBe('none');
    expect(classifyExpiry('2026-08-08T09:12:00+09:00', TODAY)).toBe('none');
    expect(classifyExpiry('', TODAY)).toBe('none');
    expect(classifyExpiry('어제', TODAY)).toBe('none');
  });
});
