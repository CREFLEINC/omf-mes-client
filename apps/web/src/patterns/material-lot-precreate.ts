import type {
  ApiClient,
  MaterialLotGeneration,
  MaterialLotPair,
  MaterialLotPairItem,
  MaterialLotPairSupplier,
  MaterialLotSupplier,
  MaterialLotTab,
  MaterialLotTabRow,
} from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { ApiRequestError, runRequest } from './request';

/**
 * 자재 관리 LOT P/O 미리 생성의 읽기(피처 014 · omf-all-around#349 · 계약 `material-lot-precreate-api.md`).
 *
 * POP P-01-01 「자재 관리 LOT 라벨」과 관리웹 W-01-14 「자재 관리 LOT 발행」이 **같은 경로 · 같은 규칙**을 쓴다.
 *
 * | 무엇 | 경로 |
 * | --- | --- |
 * | POP 공급사 칸(찾기 · 쪽) | `GET /logistics/material-lot-suppliers` — 만들지 않는다(세 칸, 계약 §1a) |
 * | 공급사·품목(찾기 · 쪽, POP 품목 표는 `supplierId`) | `GET /logistics/material-lot-pairs` — 만들지 않는다 |
 * | 오른쪽 탭 넷(쪽) | `GET /logistics/material-lots?tab=` — **미출력 탭만 이 쪽까지 모자란 몫을 만든다** |
 * | 번호 스캔 찾기 | `GET /logistics/material-lots/lookup` — 만들지 않는다 |
 *
 * ⭐ 미출력 탭 조회는 쓰기를 겸한다(조회가 LOT 을 만든다 · 같은 요청은 같은 결과). 그래서 주기 다시 받기를 두지
 *    않고, 쪽 크기를 키워 «미리» 받지 않는다 — 한 번에 최대 한 쪽만 만든다(SC-003).
 * ⛔ 공장 전체를 한 번에 받던 `GET /logistics/waiting-material-lots` 는 두 화면 · 배지가 더 쓰지 않는다(FR-010).
 */

type Client = ApiClient['client'];

/** 계약의 쪽 크기 상한. */
export const MATERIAL_LOT_PAGE_MAX = 200;

export const TAB_ORDER: readonly MaterialLotTab[] = ['UNPRINTED', 'PRINTED', 'RECEIVED', 'VOIDED'];

export const materialLotKeys = {
  all: ['material-lot-precreate'] as const,
  suppliers: (plantId: number, q: string, page: number, size: number) =>
    ['material-lot-precreate', 'suppliers', plantId, q, page, size] as const,
  pairs: (plantId: number, supplierId: number | null, q: string, page: number, size: number) =>
    ['material-lot-precreate', 'pairs', plantId, supplierId, q, page, size] as const,
  lots: (
    plantId: number,
    supplierId: number,
    itemId: number,
    tab: MaterialLotTab,
    page: number,
    size: number,
  ) => ['material-lot-precreate', 'lots', plantId, supplierId, itemId, tab, page, size] as const,
};

export interface PairsQuery {
  plantId: number;
  /** POP 품목 표 — 고른 공급사로 거른다(세 칸). W-01-14 는 비운다. */
  supplierId?: number | null;
  q: string;
  page: number;
  size: number;
}

export interface PairsPage {
  items: MaterialLotPair[];
  total: number;
  /** 공장 전체 이미 만든 미출력 LOT 수(찾기와 상관없음) — POP 배지. */
  unprintedSummary: number;
}

const clampSize = (size: number): number =>
  Math.min(MATERIAL_LOT_PAGE_MAX, Math.max(1, Math.floor(size)));

export const fetchMaterialLotPairs = async (
  client: Client,
  query: PairsQuery,
): Promise<PairsPage> => {
  const q = query.q.trim();
  const data = await runRequest(() =>
    client.GET('/logistics/material-lot-pairs', {
      params: {
        query: {
          plantId: query.plantId,
          ...(query.supplierId === undefined || query.supplierId === null
            ? {}
            : { supplierId: query.supplierId }),
          ...(q === '' ? {} : { q }),
          page: query.page,
          size: clampSize(query.size),
        },
      },
    }),
  );

  return {
    items: data.items,
    total: data.page.total,
    unprintedSummary: data.summary.unprintedCount,
  };
};

/** 왼쪽 목록 한 쪽. 공장을 모르면 부르지 않는다. */
export const useMaterialLotPairs = (query: PairsQuery | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey:
      query === null
        ? [...materialLotKeys.all, 'pairs', 'none']
        : materialLotKeys.pairs(
            query.plantId,
            query.supplierId ?? null,
            query.q.trim(),
            query.page,
            query.size,
          ),
    enabled: query !== null,
    placeholderData: (previous) => previous,
    queryFn: () => {
      if (query === null) throw new Error('공장 없음');

      return fetchMaterialLotPairs(client, query);
    },
  });
};

