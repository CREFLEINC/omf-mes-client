import { describe, expect, it } from 'vitest';

import { OVERDUE_INCLUDES_TODAY, isOverdue, isOverdueUnder, toDateText } from './arrival';

/**
 * 도착 예정일 경과 판정. **당일을 포함하는지가 아직 정해지지 않았다**(이슈 #20 §4).
 * 그래서 판정 기준을 상수 한 곳에 두고, 판정식은 그 값을 **인자로 받는 함수**만 갖는다 —
 * 판정식이 `false`를 직접 적으면 상수를 고쳐도 화면이 따라오지 않는다.
 */

/** 「오늘」은 인자로 준다 — 함수가 `new Date()`를 부르면 테스트가 실행 환경의 시각을 검사하게 된다. */
const TODAY = new Date(2026, 7, 10);

describe('toDateText', () => {
  it('현지 날짜를 YYYY-MM-DD로 옮긴다', () => {
    expect(toDateText(TODAY)).toBe('2026-08-10');
  });

  it('한 자리 달·일에 0을 채운다', () => {
    expect(toDateText(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  /*
   * 하루의 끝을 현지 시각으로 읽는다. UTC로 읽으면 한국 시간대에서 밤 9시 이후가 다음 날이 되어
   * 경과 판정이 하루 일찍 붙는다.
   */
  it('그날 마지막 시각도 같은 날짜다', () => {
    expect(toDateText(new Date(2026, 7, 10, 23, 59, 59))).toBe('2026-08-10');
  });
});

describe('isOverdue', () => {
  it('어제 도착 예정이면 경과다', () => {
    expect(isOverdue('2026-08-09', TODAY)).toBe(true);
  });

  it('내일 도착 예정이면 경과가 아니다', () => {
    expect(isOverdue('2026-08-11', TODAY)).toBe(false);
  });

  /* 확정된 처리는 **당일 미포함**이다(이슈 #20 §4). 오늘은 아직 경과가 아니다. */
  it('오늘 도착 예정이면 경과가 아니다 — 당일 미포함', () => {
    expect(isOverdue('2026-08-10', TODAY)).toBe(false);
  });

  it('당일 판정이 상수를 그대로 따른다', () => {
    expect(isOverdue('2026-08-10', TODAY)).toBe(
      isOverdueUnder('2026-08-10', TODAY, OVERDUE_INCLUDES_TODAY),
    );
  });

  it('해를 넘긴 예정일도 경과다', () => {
    expect(isOverdue('2025-12-31', TODAY)).toBe(true);
  });

  /*
   * 형식이 깨진 값에 경과를 붙이지 않는다 — 지어낸 판정을 화면에 내는 것이 되기 때문이다.
   * 문자열 비교는 `''`이나 `2026-8-9` 같은 값도 「작다」로 판정하므로 형식을 먼저 본다.
   */
  it.each(['', '2026-8-9', '20260809', '알 수 없음'])(
    '형식이 깨진 값(%s)에는 경과를 붙이지 않는다',
    (value) => {
      expect(isOverdue(value, TODAY)).toBe(false);
    },
  );
});

describe('isOverdueUnder', () => {
  /*
   * **판정 기준이 인자로 흐르는지**를 두 방향으로 본다. 판정식이 기준을 무시하고
   * 한쪽으로 고정돼 있으면 둘 중 하나가 반드시 실패한다.
   */
  it('당일을 포함하면 오늘도 경과다', () => {
    expect(isOverdueUnder('2026-08-10', TODAY, true)).toBe(true);
  });

  it('당일을 포함하지 않으면 오늘은 경과가 아니다', () => {
    expect(isOverdueUnder('2026-08-10', TODAY, false)).toBe(false);
  });

  it('기준과 무관하게 어제는 경과이고 내일은 아니다', () => {
    expect(isOverdueUnder('2026-08-09', TODAY, true)).toBe(true);
    expect(isOverdueUnder('2026-08-09', TODAY, false)).toBe(true);
    expect(isOverdueUnder('2026-08-11', TODAY, true)).toBe(false);
    expect(isOverdueUnder('2026-08-11', TODAY, false)).toBe(false);
  });
});

describe('OVERDUE_INCLUDES_TODAY', () => {
  /* 판정 기준이 정해지면 이 상수 하나만 고친다. 지금 확정된 값은 「당일 미포함」이다. */
  it('당일 미포함으로 고정돼 있다', () => {
    expect(OVERDUE_INCLUDES_TODAY).toBe(false);
  });
});
