import { describe, expect, it } from 'vitest';

import {
  type ExpansionInput,
  type LoadState,
  issueRoutingOperationId,
  resolveExpansion,
} from './expansion';
import type { Bom, Routing, RoutingOperation } from './types';

const loaded = <TValue>(value: TValue): LoadState<TValue> => ({
  isLoading: false,
  isError: false,
  value,
});
const loading = <TValue>(): LoadState<TValue> => ({
  isLoading: true,
  isError: false,
  value: undefined,
});
const failed = <TValue>(): LoadState<TValue> => ({
  isLoading: false,
  isError: true,
  value: undefined,
});

const bom = (overrides: Partial<Bom> = {}): Bom => ({
  bomId: 71,
  parentItemId: 5001,
  bomCode: 'SYN-BOM-0001',
  bomVersion: 3,
  statusCode: 'SYN_ACTIVE',
  isDefault: true,
  effectiveFrom: '2026-01-01',
  baseQty: 1,
  baseUomId: 11,
  ...overrides,
});

const routing = (overrides: Partial<Routing> = {}): Routing => ({
  routingId: 31,
  itemId: 5001,
  routingCode: 'SYN-RT-0001',
  routingVersion: 2,
  statusCode: 'SYN_ACTIVE',
  ...overrides,
});

const operation = (overrides: Partial<RoutingOperation> = {}): RoutingOperation => ({
  routingOperationId: 901,
  routingId: 31,
  operationSeq: 10,
  processId: 41,
  operationName: '사출',
  mesManaged: true,
  materialInputManaged: true,
  productionResultManaged: true,
  inspectionManaged: false,
  outputLotRequired: true,
  equipmentRequired: false,
  moldRequired: false,
  ...overrides,
});

const input = (overrides: Partial<ExpansionInput> = {}): ExpansionInput => ({
  itemId: 5001,
  boms: loaded([bom()]),
  routings: loaded([routing()]),
  selectedRoutingId: 31,
  operations: loaded([operation()]),
  ...overrides,
});

