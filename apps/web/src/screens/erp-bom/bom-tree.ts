import { useQueries, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { erpBomKeys, fetchBomComponents, fetchBomList } from './queries';
import type { Bom, ErpBomComponent } from './types';

/**
 * BOM 하이라키(사용자 지시 2026-10-27 — 「ERP BOM 뷰어처럼 하이라키를 확인할 수 있게」).
 *
 * 서버에 다단 전개 경로가 없다 — 「모품목의 BOM 목록」과 「BOM 하나의 구성품」뿐이다. 그래서 자품목마다 그 품목의
 * **기본 BOM**(없으면 첫 BOM)을 찾아 한 단계씩 내려간다. 펼친 줄의 자품목만 부르고, 접은 줄 아래는 부르지 않는다.
 *
 * 같은 품목이 위 단계에 이미 있으면(순환) 더 내려가지 않는다. 깊이도 `MAX_DEPTH` 에서 멈춘다.
 */

/** 이보다 깊으면 펼치지 않는다 — 자료가 잘못돼 끝없이 내려가는 것을 막는다. */
export const MAX_DEPTH = 20;

/** 트리의 뿌리 — 고른 모품목과 그 BOM. */
export interface BomTreeRoot {
  itemId: number;
  bomId: number;
}

/**
 * 줄 하나의 처지.
 * - `expanded` 하위 구성을 펼쳤다 · `collapsed` 하위 구성이 있는데 접었다 · `leaf` 하위 구성이 없다
 * - `loading` 하위 구성을 찾는 중 · `failed` 찾지 못했다 · `cycle` 위 단계와 같은 품목이라 내려가지 않는다
 * - `depthLimit` 하위 구성이 있지만 깊이 한도(`MAX_DEPTH`)라 펴지 않는다 — 펼치기 단추를 두지 않는다
 */
export type BomTreeNodeState =
  'expanded' | 'collapsed' | 'leaf' | 'loading' | 'failed' | 'cycle' | 'depthLimit';

export interface BomTreeRow {
  /** 뿌리부터의 경로 — 접기 상태의 열쇠이자 줄의 열쇠다. */
  key: string;
  depth: number;
  /**
   * 연결선(사용자 지시 2026-10-27 「하이라키 선도」) — 1단계부터 윗 단계마다 세로선이 이 줄을 지나 아래로 이어지는가
   * (그 단계의 조상에게 뒤에 올 형제가 있는가). 길이는 `depth - 1` 이다. 뿌리와 1단계는 비어 있다.
   */
  rails: readonly boolean[];
  /** 형제 중 마지막인가 — 가지선이 └ 로 끝난다(아니면 ├). 뿌리는 참이다. */
  isLast: boolean;
  itemId: number;
  /** 윗 BOM 에서 본 이 품목의 구성 줄. 뿌리는 없다. */
  component: ErpBomComponent | null;
  state: BomTreeNodeState;
}

type Lookup<T> = T | 'pending' | 'error';

export interface BomTreeLookup {
  boms: (itemId: number) => Lookup<Bom[]>;
  components: (bomId: number) => Lookup<ErpBomComponent[]>;
}

/** 품목의 하위 구성으로 쓸 BOM — 기본 BOM, 없으면 첫 BOM. */
export const pickBom = (boms: readonly Bom[]): Bom | undefined =>
  boms.find((bom) => bom.isDefault) ?? boms[0];

export interface BomTreeWalk {
  rows: BomTreeRow[];
  /** 하위 BOM 을 찾아야 하는 품목. */
  itemIds: number[];
  /** 구성품을 읽어야 하는 BOM. */
  bomIds: number[];
}

/**
 * 지금 아는 것으로 트리를 한 줄씩 편다 — 펼친 줄만 아래로 내려간다. 모르는 것(아직 안 받은 BOM 목록 · 구성품)은
 * `loading` 으로 두고, 불러야 할 것을 함께 낸다. 받는 대로 다시 부르면 한 단계씩 깊어진다.
 */
export const walkBomTree = (
  root: BomTreeRoot,
  lookup: BomTreeLookup,
  collapsed: ReadonlySet<string>,
): BomTreeWalk => {
  const rows: BomTreeRow[] = [];
  const itemIds = new Set<number>();
  const bomIds = new Set<number>();

  const visit = (
    itemId: number,
    component: ErpBomComponent | null,
    knownBomId: number | null,
    depth: number,
    ancestors: readonly number[],
    key: string,
    rails: readonly boolean[],
    isLast: boolean,
  ): void => {
    const row: BomTreeRow = { key, depth, rails, isLast, itemId, component, state: 'leaf' };
    rows.push(row);

    if (ancestors.includes(itemId)) {
      row.state = 'cycle';
      return;
    }

    let bomId = knownBomId;
    if (bomId === null) {
      itemIds.add(itemId);
      const boms = lookup.boms(itemId);
      if (boms === 'pending' || boms === 'error') {
        row.state = boms === 'pending' ? 'loading' : 'failed';
        return;
      }
      const bom = pickBom(boms);
      if (bom === undefined) return;
      bomId = bom.bomId;
    }

    if (depth >= MAX_DEPTH) {
      row.state = 'depthLimit';
      return;
    }
    if (collapsed.has(key)) {
      row.state = 'collapsed';
      return;
    }

    bomIds.add(bomId);
    const children = lookup.components(bomId);
    if (children === 'pending' || children === 'error') {
      row.state = children === 'pending' ? 'loading' : 'failed';
      return;
    }
    if (children.length === 0) return;

    row.state = 'expanded';
    const path = [...ancestors, itemId];
    /* 이 줄이 마지막 형제가 아니면 이 단계의 세로선이 자식들 옆을 지나 다음 형제까지 이어진다. 뿌리는 세로선이 없다. */
    const childRails = depth === 0 ? [] : [...rails, !isLast];
    const sorted = [...children].sort((left, right) => left.sequenceNo - right.sequenceNo);
    sorted.forEach((child, index) => {
      visit(
        child.componentItemId,
        child,
        null,
        depth + 1,
        path,
        `${key}/${String(child.bomComponentId)}`,
        childRails,
        index === sorted.length - 1,
      );
    });
  };

  visit(root.itemId, null, root.bomId, 0, [], String(root.itemId), [], true);

  return { rows, itemIds: [...itemIds], bomIds: [...bomIds] };
};

const cached = <T>(queryClient: QueryClient, queryKey: QueryKey): Lookup<T> => {
  const state = queryClient.getQueryState<T>(queryKey);
  if (state?.data !== undefined) return state.data;
  return state?.status === 'error' ? 'error' : 'pending';
};

const EMPTY_WALK: BomTreeWalk = { rows: [], itemIds: [], bomIds: [] };

/**
 * 트리 줄. 조회 캐시를 읽어 편 다음, 편 결과가 부르라는 것을 `useQueries` 로 부른다 — 응답이 오면 다시 그려져 한 단계
 * 더 편다. 목록 구획(`useBomList`)과 같은 조회 키라 뿌리 품목의 BOM 목록은 다시 부르지 않는다.
 */
export const useBomTree = (
  root: BomTreeRoot | null,
  collapsed: ReadonlySet<string>,
): BomTreeRow[] => {
  const api = useApiClient();
  const queryClient = useQueryClient();

  const walk =
    root === null
      ? EMPTY_WALK
      : walkBomTree(
          root,
          {
            boms: (itemId) => cached<Bom[]>(queryClient, erpBomKeys.list({ parentItemId: itemId })),
            components: (bomId) =>
              cached<ErpBomComponent[]>(queryClient, erpBomKeys.components(bomId)),
          },
          collapsed,
        );

  /*
   * 결과는 캐시에서 읽으므로 여기서는 쓰지 않는다. 다만 응답이 올 때 다시 그려져야 트리가 한 단계 더 펴진다 —
   * 상태 · 받은 시각을 묶어 구독한다(`combine` 값이 바뀌면 다시 그린다).
   */
  const subscribe = (results: { status: string; dataUpdatedAt: number }[]): string =>
    results.map((result) => `${result.status}:${String(result.dataUpdatedAt)}`).join('|');

  useQueries({
    queries: walk.itemIds.map((itemId) => ({
      queryKey: erpBomKeys.list({ parentItemId: itemId }),
      queryFn: () => fetchBomList(api, { parentItemId: itemId }),
    })),
    combine: subscribe,
  });
  useQueries({
    queries: walk.bomIds.map((bomId) => ({
      queryKey: erpBomKeys.components(bomId),
      queryFn: () => fetchBomComponents(api, bomId),
    })),
    combine: subscribe,
  });

  return walk.rows;
};
