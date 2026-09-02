import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeAvailableQty,
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
} from './lookups';

const t = messages.shipmentRequestCreate;

const source = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8201', label: '합성 고객 가', isActive: true }],
  isError: false,
  isLoading: false,
  ...overrides,
});

describe('toReference', () => {
  it('목록에 있으면 이름으로 푼다', () => {
    expect(toReference(source(), 8201)).toEqual({ kind: 'named', label: '합성 고객 가' });
  });

  it('목록에 없으면 알 수 없음이다', () => {
    expect(toReference(source(), 8202)).toEqual({ kind: 'unknown' });
  });

  it('목록이 아직 오지 않았으면 로딩이다', () => {
    expect(toReference(source({ entries: [], isLoading: true }), 8201)).toEqual({
      kind: 'loading',
    });
  });

  it('조회가 실패했으면 실패다', () => {
    expect(toReference(source({ entries: [], isError: true }), 8201)).toEqual({ kind: 'failed' });
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

    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('describeAvailableQty', () => {
  it('갈래마다 서로 다른 문구를 낸다', () => {
    const texts = [
      describeAvailableQty({ kind: 'unasked' }),
      describeAvailableQty({ kind: 'loading' }),
      describeAvailableQty({ kind: 'failed' }),
      describeAvailableQty({ kind: 'qty', value: 60 }),
    ];

    expect(new Set(texts).size).toBe(texts.length);
    expect(texts[3]).toBe('60');
  });
});
