import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  businessUnitInScope,
  describeAvailableQty,
  describeReference,
  lookupNote,
  toReference,
  type LookupResult,
  type ReferenceSource,
  warehouseSelectable,
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

/* ── 피처 012 — 사업부·출고 창고 선택지(계정 데이터 범위) ─────────────────── */

describe('businessUnitInScope — 사업부 선택지(FR-002)', () => {
  it('US1-1 범위에 사업부가 하나면 그 사업부만 고를 수 있다(화면이 자동으로 채운다)', () => {
    const scopes = [{ businessUnitId: 7001 }];

    expect(businessUnitInScope(7001, scopes)).toBe(true);
    expect(businessUnitInScope(7002, scopes)).toBe(false);
  });

  it('Edge-scope 범위가 없는 계정은 모든 사업부를 고를 수 있다', () => {
    expect(businessUnitInScope(7001, [])).toBe(true);
    expect(businessUnitInScope(7002, [])).toBe(true);
  });

  it('Edge-scope 공장만 지정한 범위 줄은 그 공장의 사업부를 고를 수 있다', () => {
    expect(businessUnitInScope(7001, [{ businessUnitId: 7001, plantId: 7102 }])).toBe(true);
    expect(businessUnitInScope(7002, [{ businessUnitId: 7001, plantId: 7102 }])).toBe(false);
  });
});

describe('warehouseSelectable — 출고 창고 선택지(FR-003)', () => {
  const warehouse = (patch: Partial<{ businessUnitId: number; plantId: number; isActive: boolean; isDefect: boolean }> = {}) => ({
    businessUnitId: 7001,
    plantId: 7101,
    isActive: true,
    isDefect: false,
    ...patch,
  });

  it('US1-3 고른 사업부의 활성 창고만 — 불량창고·비활성·다른 사업부는 없다', () => {
    expect(warehouseSelectable(warehouse(), 7001, [])).toBe(true);
    expect(warehouseSelectable(warehouse({ isDefect: true }), 7001, [])).toBe(false);
    expect(warehouseSelectable(warehouse({ isActive: false }), 7001, [])).toBe(false);
    expect(warehouseSelectable(warehouse({ businessUnitId: 7002 }), 7001, [])).toBe(false);
  });

  it('US1-3 사업부를 통째로 가진 범위면 그 사업부 창고 모두', () => {
    const scopes = [{ businessUnitId: 7001 }];

    expect(warehouseSelectable(warehouse({ plantId: 7101 }), 7001, scopes)).toBe(true);
    expect(warehouseSelectable(warehouse({ plantId: 7102 }), 7001, scopes)).toBe(true);
  });

  it('Edge-scope 공장 줄만 있는 범위는 그 공장 창고로 좁힌다', () => {
    const scopes = [{ businessUnitId: 7001, plantId: 7102 }];

    expect(warehouseSelectable(warehouse({ plantId: 7102 }), 7001, scopes)).toBe(true);
    expect(warehouseSelectable(warehouse({ plantId: 7101 }), 7001, scopes)).toBe(false);
  });
});
