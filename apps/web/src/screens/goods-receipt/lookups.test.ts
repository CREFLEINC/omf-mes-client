import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';
import type { LookupEntry } from './types';

const t = messages.goodsReceipt;

const entries: LookupEntry[] = [
  { value: '9101', label: 'SAMPLE-SUP-01 · 합성 공급사 가', isActive: true },
];

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
  refetch: () => {
    /* 이 테스트는 부르지 않는다 — 복구 경로는 화면 수준이 검사한다. */
  },
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름을 낸다', () => {
    expect(toReference(source(), 9101)).toEqual({
      kind: 'named',
      label: 'SAMPLE-SUP-01 · 합성 공급사 가',
    });
  });

  /*
   * **M10 · #47** — 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다.
   * 미도착을 「목록에 없음」으로 판정하면 정상 값에 *값이 잘못됐다*는 표를 붙이는 셈이다.
   */
  it('아직 오지 않았으면 목록에 없음으로 판정하지 않는다', () => {
    expect(toReference(source({ isLoading: true }), 9101)).toEqual({ kind: 'loading' });
    expect(toReference(source({ entries: [], isLoading: true }), 9101)).toEqual({ kind: 'loading' });
  });

  /**
   * **잘림을 네 갈래에 섞지 않는다.**
   *
   * 잘린 것은 「고를 수 없는 값이 생겼다」이지 「받은 이름을 믿을 수 없다」가 아니다.
   * 「잘렸으니 확신할 수 없다 → 알 수 없음」으로 접으면 **정상 값에 *값이 잘못됐다*는 표를
   * 붙이는 것**이라, 이 화면이 막으려는 #47을 잘림 쪽에서 되살린다.
   * 잘렸다는 사실은 구획의 안내가 따로 밝힌다.
   */
  it('목록이 잘려도 그 안에 있는 값은 이름으로 낸다', () => {
    expect(toReference(source({ truncated: true }), 9101)).toEqual({
      kind: 'named',
      label: 'SAMPLE-SUP-01 · 합성 공급사 가',
    });
  });

  /* 짝 방향 — 잘린 목록에 **없는** 값은 그대로 「목록에 없음」이다. */
  it('잘린 목록에 없는 값은 목록에 없음이다', () => {
    expect(toReference(source({ truncated: true }), 9999)).toEqual({ kind: 'unknown' });
  });

  /* 실패가 미도착보다 앞선다 — 둘이 함께 참인 순간이 있고, 사용자가 할 조치가 다르다. */
  it('실패가 미도착보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('목록은 왔는데 그 안에 없으면 목록에 없음이다', () => {
    expect(toReference(source(), 9199)).toEqual({ kind: 'unknown' });
  });

  it('가리키는 값이 없으면 목록에 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /*
   * **M11 · #44** — 어느 갈래에도 번호를 담지 않는다. 담을 자리가 없으면 화면으로 샐 경로도 없다.
   * 짝 방향으로 「이름은 담긴다」를 함께 단언해 아무것도 안 담아도 통과하지 않게 한다.
   */
  it('어느 갈래에도 번호를 담지 않는다', () => {
    const states = [
      toReference(source(), 9101),
      toReference(source(), 9199),
      toReference(source({ isLoading: true }), 9101),
      toReference(source({ isError: true }), 9101),
    ];

    for (const state of states) {
      expect(JSON.stringify(state)).not.toContain('9101');
      expect(JSON.stringify(state)).not.toContain('9199');
    }

    expect(states[0]).toEqual({ kind: 'named', label: 'SAMPLE-SUP-01 · 합성 공급사 가' });
  });
});

describe('describeReference', () => {
  /* 네 갈래의 문구가 서로 달라야 뜻이 구분된다. */
  it('네 갈래의 문구가 서로 다르다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '이름' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(new Set(texts).size).toBe(4);
  });

  it('갈래마다 정해진 문구를 낸다', () => {
    expect(describeReference({ kind: 'named', label: '이름' })).toBe('이름');
    expect(describeReference({ kind: 'unknown' })).toBe(t.values.unknown);
    expect(describeReference({ kind: 'loading' })).toBe(t.values.referenceLoading);
    expect(describeReference({ kind: 'failed' })).toBe(t.values.referenceFailed);
  });
});

describe('lookupNote', () => {
  it('정상이면 안내가 없다', () => {
    expect(lookupNote(lookup())).toBeUndefined();
  });

  /*
   * 잘림을 밝히지 않으면 사용자가 **불완전한 목록을 완전한 것으로 읽고**
   * 찾는 값이 없으면 「그런 공급사가 없다」로 결론짓는다.
   */
  it('잘렸으면 잘림 안내를 낸다', () => {
    expect(lookupNote(lookup({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  /*
   * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면
   * 낡은 자료(`truncated`)와 실패(`isError`)가 함께 참이 된다.
   */
  it('실패가 잘림보다 앞선다', () => {
    expect(lookupNote(lookup({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});
