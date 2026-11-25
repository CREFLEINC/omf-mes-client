import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest } from '../../patterns/request';
import type { Group } from './types';

type Plant = components['schemas']['Plant'];
type SessionScope = components['schemas']['SessionScope'];
export type PoLine = components['schemas']['PurchaseOrderLineListItem'];

export const materialLotIssueKeys = {
  all: ['material-lot-issue'] as const,
  plants: ['material-lot-issue', 'plants'] as const,
  poLines: (plantId: number, supplierId: number, itemId: number) =>
    ['material-lot-issue', 'po-lines', plantId, supplierId, itemId] as const,
};

/** 데이터 범위 안인가 — 줄에 공장이 있으면 그 공장, 없으면 그 사업부의 공장 모두, 줄이 없으면 전체. */
const inDataScope = (plant: Plant, scopes: readonly SessionScope[]): boolean =>
  scopes.length === 0 ||
  scopes.some((scope) =>
    scope.plantId !== undefined
      ? scope.plantId === plant.plantId
      : scope.businessUnitId === plant.businessUnitId,
  );

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
 * 자동 배정 후보는 같은 공장 · 공급사 · 품목 · **단위**의 라인이라 단위가 다른 라인은 뺀다. 기본 단위 번호를
 * 모르면(단위 목록을 못 받음) 거르지 않는다.
 */
export const useOpenPoLines = (
  plantId: number,
  group: Pick<Group, 'supplierId' | 'itemId'>,
  uomId: number | null,
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
    select: (lines) =>
      lines.filter((line) => uomId === null || line.uomId === uomId).sort(byFillOrder),
  });
};

/**
 * 공장 목록 — 쓰는 공장 중 세션 데이터 범위 안의 것만, 코드 순. 첫 공장이 기본이라 범위로 거르지 않으면
 * 사용자의 공장이 아닌 공장(코드가 앞선 공장)으로 열린다 — 데이터 범위로 거른다(G2 L21).
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
