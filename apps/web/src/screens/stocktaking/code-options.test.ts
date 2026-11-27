import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codePlaceholder,
  isCountTypeListPending,
  isVarianceReasonListPending,
  PLACEHOLDER_STOCKTAKING_CODES,
  toCodeOptionSets,
} from './code-options';

/**
 * 계약이 `@example`로 적어 둔 값. **어느 것도 코드에 심지 않는다** — 예시는 확정이 아니고,
 * 심으면 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모른다(계획 §12-12).
 */
const CONTRACT_EXAMPLES = ['CYCLE', 'MISPLACED', 'IN_PROGRESS'];

describe('PLACEHOLDER_STOCKTAKING_CODES', () => {
  /*
   * **비어 있는 것이 지금의 사실이다**(`omf-mes#64`). 자리표시 값을 하나 넣어 두면
   * 사용자가 그것을 고를 수 있고, 고르면 서버가 모르는 코드가 **되돌릴 수 없는 전표**에 실린다.
   */
  it('코드 셋의 값 목록이 전부 비어 있다', () => {
    expect(PLACEHOLDER_STOCKTAKING_CODES.countType).toEqual([]);
    expect(PLACEHOLDER_STOCKTAKING_CODES.varianceReason).toEqual([]);
  });

  it('계약의 예시 값을 심지 않는다', () => {
    const all = [
      ...PLACEHOLDER_STOCKTAKING_CODES.countType,
      ...PLACEHOLDER_STOCKTAKING_CODES.varianceReason,
    ];

    for (const example of CONTRACT_EXAMPLES) expect(all).not.toContain(example);
  });
});

describe('toCodeOptionSets', () => {
  it('값 목록을 선택지로 옮긴다', () => {
    const sets = toCodeOptionSets({
      countType: ['SAMPLE_COUNT_TYPE_A'],
      varianceReason: ['SAMPLE_VARIANCE_REASON_A', 'SAMPLE_VARIANCE_REASON_B'],
    });

    expect(sets.countType).toEqual([
      { value: 'SAMPLE_COUNT_TYPE_A', label: 'SAMPLE_COUNT_TYPE_A' },
    ]);
    expect(sets.varianceReason).toHaveLength(2);
  });

  /*
   * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
   * 아직 없는데 화면이 「순환 실사」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
   */
  it('코드값을 그대로 라벨로 쓴다', () => {
    const [option] = toCodeOptionSets({
      countType: ['SAMPLE_COUNT_TYPE_A'],
      varianceReason: [],
    }).countType;

    expect(option?.label).toBe(option?.value);
  });

  /** **차례를 바꾸지 않는다** — 값 목록이 오는 차례가 뜻일 수 있다(자주 쓰는 것부터 등). */
  it('값의 차례를 바꾸지 않는다', () => {
    const sets = toCodeOptionSets({
      countType: [],
      varianceReason: ['SAMPLE_VARIANCE_REASON_B', 'SAMPLE_VARIANCE_REASON_A'],
    });

    expect(sets.varianceReason.map((option) => option.value)).toEqual([
      'SAMPLE_VARIANCE_REASON_B',
      'SAMPLE_VARIANCE_REASON_A',
    ]);
  });

  it('지금의 자리표시로는 선택지가 하나도 만들어지지 않는다', () => {
    const sets = toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES);

    expect(sets.countType).toEqual([]);
    expect(sets.varianceReason).toEqual([]);
  });
});

describe('isCountTypeListPending — 개시가 통째로 막히는가', () => {
  /* **M23 · 승인 G1** — 지금은 고를 값이 없어 개시가 열리지 않는다. */
  it('지금의 자리표시로는 개시가 막힌다', () => {
    expect(isCountTypeListPending(toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES))).toBe(true);
  });

  /** **M19** — 배열이 차는 순간 막힘이 풀린다. 고칠 자리가 `code-options.ts` 하나라는 약속이다. */
  it('실사 유형이 차면 막힘이 풀린다', () => {
    expect(
      isCountTypeListPending(
        toCodeOptionSets({ countType: ['SAMPLE_COUNT_TYPE_A'], varianceReason: [] }),
      ),
    ).toBe(false);
  });

  /*
   * **필수도로 갈라 적용한다**(승인 G1). 차이 사유는 **조건부 필수**라 잠기는 범위가 다르고
   * (차이가 있는 위치만 · PR ③) — 둘을 한 판정에 묶으면 차이가 없는 위치의 저장까지 개시와
   * 함께 막힌다.
   */
  it('차이 사유만 차 있으면 개시는 여전히 막힌다', () => {
    expect(
      isCountTypeListPending(
        toCodeOptionSets({
          countType: [],
          varianceReason: ['SAMPLE_VARIANCE_REASON_A'],
        }),
      ),
    ).toBe(true);
  });
});

describe('isVarianceReasonListPending — 차이 사유를 고를 수 있는가', () => {
  /* **M40 · 승인 G1** — 지금은 고를 값이 없다. 막히는 범위는 차이가 있는 위치뿐이다. */
  it('지금의 자리표시로는 고를 값이 없다', () => {
    expect(isVarianceReasonListPending(toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES))).toBe(true);
  });

  it('차이 사유가 차면 고를 수 있다', () => {
    expect(
      isVarianceReasonListPending(
        toCodeOptionSets({ countType: [], varianceReason: ['SAMPLE_VARIANCE_REASON_A'] }),
      ),
    ).toBe(false);
  });

  /**
   * **두 판정이 서로 갈린다.** 묶으면 실사 유형이 확정되지 않은 동안 차이 없는 위치의 저장까지
   * 막히고, 반대로 차이 사유만 확정되면 개시가 열리는 것처럼 보인다 — 필수도가 다르다는 사실이
   * 판정 함수의 개수로 드러나야 한다.
   */
  it('실사 유형만 차 있으면 차이 사유는 여전히 비어 있다', () => {
    const sets = toCodeOptionSets({
      countType: ['SAMPLE_COUNT_TYPE_A'],
      varianceReason: [],
    });

    expect(isCountTypeListPending(sets)).toBe(false);
    expect(isVarianceReasonListPending(sets)).toBe(true);
  });
});

describe('codePlaceholder', () => {
  /* 선택지가 왜 비었는지 밝히던 안내(`pendingCode.note`)는 걷었다(사용자 지시 2026-11-18). */
  it('고를 값이 없으면 「선택지 준비 중」을 낸다', () => {
    expect(codePlaceholder('실사 유형', [])).toBe(messages.pendingCode.placeholder);
  });

  it('고를 값이 있으면 「~을/를 선택하세요」를 낸다', () => {
    expect(codePlaceholder('실사 유형', [{ value: 'A', label: 'A' }])).toBe(
      '실사 유형을 선택하세요',
    );
  });
});

describe('toCodeOptionSets — 서버 이름', () => {
  it('서버가 준 이름이 있으면 라벨로 쓰고, 값은 코드 그대로 둔다', () => {
    const sets = toCodeOptionSets(
      { countType: ['SAMPLE_COUNT_TYPE_A', 'SAMPLE_COUNT_TYPE_B'], varianceReason: [] },
      {
        countType: new Map([['SAMPLE_COUNT_TYPE_A', '합성 유형 가']]),
        varianceReason: new Map(),
      },
    );

    expect(sets.countType).toEqual([
      { value: 'SAMPLE_COUNT_TYPE_A', label: '합성 유형 가' },
      { value: 'SAMPLE_COUNT_TYPE_B', label: 'SAMPLE_COUNT_TYPE_B' },
    ]);
  });
});
