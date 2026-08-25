import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';

const t = messages.shipmentSchedule;

/**
 * 참조 값 표기의 **세 갈래 판정**. 하나로 뭉개지면 본 자료가 참조 목록보다 먼저 도착하는 순간
 * 정상 값이 「알 수 없음」으로 보이고, 그 문구는 *값이 잘못됐다*는 뜻이라 사용자에게 반대로 읽힌다.
 */

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '9101', label: '합성 고객 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 9101)).toEqual({ kind: 'named', label: '합성 고객 가' });
  });

  /* 목록은 왔는데 그 안에 없다 — 값이 잘못됐다는 신호다. */
  it('목록에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 9102)).toEqual({ kind: 'unknown' });
  });

  /* 아직 오지 않았다. 「알 수 없음」으로 쓰면 정상 값이 잘못된 값으로 읽힌다. */
  it('목록이 아직 오지 않았으면 로딩이다 — 알 수 없음이 아니다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), 9101)).toEqual({
      kind: 'loading',
    });
  });

  /* 실패는 「값이 없다」와 다르다 — 사용자가 할 조치(다시 시도)가 갈린다. */
  it('목록 조회가 실패했으면 실패다', () => {
    expect(toReference(source({ entries: [], isError: true }), 9101)).toEqual({ kind: 'failed' });
  });

  /* 실패한 채로 재조회 중일 수 있다. 그때도 실패가 앞선다 — 사유를 감추면 안 된다. */
  it('실패와 로딩이 겹치면 실패가 앞선다', () => {
    expect(toReference(source({ isError: true, isLoading: true }), 9101)).toEqual({
      kind: 'failed',
    });
  });

  it('가리키는 번호가 없으면 알 수 없음이다', () => {
    expect(toReference(source(), null)).toEqual({ kind: 'unknown' });
    expect(toReference(source(), undefined)).toEqual({ kind: 'unknown' });
  });

  it('가리키는 번호가 없어도 실패가 앞선다', () => {
    expect(toReference(source({ entries: [], isError: true }), null)).toEqual({ kind: 'failed' });
  });

  it('가리키는 번호가 없어도 미도착이 앞선다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), null)).toEqual({
      kind: 'loading',
    });
  });

  /* 어느 갈래에서도 번호를 결과에 담지 않는다 — 이름으로 풀 수 없다는 이유로 번호를 내면 안 된다. */
  it.each([
    ['목록에 없음', source(), 9102],
    ['미도착', source({ entries: [], isLoading: true }), 9102],
    ['실패', source({ entries: [], isError: true }), 9102],
  ] as const)('%s일 때도 번호를 결과에 담지 않는다', (_name, given, id) => {
    expect(JSON.stringify(toReference(given, id))).not.toContain('9102');
  });
});

describe('lookupNote', () => {
  const result = (overrides: Partial<LookupResult> = {}): LookupResult => ({
    entries: [],
    truncated: false,
    isError: false,
    isLoading: false,
    refetch: () => undefined,
    ...overrides,
  });

  it('멀쩡하면 안내를 붙이지 않는다', () => {
    expect(lookupNote(result())).toBeUndefined();
  });

  it('목록이 잘렸으면 그 사실을 밝힌다', () => {
    expect(lookupNote(result({ truncated: true }))).toBe(t.filters.lookupTruncated);
  });

  it('조회가 실패했으면 그 사실을 밝힌다', () => {
    expect(lookupNote(result({ isError: true }))).toBe(t.filters.lookupFailed);
  });

  /* 둘이 겹치면 실패가 앞선다 — 「일부만 보인다」고만 말하면 지금 목록이 낡았다는 사실이 가려진다. */
  it('실패와 잘림이 겹치면 실패가 앞선다', () => {
    expect(lookupNote(result({ truncated: true, isError: true }))).toBe(t.filters.lookupFailed);
  });
});

describe('describeReference', () => {
  it('갈래마다 서로 다른 문구를 낸다', () => {
    const texts = [
      describeReference({ kind: 'named', label: '합성 고객 가' }),
      describeReference({ kind: 'unknown' }),
      describeReference({ kind: 'loading' }),
      describeReference({ kind: 'failed' }),
    ];

    expect(texts).toEqual([
      '합성 고객 가',
      t.values.unknown,
      t.values.referenceLoading,
      t.values.referenceFailed,
    ]);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
