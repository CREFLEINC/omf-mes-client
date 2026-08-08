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

const t = messages.stockStatus;

const ENTRIES: LookupEntry[] = [
  { value: '9101', label: 'SAMPLE-WH-01 · 합성 창고 가', isActive: true },
];

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: ENTRIES,
  isError: false,
  isLoading: false,
  ...overrides,
});

const lookup = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  entries: ENTRIES,
  truncated: false,
  isError: false,
  isLoading: false,
  refetch: () => undefined,
  ...overrides,
});

describe('toReference — 참조 하나의 표기 상태', () => {
  it('목록에 있으면 이름을 낸다', () => {
    expect(toReference(source(), 9101)).toEqual({
      kind: 'named',
      label: 'SAMPLE-WH-01 · 합성 창고 가',
    });
  });

  /*
   * **#47이 되살아나는 자리다.** 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있고,
   * 그때 「알 수 없음」을 내면 *값이 잘못됐다*는 뜻이라 정상 값이 반대로 읽힌다.
   */
  it('아직 오지 않았으면 「목록에 없음」이 아니라 미도착이다', () => {
    expect(toReference(source({ isLoading: true, entries: [] }), 9101)).toEqual({
      kind: 'loading',
    });
  });

  it('실패가 미도착보다 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('목록은 왔는데 그 안에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 9199)).toEqual({ kind: 'unknown' });
  });

  /*
   * **`null`을 그냥 넘기지 않는 것은 호출부의 몫이다**(계획 결정 10) — `lotId`·`ownerPartnerId`는
   * `null`이 확정된 뜻을 가지므로 넘기기 전에 갈라낸다. 여기까지 온 `null`은 진짜 「모른다」다.
   */
  it('번호가 없으면 알 수 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  /* **어느 갈래에도 번호를 담지 않는다**(#44). 담을 자리가 없으면 화면으로 샐 경로도 없다. */
  it('어느 갈래에도 내부 번호가 담기지 않는다', () => {
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
  });
});

describe('describeReference — 네 갈래의 문구가 서로 다르다', () => {
  it('갈래마다 다른 문구를 낸다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '합성 창고 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts[0]).toBe('합성 창고 가');
    expect(texts[1]).toBe(t.values.unknown);
    expect(texts[2]).toBe(t.values.referenceLoading);
    expect(texts[3]).toBe(t.values.referenceFailed);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('lookupNote — 선택지의 한계 안내', () => {
  it('정상이면 안내를 내지 않는다', () => {
    expect(lookupNote(lookup())).toBeUndefined();
  });

  it('잘렸으면 밝힌다', () => {
    expect(lookupNote(lookup({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  /*
   * **실패가 잘림보다 앞선다.** 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 둘이 함께
   * 참이 되는데, 그때 「일부만 보인다」고만 말하면 지금 목록이 **낡았다는 사실**이 가려진다.
   */
  it('실패와 잘림이 겹치면 실패가 앞선다', () => {
    expect(lookupNote(lookup({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});
