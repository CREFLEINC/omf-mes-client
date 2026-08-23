import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { effectiveResponse, makeMold } from './fixtures';
import {
  appliedRatio,
  cavityMismatch,
  cavityOf,
  matchedScopeText,
  parseQuantity,
  shotCount,
} from './preview';

const t = messages.shotConversion.preview;

describe('생산 수량 읽기', () => {
  it('수로 읽는다', () => {
    expect(parseQuantity('500')).toBe(500);
  });

  it('빈 칸은 셀 수 없다', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('   ')).toBeNull();
  });

  it('수가 아니면 셀 수 없다', () => {
    expect(parseQuantity('오백')).toBeNull();
  });

  /** 0이나 음수로는 셀 것이 없다 — 미리보기가 0을 보이면 「환산이 0을 낸다」로 읽힌다. */
  it('0 이하는 셀 수 없다', () => {
    expect(parseQuantity('0')).toBeNull();
    expect(parseQuantity('-5')).toBeNull();
  });
});

/**
 * ⛔ **「1.0」으로 채우지 않는다**(공유계약 G-9). 없는 정책을 있는 것으로 만들면
 * **계산이 조용히 돌고** 사용자는 환산이 되는 줄 안다.
 */
describe('적용 비율', () => {
  it('맞는 정책이 있으면 그 값이다', () => {
    expect(appliedRatio(effectiveResponse())).toBe(0.25);
  });

  it('맞는 정책이 없으면 없음이다', () => {
    expect(appliedRatio(effectiveResponse({ resolved: false, valueNumeric: null }))).toBeNull();
  });

  /** ⛔ 값이 실려 와도 `resolved` 가 거짓이면 쓰지 않는다 — 서버가 아니라고 했다. */
  it('맞지 않았다면 값이 실려 와도 쓰지 않는다', () => {
    expect(appliedRatio(effectiveResponse({ resolved: false, valueNumeric: 1 }))).toBeNull();
  });

  it('아직 묻지 않았으면 없음이다', () => {
    expect(appliedRatio(null)).toBeNull();
  });

  it('맞았는데 값이 비었으면 없음이다', () => {
    expect(appliedRatio(effectiveResponse({ valueNumeric: null }))).toBeNull();
  });
});

/** ⭐ 서버가 「어느 축으로 이겼는가」를 준다 — 그것이 곧 왜 이 값인지의 설명이다. */
describe('이긴 축', () => {
  it('아는 값은 사람 말로 옮긴다', () => {
    expect(matchedScopeText(effectiveResponse({ matchedScopeCode: 'ITEM' }))).toBe('품목');
    expect(matchedScopeText(effectiveResponse({ matchedScopeCode: 'ALL' }))).toBe('전체');
  });

  /** ⛔ 모르는 값에 이름을 지어내지 않는다(G-9). */
  it('모르는 값은 그대로 둔다', () => {
    expect(matchedScopeText(effectiveResponse({ matchedScopeCode: 'ZONE' }))).toBe('ZONE');
  });

  it('맞지 않았으면 없음이다', () => {
    expect(matchedScopeText(effectiveResponse({ matchedScopeCode: null }))).toBeNull();
    expect(matchedScopeText(null)).toBeNull();
  });
});

describe('타발수', () => {
  it('수량과 비율을 곱한다', () => {
    expect(shotCount(500, 0.25)).toBe(125);
  });

  /** ⚠ 반올림하지 않는다 — 어떻게 접을지는 서버가 정하고, 화면이 임의로 접으면 어긋난다. */
  it('소수가 나오면 소수로 둔다', () => {
    expect(shotCount(10, 0.33)).toBeCloseTo(3.3, 10);
  });

  it('하나라도 없으면 셀 수 없다', () => {
    expect(shotCount(null, 0.25)).toBeNull();
    expect(shotCount(500, null)).toBeNull();
  });
});

/**
 * ⭐ **비율 = 1 / 캐비티 수**가 이 화면의 뜻이다. 두 값이 서로 다른 곳에 있어(툴 마스터 ·
 * 정책) **어긋날 수 있고, 어긋나면 타발수가 조용히 틀린다.**
 */
describe('캐비티 수와 비율이 맞는가', () => {
  it('맞으면 아무 말도 하지 않는다', () => {
    expect(cavityMismatch(4, 0.25)).toBeNull();
    expect(cavityMismatch(1, 1)).toBeNull();
  });

  /**
   * ⚠ **저장 자릿수에 맞춰 견준다.** 계약이 비율을 `numeric(20,6)` 으로 두어 **소수점 아래
   * 여섯 자리까지만 저장된다** — 캐비티 3이면 서버가 돌려주는 값은 `0.333333` 이고
   * `1 / 3` 과 결코 정확히 같지 않다. 더 촘촘히 견주면 **캐비티 3·6·7·9… 에서 늘 어긋났다고
   * 말하게 된다** — 없는 경고를 만들어 내는 일이다.
   */
  it('저장 자릿수로 잘린 값도 같은 것으로 본다', () => {
    expect(cavityMismatch(3, 0.333333)).toBeNull();
    expect(cavityMismatch(6, 0.166667)).toBeNull();
    expect(cavityMismatch(7, 0.142857)).toBeNull();
  });

  it('계산값 그대로여도 같은 것으로 본다', () => {
    expect(cavityMismatch(3, 1 / 3)).toBeNull();
  });

  /** 자릿수를 맞춰도 진짜 다른 값은 잡는다 — 견줌을 느슨하게 한 것이 아니다. */
  it('저장 자릿수 안에서 다르면 알린다', () => {
    expect(cavityMismatch(3, 0.33)).toBe(t.cavityMismatch(3, '0.333333'));
  });

  it('어긋나면 기대값을 담아 알린다', () => {
    expect(cavityMismatch(4, 1)).toBe(t.cavityMismatch(4, '0.25'));
  });

  it('견줄 것이 없으면 말하지 않는다', () => {
    expect(cavityMismatch(null, 0.25)).toBeNull();
    expect(cavityMismatch(4, null)).toBeNull();
  });
});

describe('캐비티 수', () => {
  it('고른 툴의 값이다', () => {
    expect(cavityOf(makeMold(7001, 'MLD-0207', 4))).toBe(4);
  });

  /**
   * ⭐ **스펙의 「캐비티 수 미등록」 예외는 계약이 닫았다** — 필수이고 최솟값이 1이다.
   * 남는 「없음」은 아직 고르지 않은 것 하나뿐이고 그것은 오류가 아니다.
   */
  it('툴을 고르지 않았으면 없음이다', () => {
    expect(cavityOf(null)).toBeNull();
  });
});
