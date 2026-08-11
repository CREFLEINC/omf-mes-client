import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  isCountTypeListPending,
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
    expect(PLACEHOLDER_STOCKTAKING_CODES.status).toEqual([]);
    expect(PLACEHOLDER_STOCKTAKING_CODES.varianceReason).toEqual([]);
  });

  it('계약의 예시 값을 심지 않는다', () => {
    const all = [
      ...PLACEHOLDER_STOCKTAKING_CODES.countType,
      ...PLACEHOLDER_STOCKTAKING_CODES.status,
      ...PLACEHOLDER_STOCKTAKING_CODES.varianceReason,
    ];

    for (const example of CONTRACT_EXAMPLES) expect(all).not.toContain(example);
  });
});

describe('toCodeOptionSets', () => {
  it('값 목록을 선택지로 옮긴다', () => {
    const sets = toCodeOptionSets({
      countType: ['SAMPLE_COUNT_TYPE_A'],
      status: [],
      varianceReason: ['SAMPLE_VARIANCE_REASON_A', 'SAMPLE_VARIANCE_REASON_B'],
    });

    expect(sets.countType).toEqual([
      { value: 'SAMPLE_COUNT_TYPE_A', label: 'SAMPLE_COUNT_TYPE_A' },
    ]);
    expect(sets.status).toEqual([]);
    expect(sets.varianceReason).toHaveLength(2);
  });

  /*
   * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
   * 아직 없는데 화면이 「순환 실사」 같은 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
   */
  it('코드값을 그대로 라벨로 쓴다', () => {
    const [option] = toCodeOptionSets({
      countType: ['SAMPLE_COUNT_TYPE_A'],
      status: [],
      varianceReason: [],
    }).countType;

    expect(option?.label).toBe(option?.value);
  });

  /** **차례를 바꾸지 않는다** — 값 목록이 오는 차례가 뜻일 수 있다(자주 쓰는 것부터 등). */
  it('값의 차례를 바꾸지 않는다', () => {
    const sets = toCodeOptionSets({
      countType: [],
      status: ['SAMPLE_COUNT_STATUS_B', 'SAMPLE_COUNT_STATUS_A'],
      varianceReason: [],
    });

    expect(sets.status.map((option) => option.value)).toEqual([
      'SAMPLE_COUNT_STATUS_B',
      'SAMPLE_COUNT_STATUS_A',
    ]);
  });

  it('지금의 자리표시로는 선택지가 하나도 만들어지지 않는다', () => {
    const sets = toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES);

    expect(sets.countType).toEqual([]);
    expect(sets.status).toEqual([]);
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
        toCodeOptionSets({ countType: ['SAMPLE_COUNT_TYPE_A'], status: [], varianceReason: [] }),
      ),
    ).toBe(false);
  });

  /*
   * **필수도로 갈라 적용한다**(승인 G1). 차이 사유는 **조건부 필수**라 잠기는 범위가 다르고
   * (차이가 있는 위치만 · PR ③), 상태 코드는 조회 조건이라 아무것도 막지 않는다 —
   * 셋을 한 판정에 묶으면 차이가 없는 위치의 저장까지 개시와 함께 막힌다.
   */
  it('다른 둘만 차 있으면 개시는 여전히 막힌다', () => {
    expect(
      isCountTypeListPending(
        toCodeOptionSets({
          countType: [],
          status: ['SAMPLE_COUNT_STATUS_A'],
          varianceReason: ['SAMPLE_VARIANCE_REASON_A'],
        }),
      ),
    ).toBe(true);
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  /** **차면 거둔다** — 남으면 고를 수 있는데도 준비 중이라고 말하는 거짓말이 된다. */
  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote([{ value: 'SAMPLE_COUNT_TYPE_A', label: 'SAMPLE_COUNT_TYPE_A' }])).toBeUndefined();
  });
});
