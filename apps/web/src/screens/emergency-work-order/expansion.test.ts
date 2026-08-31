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
/**
 * 꺼 둔 조회. 받는 중도 아니고 실패도 아닌데 값이 없다 — 조회 라이브러리가 이렇게 보고한다.
 * 「아직 안 받았다」를 「없다」로 읽지 않는지 확인하는 데 쓴다.
 */
const notFetched = <TValue>(): LoadState<TValue> => ({
  isLoading: false,
  isError: false,
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
  isDefault: true,
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
  isOutsourced: false,
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
    expect(state.operations.map((item) => item.routingOperationId)).toEqual([901]);
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

  describe('아직 안 받은 것을 「없다」로 말하지 않는다', () => {
    it.each([
      ['BOM', { boms: notFetched<Bom[]>() }],
      ['Routing', { routings: notFetched<Routing[]>() }],
    ])('⛔ %s 조회가 아직 답을 주지 않았으면 「없음」이 아니다', (_name, overrides) => {
      expect(resolveExpansion(input(overrides)).kind).toBe('loading');
    });

    it('⛔ 공정 조회가 아직 답을 주지 않았으면 「공정 없음」이 아니다', () => {
      expect(resolveExpansion(input({ operations: notFetched() })).kind).toBe('loading');
    });

    it('빈 응답은 「없음」이 맞다 — 「빈 목록」과 「목록 없음」을 가른다', () => {
      expect(resolveExpansion(input({ boms: loaded([]) }))).toEqual({
        kind: 'blocked',
        reason: 'bomMissing',
      });
    });
  });

  describe('앞에서 남은 것을 쓰지 않는다', () => {
    it('⛔ 다른 품목의 BOM·Routing 을 걸러 낸다 — 고른 적 없는 품목으로 발행된다', () => {
      const state = resolveExpansion(
        input({
          boms: loaded([bom({ parentItemId: 9999 })]),
          routings: loaded([routing({ itemId: 9999 })]),
        }),
      );

      expect(state).toEqual({ kind: 'blocked', reason: 'bothMissing' });
    });

    it('⛔ 고른 개정의 공정만 남긴다 — 새 개정을 보이면서 옛 공정으로 발행한다', () => {
      const state = resolveExpansion(
        input({
          routings: loaded([routing({ routingId: 31 }), routing({ routingId: 32 })]),
          selectedRoutingId: 32,
          operations: loaded([operation({ routingId: 31, routingOperationId: 901 })]),
        }),
      );

      expect(state).toEqual({ kind: 'blocked', reason: 'operationsMissing' });
      expect(issueRoutingOperationId(state)).toBeNull();
    });

    it('⛔ 발행에 실리는 공정은 «고른 개정»의 것이다', () => {
      const state = resolveExpansion(
        input({
          routings: loaded([routing({ routingId: 31 }), routing({ routingId: 32 })]),
          selectedRoutingId: 32,
          operations: loaded([
            operation({ routingId: 31, routingOperationId: 901, operationSeq: 10 }),
            operation({ routingId: 32, routingOperationId: 911, operationSeq: 20 }),
          ]),
        }),
      );

      expect(issueRoutingOperationId(state)).toBe(911);
    });
  });

  describe('공정의 상태가 앞 단계를 덮지 않는다', () => {
    it('⛔ 앞 개정에서 남은 공정 조회 실패가 「BOM 없음」을 덮지 않는다', () => {
      const state = resolveExpansion(input({ boms: loaded([]), operations: failed() }));

      expect(state).toEqual({ kind: 'blocked', reason: 'bomMissing' });
    });

    it('⛔ 남은 공정 조회 실패가 「개정을 고르라」를 덮지 않는다', () => {
      const state = resolveExpansion(input({ selectedRoutingId: null, operations: failed() }));

      expect(state.kind).toBe('needsRevision');
    });

    it('개정을 고른 뒤의 공정 조회 실패는 그대로 실패다', () => {
      expect(resolveExpansion(input({ operations: failed() })).kind).toBe('error');
    });

    it.each([
      ['받는 중', loading<RoutingOperation[]>()],
      ['아직 안 받음', notFetched<RoutingOperation[]>()],
    ])(
      '⛔ 개정을 고르기 전의 공정 조회(%s)가 「개정을 고르라」를 덮지 않는다 — 고를 자리가 사라진다',
      (_name, operations) => {
        const state = resolveExpansion(input({ selectedRoutingId: null, operations }));

        expect(state.kind).toBe('needsRevision');
      },
    );
  });

  describe('개정 고르기', () => {
    it('고르지 않았으면 고르라고 한다 — 개정이 하나뿐이어도', () => {
      const state = resolveExpansion(input({ selectedRoutingId: null }));

      expect(state.kind).toBe('needsRevision');
      if (state.kind !== 'needsRevision') return;
      expect(state.routings.map((item) => item.routingId)).toEqual([31]);
    });

    it('⛔ 목록에 없는 개정을 고른 상태는 고르지 않은 것으로 본다', () => {
      expect(resolveExpansion(input({ selectedRoutingId: 999 })).kind).toBe('needsRevision');
    });

    it('개정이 여럿이면 전부 내준다 — 화면이 최신을 골라 주지 않는다', () => {
      /* 계약은 개정을 «내림차순»으로 준다 — 응답 모양을 그대로 흉내 낸다. */
      const routings = [routing({ routingId: 32, routingVersion: 3 }), routing()];
      const state = resolveExpansion(
        input({ routings: loaded(routings), selectedRoutingId: null }),
      );

      expect(state.kind).toBe('needsRevision');
      if (state.kind !== 'needsRevision') return;
      expect(state.routings.map((item) => item.routingId)).toEqual([32, 31]);
    });

    it('고른 개정이 그대로 실린다 — 여럿 중 뒤엣것을 골라도', () => {
      const state = resolveExpansion(
        input({
          routings: loaded([routing({ routingId: 32, routingVersion: 3 }), routing()]),
          selectedRoutingId: 31,
        }),
      );

      expect(state.kind).toBe('ready');
      if (state.kind !== 'ready') return;
      expect(state.routing.routingId).toBe(31);
      expect(state.routing.routingVersion).toBe(2);
    });

    it('⛔ 폐기·작성중 개정을 목록에서 지우지 않는다 — 상태 해석은 화면의 일이 아니다', () => {
      const state = resolveExpansion(
        input({
          routings: loaded([routing({ statusCode: 'SYN_OBSOLETE' })]),
          selectedRoutingId: null,
        }),
      );

      expect(state.kind).toBe('needsRevision');
      if (state.kind !== 'needsRevision') return;
      expect(state.routings[0]?.statusCode).toBe('SYN_OBSOLETE');
    });

    /*
     * 고른 것까지 그대로 통과시킨다. 목록에만 남기고 고르면 막으면 **고를 수 있는데 골라도
     * 안 되는** 자리가 된다 — 사용자는 왜 안 되는지 알 수 없다. 폐기된 개정으로 발행하는 것이
     * 옳은지는 화면이 정할 일이 아니라 설계가 정할 일이고, 그동안 화면은 값을 해석하지 않는다.
     */
    it('⛔ 폐기 개정을 «골랐을 때»도 화면이 대신 막지 않는다 — 상태 해석은 화면의 일이 아니다', () => {
      const state = resolveExpansion(
        input({ routings: loaded([routing({ statusCode: 'SYN_OBSOLETE' })]) }),
      );

      expect(state.kind).toBe('ready');
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

    it.each([
      ['고르기 전', { itemId: null }],
      ['BOM 없음', { boms: loaded<Bom[]>([]) }],
      ['개정 미선택', { selectedRoutingId: null }],
      ['받는 중', { boms: loading<Bom[]>() }],
      ['조회 실패', { boms: failed<Bom[]>() }],
      ['아직 안 받음', { boms: notFetched<Bom[]>() }],
    ])('⛔ 준비되지 않은 상태(%s)에서는 실을 공정이 없다', (_name, overrides) => {
      expect(issueRoutingOperationId(resolveExpansion(input(overrides)))).toBeNull();
    });
  });
});