export interface SuppliersQuery {
  plantId: number;
  q: string;
  page: number;
  size: number;
}

export interface SuppliersPage {
  items: MaterialLotSupplier[];
  total: number;
}

/** POP 공급사 칸 한 쪽(계약 §1a) — 그 공급사 조합들의 미출력 · 만들 수 있는 몫 합. 만들지 않는다. */
export const fetchMaterialLotSuppliers = async (
  client: Client,
  query: SuppliersQuery,
): Promise<SuppliersPage> => {
  const q = query.q.trim();
  const data = await runRequest(() =>
    client.GET('/logistics/material-lot-suppliers', {
      params: {
        query: {
          plantId: query.plantId,
          ...(q === '' ? {} : { q }),
          page: query.page,
          size: clampSize(query.size),
        },
      },
    }),
  );

  return { items: data.items, total: data.page.total };
};

/** POP 공급사 칸 한 쪽. 공장을 모르면 부르지 않는다. */
export const useMaterialLotSuppliers = (query: SuppliersQuery | null) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey:
      query === null
        ? [...materialLotKeys.all, 'suppliers', 'none']
        : materialLotKeys.suppliers(query.plantId, query.q.trim(), query.page, query.size),
    enabled: query !== null,
    placeholderData: (previous) => previous,
    queryFn: () => {
      if (query === null) throw new Error('공장 없음');

      return fetchMaterialLotSuppliers(client, query);
    },
  });
};

/** 탭 목록의 대상 — 공장 · 공급사 · 품목. */
export interface LotsTarget {
  plantId: number;
  supplierId: number;
  itemId: number;
}

export interface LotsPage {
  items: MaterialLotTabRow[];
  total: number;
  /** 미출력 탭만 — 다른 탭은 `null`. */
  generation: MaterialLotGeneration | null;
}

export const fetchMaterialLots = async (
  client: Client,
  target: LotsTarget,
  tab: MaterialLotTab,
  page: number,
  size: number,
): Promise<LotsPage> => {
  const data = await runRequest(() =>
    client.GET('/logistics/material-lots', {
      params: {
        query: {
          plantId: target.plantId,
          supplierId: target.supplierId,
          itemId: target.itemId,
          tab,
          page,
          size: clampSize(size),
        },
      },
    }),
  );

  return { items: data.items, total: data.page.total, generation: data.generation };
};

/**
 * 고른 공급사·품목의 한 탭 한 쪽. 미출력이면 서버가 이 쪽까지 모자란 몫을 만든 뒤 준다(FR-008).
 * ⚠ 다시 받는 일은 화면이 정한다(만들기 · 폐기 · 출력 · 수정 뒤 `materialLotKeys.all` 무효화).
 */
export const useMaterialLots = (
  target: LotsTarget | null,
  tab: MaterialLotTab,
  page: number,
  size: number,
) => {
  const { client } = useApiClient();

  return useQuery({
    queryKey:
      target === null
        ? [...materialLotKeys.all, 'lots', 'none']
        : materialLotKeys.lots(target.plantId, target.supplierId, target.itemId, tab, page, size),
    enabled: target !== null,
    /* 409 LOT_NO_CONFLICT 는 다시 부르면 풀린다 — 화면이 [다시 불러오기]로 맡는다(저절로 거듭 만들지 않는다). */
    retry: false,
    queryFn: () => {
      if (target === null) throw new Error('대상 없음');

      return fetchMaterialLots(client, target, tab, page, size);
    },
  });
};

export interface LookupResult {
  lot: MaterialLotTabRow;
  supplier: MaterialLotPairSupplier;
  item: MaterialLotPairItem;
  tab: MaterialLotTab;
}

/** 번호 스캔 찾기(FR-021). 그 공장에 없는 번호(404)면 `null`. 그 밖의 실패는 던진다. */
export const lookupMaterialLot = async (
  client: Client,
  plantId: number,
  lotNo: string,
): Promise<LookupResult | null> => {
  try {
    return await runRequest(() =>
      client.GET('/logistics/material-lots/lookup', {
        params: { query: { plantId, lotNo } },
      }),
    );
  } catch (cause) {
    if (cause instanceof ApiRequestError && cause.httpStatus === 404) return null;
    throw cause;
  }
};

/**
 * 넣은 글이 자재 관리 LOT 번호인가 — 번호는 `품목|수량|YYMMDD|공급사|NNNN` 처럼 `|` 로 칸을 가른다.
 * 번호가 아니면 공급사·품목 찾기다(FR-021 「번호가 아닌 글자는 지금처럼 찾기」).
 */
export const isMaterialLotNoText = (value: string): boolean => value.trim().includes('|');

/** 미출력 탭의 「아직 만들지 않은 몫」 — 쪽 넘김 옆 「아직 만들지 않은 N건 포함」. */
export const creatableRemainingOf = (generation: MaterialLotGeneration | null): number =>
  generation?.creatableRemaining ?? 0;
