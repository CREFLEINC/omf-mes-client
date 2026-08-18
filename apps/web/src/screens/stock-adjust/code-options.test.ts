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
  it('두 값 목록이 비어 있다 — 지금의 사실이다', () => {
    expect(PLACEHOLDER_STOCK_ADJUST_CODES.reason).toEqual([]);
    expect(PLACEHOLDER_STOCK_ADJUST_CODES.status).toEqual([]);
  });

  /**
   * ⛔ **승인 대기 조건이 코드 자리에도 없다**(D-3). 자리표시를 늘리는 자리라 이름 하나가
   * 늘면 그 조건이 곧 조회에 실린다 — 목록의 열쇠를 값까지 함께 잰다.
   */
  it('자리표시가 둘뿐이다 — 승인 축의 코드가 없다', () => {
    expect(Object.keys(PLACEHOLDER_STOCK_ADJUST_CODES)).toEqual(['reason', 'status']);
  });
});

describe('toCodeOptionSets', () => {
  it('빈 값 목록은 빈 선택지가 된다', () => {
    expect(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES).reason).toEqual([]);
    expect(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES).status).toEqual([]);
  });

  /** 라벨을 지어내지 않는다 — 사람이 읽을 이름을 주는 곳이 아직 없다. */
  it('코드값을 그대로 라벨로 쓴다', () => {
    expect(toCodeOptionSets({ reason: ['SAMPLE_AR_A'], status: [] }).reason).toEqual([
      { value: 'SAMPLE_AR_A', label: 'SAMPLE_AR_A' },
    ]);
  });

  it('두 코드가 서로를 끌고 가지 않는다 — 한쪽만 채워도 다른 쪽은 그대로다', () => {
    const sets = toCodeOptionSets({ reason: [], status: ['SAMPLE_ST_A'] });

    expect(sets.status).toEqual([{ value: 'SAMPLE_ST_A', label: 'SAMPLE_ST_A' }]);
    expect(sets.reason).toEqual([]);
  });

  /** 차례가 뜻일 수 있다(자주 쓰는 것부터 등) — 화면이 다시 세우지 않는다. */
  it('받은 차례를 바꾸지 않는다', () => {
    expect(
      toCodeOptionSets({ reason: ['SAMPLE_AR_B', 'SAMPLE_AR_A'], status: [] }).reason.map(
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
 * | `reason` | 헤더 사유 · 이력 조건 | **요청 필수**(등록) | **등록이 통째로 막힌다.** 대상 세우기·실사 차이 불러오기·이력 조회는 그대로 쓰인다 |
 * | `status` | 이력 조건 | 조건(선택) | **아무것도 막지 않는다** — 상태로 좁히지 못할 뿐이다 |
 */
describe('isReasonCodeListPending', () => {
  it('선택지가 없으면 등록이 막힌다', () => {
    expect(isReasonCodeListPending(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES))).toBe(true);
  });

  it('선택지가 하나라도 차면 살아난다', () => {
    expect(isReasonCodeListPending(toCodeOptionSets({ reason: ['SAMPLE_AR_A'], status: [] }))).toBe(
      false,
    );
  });

  /**
   * ⚠ **상태 자리표시는 잠금에 쓰지 않는다**(D-13과 같은 규율). 등록의 잠금 판정이 상태
   * 목록을 읽으면, 상태가 확정되지 않는 한 등록이 **영영 잠긴다.**
   */
  it('상태 값 목록은 등록 잠금을 좌우하지 않는다', () => {
    expect(isReasonCodeListPending(toCodeOptionSets({ reason: ['SAMPLE_AR_A'], status: [] }))).toBe(
      false,
    );
    expect(isReasonCodeListPending(toCodeOptionSets({ reason: [], status: ['SAMPLE_ST_A'] }))).toBe(
      true,
    );
  });
});
