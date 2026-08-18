import { describe, expect, it } from 'vitest';

import {
  isReasonCodeListPending,
  PLACEHOLDER_STOCK_ADJUST_CODES,
  toCodeOptionSets,
} from './code-options';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다(D-9 · 미결 #64).
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 계약의 `@example`(`COUNT_VARIANCE`)도
 * 심지 않는다 — 그것은 예시이지 확정이 아니고, 계약 자신이 「서버가 내려주는 선택지를 그대로
 * 쓴다」고 적었다(공유계약 G-2).
 *
 * **이것은 죽은 가지가 아니다.** 계약이 이 값을 등록 필수로 받으므로, 배열만 채우면 등록이
 * 저절로 살아난다 — 아래 감지기가 그 전환을 고정한다.
 */

describe('PLACEHOLDER_STOCK_ADJUST_CODES', () => {
  it('조정 사유 값 목록이 비어 있다 — 지금의 사실이다', () => {
    expect(PLACEHOLDER_STOCK_ADJUST_CODES.reason).toEqual([]);
  });
});

describe('toCodeOptionSets', () => {
  it('빈 값 목록은 빈 선택지가 된다', () => {
    expect(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES).reason).toEqual([]);
  });

  /** 라벨을 지어내지 않는다 — 사람이 읽을 이름을 주는 곳이 아직 없다. */
  it('코드값을 그대로 라벨로 쓴다', () => {
    expect(toCodeOptionSets({ reason: ['SAMPLE_AR_A'] }).reason).toEqual([
      { value: 'SAMPLE_AR_A', label: 'SAMPLE_AR_A' },
    ]);
  });

  /** 차례가 뜻일 수 있다(자주 쓰는 것부터 등) — 화면이 다시 세우지 않는다. */
  it('받은 차례를 바꾸지 않는다', () => {
    expect(
      toCodeOptionSets({ reason: ['SAMPLE_AR_B', 'SAMPLE_AR_A'] }).reason.map(
        (option) => option.value,
      ),
    ).toEqual(['SAMPLE_AR_B', 'SAMPLE_AR_A']);
  });
});

/**
 * **비면 무엇이 막히나 · 채우면 무엇이 살아나는가**를 감지기로 고정한다.
 *
 * | 코드 | 자리 | 필수도 | 비어 있으면 무엇이 막히나 |
 * | --- | --- | :-: | --- |
 * | `reason` | 헤더 사유 | **요청 필수** | **등록이 통째로 막힌다.** 대상 세우기·실사 차이 불러오기·이력 조회는 그대로 쓰인다 |
 */
describe('isReasonCodeListPending', () => {
  it('선택지가 없으면 등록이 막힌다', () => {
    expect(isReasonCodeListPending(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES))).toBe(true);
  });

  it('선택지가 하나라도 차면 살아난다', () => {
    expect(isReasonCodeListPending(toCodeOptionSets({ reason: ['SAMPLE_AR_A'] }))).toBe(false);
  });
});
