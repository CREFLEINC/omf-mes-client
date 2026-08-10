import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';

const t = messages.overReceiptSplit;

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: 'SAMPLE-SUP-01 · 합성 공급사 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

const result = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  ...source(),
  entries: [...source().entries],
  truncated: false,
  refetch: () => undefined,
  ...overrides,
});

describe('toReference — 참조 하나를 표기 상태로 옮긴다', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9101)).toEqual({
      kind: 'named',
      label: 'SAMPLE-SUP-01 · 합성 공급사 가',
    });
  });

  /*
   * **M12의 단위 몫** — 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다(#47).
   * 그때 「목록에 없다」로 판정하면 정상 값에 *값이 잘못됐다*는 표를 붙이는 셈이다.
   */
  it('아직 오지 않은 것을 「목록에 없음」으로 판정하지 않는다', () => {
    expect(toReference(source({ isLoading: true, entries: [] }), 9101)).toEqual({
      kind: 'loading',
    });
  });

  it('불러오기에 실패한 것도 「목록에 없음」과 갈린다', () => {
    expect(toReference(source({ isError: true, entries: [] }), 9101)).toEqual({ kind: 'failed' });
  });

  /* 실패와 미도착이 「목록에 없음」보다 앞선다 — 순서가 뜻을 정한다. */
  it('실패가 미도착보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('목록은 왔는데 그 안에 없으면 알 수 없는 값이다', () => {
    expect(toReference(source(), 9999)).toEqual({ kind: 'unknown' });
  });

  it('가리키는 번호가 없어도 알 수 없는 값이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
  });

  /*
   * **M13의 단위 몫** — 어느 갈래에도 번호를 담지 않는다(#44).
   * 담을 자리가 없으면 그 값이 화면으로 샐 경로도 없다.
   */
  it('어느 갈래에도 내부 번호를 담지 않는다', () => {
    const states = [
      toReference(source(), 9101),
      toReference(source(), 9999),
      toReference(source({ isLoading: true }), 9999),
      toReference(source({ isError: true }), 9999),
    ];

    for (const state of states) {
      expect(JSON.stringify(state)).not.toContain('9999');
    }

    // 짝 방향 — 풀리는 갈래는 실제로 이름을 담는다(아무것도 안 담아도 통과하지 않게 한다).
    expect(states[0]).toEqual({ kind: 'named', label: 'SAMPLE-SUP-01 · 합성 공급사 가' });
  });
});

describe('describeReference — 네 갈래의 문구가 서로 다르다', () => {
  it('갈래마다 다른 문구를 낸다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '합성 공급사 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      '합성 공급사 가',
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('lookupNote — 선택지의 한계를 밝힌다', () => {
  it('정상이면 붙일 안내가 없다', () => {
    expect(lookupNote(result())).toBeUndefined();
  });

  it('잘렸으면 일부만 보인다고 밝힌다', () => {
    expect(lookupNote(result({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  /*
   * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께 참이 된다.
   * 그때 「일부만 보인다」고만 말하면 지금 목록이 **낡았다는 사실**이 가려진다.
   */
  it('실패와 잘림이 겹치면 실패를 밝힌다', () => {
    expect(lookupNote(result({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});