describe('resolveExpansion', () => {
  it('품목을 고르기 전에는 아무것도 판정하지 않는다', () => {
    expect(resolveExpansion(input({ itemId: null }))).toEqual({ kind: 'idle' });
  });

  it('전부 갖춰지면 준비됨이 된다', () => {
    const state = resolveExpansion(input());

    expect(state.kind).toBe('ready');
    if (state.kind !== 'ready') return;
    expect(state.bom.bomCode).toBe('SYN-BOM-0001');
    expect(state.routing.routingId).toBe(31);
    expect(state.operations).toHaveLength(1);
  });

  describe('막는 자리', () => {
    it('BOM 이 없으면 막고 BOM 이라고 말한다', () => {
      const state = resolveExpansion(input({ boms: loaded([]) }));
      expect(state).toEqual({ kind: 'blocked', reason: 'bomMissing' });
    });

    it('Routing 이 없으면 막고 Routing 이라고 말한다', () => {
      const state = resolveExpansion(input({ routings: loaded([]), selectedRoutingId: null }));
      expect(state).toEqual({ kind: 'blocked', reason: 'routingMissing' });
    });

    it('⛔ 둘 다 없으면 둘 다 말한다 — 하나만 고치고 다시 막히지 않게', () => {
      const state = resolveExpansion(
        input({ boms: loaded([]), routings: loaded([]), selectedRoutingId: null }),
      );
      expect(state).toEqual({ kind: 'blocked', reason: 'bothMissing' });
    });

    it('⛔ 공정이 0줄이면 막는다 — 보낼 공정이 없는 채로 발행이 열린다', () => {
      const state = resolveExpansion(input({ operations: loaded([]) }));
      expect(state).toEqual({ kind: 'blocked', reason: 'operationsMissing' });
      expect(issueRoutingOperationId(state)).toBeNull();
    });
  });

  describe('실패와 없음을 가른다', () => {
    it.each([
      ['BOM', { boms: failed<Bom[]>() }],
      ['Routing', { routings: failed<Routing[]>() }],
      ['공정', { operations: failed<RoutingOperation[]>() }],
    ])('⛔ %s 조회가 실패하면 「없다」가 아니라 「받지 못했다」다', (_name, overrides) => {
      expect(resolveExpansion(input(overrides)).kind).toBe('error');
    });

    it('⛔ 실패를 「없음」보다 먼저 본다 — 없는 문제를 고치러 가게 두지 않는다', () => {
      const state = resolveExpansion(input({ boms: failed(), routings: loaded([]) }));
      expect(state.kind).toBe('error');
    });
  });

  describe('받는 중', () => {
    it.each([
      ['BOM', { boms: loading<Bom[]>() }],
      ['Routing', { routings: loading<Routing[]>() }],
    ])('%s 을 받는 중에는 「없다」로 말하지 않는다', (_name, overrides) => {
      expect(resolveExpansion(input(overrides)).kind).toBe('loading');
    });

    it('공정을 받는 중에도 준비됨이 되지 않는다', () => {
      expect(resolveExpansion(input({ operations: loading() })).kind).toBe('loading');
    });
  });

  describe('개정 고르기', () => {
    it('고르지 않았으면 고르라고 한다 — 개정이 하나뿐이어도', () => {
      const state = resolveExpansion(input({ selectedRoutingId: null }));

      expect(state.kind).toBe('needsRevision');
      if (state.kind !== 'needsRevision') return;
      expect(state.routings).toHaveLength(1);
    });

    it('⛔ 목록에 없는 개정을 고른 상태는 고르지 않은 것으로 본다', () => {
      expect(resolveExpansion(input({ selectedRoutingId: 999 })).kind).toBe('needsRevision');
    });

    it('개정이 여럿이면 전부 내준다 — 화면이 최신을 골라 주지 않는다', () => {
      const routings = [routing(), routing({ routingId: 32, routingVersion: 3 })];
      const state = resolveExpansion(
        input({ routings: loaded(routings), selectedRoutingId: null }),
      );

      expect(state.kind).toBe('needsRevision');
      if (state.kind !== 'needsRevision') return;
      expect(state.routings.map((item) => item.routingId)).toEqual([31, 32]);
    });
  });

  describe('BOM 고르기', () => {
    it('⛔ 서버가 기본으로 표시한 BOM 을 보인다 — 첫 번째가 아니다', () => {
      const boms = [
        bom({ bomId: 70, bomCode: 'SYN-BOM-0000', isDefault: false }),
        bom({ bomId: 71, bomCode: 'SYN-BOM-0001', isDefault: true }),
      ];
      const state = resolveExpansion(input({ boms: loaded(boms) }));

      expect(state.kind).toBe('ready');
      if (state.kind !== 'ready') return;
      expect(state.bom.bomCode).toBe('SYN-BOM-0001');
    });

    it('기본 표시가 없으면 첫 번째를 쓴다', () => {
      const boms = [bom({ bomId: 70, bomCode: 'SYN-BOM-0000', isDefault: false })];
      const state = resolveExpansion(input({ boms: loaded(boms) }));

      expect(state.kind).toBe('ready');
      if (state.kind !== 'ready') return;
      expect(state.bom.bomCode).toBe('SYN-BOM-0000');
    });
  });

  describe('공정 순서', () => {
    it('⛔ 응답 순서에 기대지 않고 순서대로 보인다', () => {
      const operations = [
        operation({ routingOperationId: 903, operationSeq: 30, operationName: '검사' }),
        operation({ routingOperationId: 901, operationSeq: 10, operationName: '사출' }),
        operation({ routingOperationId: 902, operationSeq: 20, operationName: '조립' }),
      ];
      const state = resolveExpansion(input({ operations: loaded(operations) }));

      expect(state.kind).toBe('ready');
      if (state.kind !== 'ready') return;
      expect(state.operations.map((item) => item.operationSeq)).toEqual([10, 20, 30]);
    });

    it('⛔ 발행에는 «가장 앞선» 공정의 줄을 싣는다 — 응답 첫 줄이 아니다', () => {
      const operations = [
        operation({ routingOperationId: 903, operationSeq: 30 }),
        operation({ routingOperationId: 901, operationSeq: 10 }),
      ];
      const state = resolveExpansion(input({ operations: loaded(operations) }));

      expect(issueRoutingOperationId(state)).toBe(901);
    });

    it('준비되지 않은 상태에서는 실을 공정이 없다', () => {
      expect(issueRoutingOperationId(resolveExpansion(input({ itemId: null })))).toBeNull();
      expect(issueRoutingOperationId(resolveExpansion(input({ boms: loaded([]) })))).toBeNull();
    });
  });
});
