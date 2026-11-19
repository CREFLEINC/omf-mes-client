import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import { inDataScope } from '../supplier-item-default/queries';
import type { Defaults, Group } from './types';

type Plant = components['schemas']['Plant'];
type SessionScope = components['schemas']['SessionScope'];
export type PoLine = components['schemas']['PurchaseOrderLineListItem'];

export const materialLotIssueKeys = {
  all: ['material-lot-issue'] as const,
  plants: ['material-lot-issue', 'plants'] as const,
  groups: (plantId: number) => ['material-lot-issue', 'groups', plantId] as const,
  defaults: (plantId: number) => ['material-lot-issue', 'defaults', plantId] as const,
  poLines: (plantId: number, supplierId: number, itemId: number) =>
    ['material-lot-issue', 'po-lines', plantId, supplierId, itemId] as const,
};

/**
 * 입하 마감의 P/O 자동 배정이 라인을 채우는 차례 — 발주일 → P/O 번호 → 라인 번호(서버 `allocateByOrderAge` · R-22).
 * ⛔ 납기 순이 아니다. 서버와 같은 비교(문자열 `<`)로 맞춘다.
 */
const byFillOrder = (left: PoLine, right: PoLine): number => {
  if (left.orderDate !== right.orderDate) return left.orderDate < right.orderDate ? -1 : 1;
  if (left.purchaseOrderNo !== right.purchaseOrderNo) {
    return left.purchaseOrderNo < right.purchaseOrderNo ? -1 : 1;
  }
  return left.lineNo - right.lineNo;
};

/**
 * 고른 공급사·품목의 미입고 P/O 라인 — 입하 마감이 채우는 차례로.
 * 자동 배정 후보는 같은 공장 · 공급사 · 품목 · **단위**의 라인이라 단위가 다른 라인은 뺀다.
 */
export const useOpenPoLines = (
  plantId: number,
  group: Pick<Group, 'supplierId' | 'itemId' | 'uomId'>,
): UseQueryResult<PoLine[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.poLines(plantId, group.supplierId, group.itemId),
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/logistics/purchase-order-lines', {
              params: {
                query: {
                  plantId,
                  supplierId: group.supplierId,
                  itemId: group.itemId,
                  openOnly: true,
                  page,
                  size,
                },
              },
            }),
          ),
        )
      ).items,
    select: (lines) => lines.filter((line) => line.uomId === group.uomId).sort(byFillOrder),
  });
};

/**
 * 공장 목록 — 쓰는 공장 중 세션 데이터 범위 안의 것만, 코드 순. 첫 공장이 기본이라 범위로 거르지 않으면
 * 사용자의 공장이 아닌 공장(코드가 앞선 공장)으로 열린다 — W-06-25 와 같게 거른다(G2 L21).
 */
export const usePlants = (scopes: readonly SessionScope[]): UseQueryResult<Plant[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.plants,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() => client.GET('/mdm/plants', { params: { query: { page, size } } })),
        )
      ).items,
    select: (plants) =>
      plants
        .filter((plant) => plant.isActive && inDataScope(plant, scopes))
        .sort((left, right) => left.plantCode.localeCompare(right.plantCode)),
  });
};

/**
 * 공장의 공급사·품목별 대기 자재 관리 LOT(계약 §1 `GET /logistics/waiting-material-lots`).
 * ⭐ 공급사 · 품목 · 「대기 있는 것만」은 화면이 거른다 — 발행 창의 공급사·품목 고르기와 공급사 조건 목록이
 *   공장의 전체 조합을 써야 해서 한 번에 받는다.
 */
export const useWaitingGroups = (plantId: number | null): UseQueryResult<Group[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.groups(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/logistics/waiting-material-lots', {
            params: { query: { plantId: plantId ?? 0 } },
          }),
        )
      ).items,
  });
};

/** 공장의 공급사·품목 기본 정보 전부(계약 §9) — 표의 「기본 정보」 칸. */
export const usePlantDefaults = (plantId: number | null): UseQueryResult<Defaults[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: materialLotIssueKeys.defaults(plantId ?? 0),
    enabled: plantId !== null,
    queryFn: async () =>
      (
        await fetchAllPages((page, size) =>
          runRequest(() =>
            client.GET('/mdm/supplier-item-defaults', {
              params: { query: { plantId: plantId ?? 0, page, size } },
            }),
          ),
        )
      ).items,
  });
};
