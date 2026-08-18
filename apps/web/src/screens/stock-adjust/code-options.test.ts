import { describe, expect, it } from 'vitest';

import { PLACEHOLDER_STOCK_ADJUST_CODES, toCodeOptionSets } from './code-options';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다(D-9 개정 · 미결 #64).
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 계약의 `@example`도 심지 않는다 —
 * 그것은 예시이지 확정이 아니고, 계약 자신이 「서버가 내려주는 선택지를 그대로 쓴다」고
 * 적었다(공유계약 G-2).
 *
 * ⭐ **남은 것은 상태 하나다.** 조정 사유는 **고객이 공통코드 마스터에 등록하는 값**으로
 * 결정돼(#36 회신) 조회로 옮겨 갔다 — 그 자리의 감지기는 `reason-options.test.ts`에 있다.
 * 여기 남은 잣대는 「사유가 다시 자리표시로 되돌아오지 않는다」와 「상태는 그대로 기다린다」다.
 */

describe('PLACEHOLDER_STOCK_ADJUST_CODES', () => {
  it('상태 값 목록이 비어 있다 — 지금의 사실이다', () => {
    expect(PLACEHOLDER_STOCK_ADJUST_CODES.status).toEqual([]);
  });

  /**
   * ⭐ **사유가 자리표시로 되돌아오지 않는다**(#36 회신 ①). 되돌아오면 실행 시점 조회가
   * 죽고 화면이 다시 「우리가 정할 값」으로 다룬다 — 열쇠 목록을 값까지 함께 잰다.
   *
   * ⛔ **승인 대기 조건도 코드 자리에 없다**(D-3). 자리표시를 늘리는 자리라 이름 하나가
   * 늘면 그 조건이 곧 조회에 실린다.
   */
  it('자리표시가 상태 하나뿐이다 — 사유도 승인 축도 없다', () => {
    expect(Object.keys(PLACEHOLDER_STOCK_ADJUST_CODES)).toEqual(['status']);
  });
});

describe('toCodeOptionSets', () => {
  it('빈 값 목록은 빈 선택지가 된다', () => {
    expect(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES).status).toEqual([]);
  });

  /** 라벨을 지어내지 않는다 — 사람이 읽을 이름을 주는 곳이 아직 없다. */
  it('코드값을 그대로 라벨로 쓴다', () => {
    expect(toCodeOptionSets({ status: ['SAMPLE_ST_A'] }).status).toEqual([
      { value: 'SAMPLE_ST_A', label: 'SAMPLE_ST_A' },
    ]);
  });

  /** 차례가 뜻일 수 있다(자주 쓰는 것부터 등) — 화면이 다시 세우지 않는다. */
  it('받은 차례를 바꾸지 않는다', () => {
    expect(
      toCodeOptionSets({ status: ['SAMPLE_ST_B', 'SAMPLE_ST_A'] }).status.map(
        (option) => option.value,
      ),
    ).toEqual(['SAMPLE_ST_B', 'SAMPLE_ST_A']);
  });

  /**
   * ⚠ **사유 선택지가 이 함수에서 나오지 않는다.** 나오면 조회 결과와 자리표시 두 정본이
   * 생기고, 둘이 어긋나는 날 어느 쪽이 화면에 서는지 아무도 모른다.
   */
  it('사유 선택지를 만들지 않는다', () => {
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_STOCK_ADJUST_CODES))).toEqual(['status']);
  });
});
