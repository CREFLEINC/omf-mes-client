import { describe, expect, it } from 'vitest';

import { MAX_DEPTH, pickBom, walkBomTree, type BomTreeLookup } from './bom-tree';
import type { Bom, ErpBomComponent } from './types';

/** 지어낸 합성값만 쓴다. */
const bom = (bomId: number, parentItemId: number, isDefault = true): Bom => ({
  bomId,
  parentItemId,
  bomCode: `SYN-${String(bomId)}`,
  bomVersion: 1,
  statusCode: 'CONFIRMED',
  isDefault,
  effectiveFrom: '2026-10-01',
  effectiveTo: null,
  baseQty: 1,
  baseUomId: 1,
});

const part = (
  bomComponentId: number,
  componentItemId: number,
  sequenceNo: number,
): ErpBomComponent => ({
  bomComponentId,
  bomId: 0,
  componentItemId,
  routingOperationId: null,
  actualUseProcessId: null,
  requiredQty: 1,
  uomId: 1,
  scrapRate: 0,
  isMandatory: true,
  lotTraceRequired: false,
  backflushAllowed: false,
  sequenceNo,
});

/**
 * 합성 트리 — 1(뿌리, BOM 10) → [2(BOM 20) → [4, 5], 3]. 품목 4·5·3 은 하위 BOM 이 없다.
 *
 *   1
 *   ├ 2
 *   │ ├ 4
 *   │ └ 5
 *   └ 3
 */
const BOMS: Record<number, Bom[]> = { 2: [bom(20, 2)], 3: [], 4: [], 5: [] };
const COMPONENTS: Record<number, ErpBomComponent[]> = {
  10: [part(103, 3, 2), part(102, 2, 1)],
  20: [part(204, 4, 1), part(205, 5, 2)],
};

const lookup: BomTreeLookup = {
  boms: (itemId) => BOMS[itemId] ?? 'pending',
  components: (bomId) => COMPONENTS[bomId] ?? 'pending',
};

const ROOT = { itemId: 1, bomId: 10 };

describe('walkBomTree', () => {
  it('순번대로 깊이 우선으로 펴고, 줄마다 연결선(윗 단계 세로선 · 마지막 형제)을 매긴다', () => {
    const { rows } = walkBomTree(ROOT, lookup, new Set());

    expect(rows.map((row) => [row.itemId, row.depth, row.rails, row.isLast, row.state])).toEqual([
      [1, 0, [], true, 'expanded'],
      [2, 1, [], false, 'expanded'],
      [4, 2, [true], false, 'leaf'],
      [5, 2, [true], true, 'leaf'],
      [3, 1, [], true, 'leaf'],
    ]);
  });

  it('마지막 형제 아래에서는 그 단계의 세로선이 끊긴다', () => {
    const lastHasChildren: BomTreeLookup = {
      boms: (itemId) => (itemId === 3 ? [bom(30, 3)] : lookup.boms(itemId)),
      components: (bomId) => (bomId === 30 ? [part(306, 6, 1)] : lookup.components(bomId)),
    };

    const { rows } = walkBomTree(ROOT, lastHasChildren, new Set());
    const six = rows.find((row) => row.itemId === 6);

    expect(six?.rails).toEqual([false]);
    expect(six?.isLast).toBe(true);
  });

  it('접은 줄 아래는 펴지 않고 부르지도 않는다', () => {
    const walk = walkBomTree(ROOT, lookup, new Set(['1/102']));

    expect(walk.rows.map((row) => row.itemId)).toEqual([1, 2, 3]);
    expect(walk.rows[1]?.state).toBe('collapsed');
    expect(walk.bomIds).not.toContain(20);
  });

  it('모르는 것은 「불러오는 중」으로 두고 불러야 할 품목 · BOM 을 함께 낸다', () => {
    const walk = walkBomTree(
      ROOT,
      { boms: () => 'pending', components: lookup.components },
      new Set(),
    );

    expect(walk.rows.slice(1).map((row) => row.state)).toEqual(['loading', 'loading']);
    expect(walk.itemIds).toEqual([2, 3]);
    expect(walk.bomIds).toEqual([10]);
  });

  it('하위 구성을 받지 못하면 그 줄을 「실패」로 둔다', () => {
    const { rows } = walkBomTree(ROOT, { ...lookup, components: () => 'error' }, new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('failed');
  });

  it('위 단계의 품목을 다시 만나면 더 내려가지 않는다', () => {
    const cyclic: BomTreeLookup = {
      boms: (itemId) => (itemId === 4 ? [bom(40, 4)] : lookup.boms(itemId)),
      components: (bomId) => (bomId === 40 ? [part(401, 1, 1)] : lookup.components(bomId)),
    };

    const { rows } = walkBomTree(ROOT, cyclic, new Set());

    expect(rows.find((row) => row.key === '1/102/204/401')?.state).toBe('cycle');
  });

  it(`${String(MAX_DEPTH)}단계보다 깊이 내려가지 않는다`, () => {
    /* 품목 n 의 BOM 이 품목 n+1 하나를 갖는 끝없는 사슬. */
    const chain: BomTreeLookup = {
      boms: (itemId) => [bom(itemId * 10, itemId)],
      components: (bomId) => [part(bomId + 1, bomId / 10 + 1, 1)],
    };

    const { rows } = walkBomTree(ROOT, chain, new Set());

    expect(rows).toHaveLength(MAX_DEPTH + 1);
    expect(rows.at(-1)?.state).toBe('collapsed');
  });
});

describe('pickBom', () => {
  it('기본 BOM 을, 없으면 첫 BOM 을 고른다', () => {
    expect(pickBom([bom(1, 9, false), bom(2, 9, true)])?.bomId).toBe(2);
    expect(pickBom([bom(1, 9, false), bom(2, 9, false)])?.bomId).toBe(1);
    expect(pickBom([])).toBeUndefined();
  });
});
