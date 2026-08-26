import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
type Bom = components['schemas']['Bom'];
type Routing = components['schemas']['Routing'];
type ProductionLine = components['schemas']['ProductionLine'];
type Client = ApiClient['client'];
const PRODUCTION_LINE_PAGE_SIZE = 100;

export interface BomRevisionFact {
  bomId: number;
  parentItemId: number;
  bomCode: string;
  bomVersion: number;
  statusCode: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  baseQty: number;
  baseUomId: number;
}

export interface RoutingRevisionFact {
  routingId: number;
  itemId: number;
  routingCode: string;
  routingVersion: number;
  statusCode: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface ProductionLineFact {
  productionLineId: number;
  plantId: number;
  parentLineId: number | null;
  lineCode: string;
  lineName: string;
  lineTypeCode: string;
  isActive: boolean;
}

export interface BomReferenceResponse {
  items: BomRevisionFact[];
}

export interface RoutingReferenceResponse {
  items: RoutingRevisionFact[];
}

export interface ProductionLineReferenceResponse {
  items: ProductionLineFact[];
  total: number;
}

export const productionPlanReferenceKeys = {
  all: ['production-plan-references'] as const,
  boms: (itemId: number | null) => ['production-plan-references', 'boms', itemId] as const,
  routings: (itemId: number | null) => ['production-plan-references', 'routings', itemId] as const,
  productionLines: (plantId: number | null) =>
    ['production-plan-references', 'production-lines', plantId] as const,
};

const toBomRevisionFact = (bom: Bom): BomRevisionFact => ({
  bomId: bom.bomId,
  parentItemId: bom.parentItemId,
  bomCode: bom.bomCode,
  bomVersion: bom.bomVersion,
  statusCode: bom.statusCode,
  isDefault: bom.isDefault,
  effectiveFrom: bom.effectiveFrom,
  effectiveTo: bom.effectiveTo ?? null,
  baseQty: bom.baseQty,
  baseUomId: bom.baseUomId,
});

const toRoutingRevisionFact = (routing: Routing): RoutingRevisionFact => ({
  routingId: routing.routingId,
  itemId: routing.itemId,
  routingCode: routing.routingCode,
  routingVersion: routing.routingVersion,
  statusCode: routing.statusCode,
  effectiveFrom: routing.effectiveFrom ?? null,
  effectiveTo: routing.effectiveTo ?? null,
});

const toProductionLineFact = (productionLine: ProductionLine): ProductionLineFact => ({
  productionLineId: productionLine.productionLineId,
  plantId: productionLine.plantId,
  parentLineId: productionLine.parentLineId ?? null,
  lineCode: productionLine.lineCode,
  lineName: productionLine.lineName,
  lineTypeCode: productionLine.lineTypeCode,
  isActive: productionLine.isActive,
});

const fetchAllProductionLines = async (
  client: Client,
  plantId: number,
): Promise<ProductionLineReferenceResponse> => {
  const requestPage = (page: number) =>
    runRequest(() =>
      client.GET('/mdm/production-lines', {
        params: {
          query: {
            plantId,
            includeInactive: true,
            size: PRODUCTION_LINE_PAGE_SIZE,
            ...(page > 1 ? { page } : {}),
          },
        },
      }),
    );
  const first = await requestPage(1);
  const unique = new Map(
    first.items.map(toProductionLineFact).map((item) => [item.productionLineId, item]),
  );
  if (
    first.page.page !== 1 ||
    !Number.isSafeInteger(first.page.size) ||
    first.page.size < 1 ||
    !Number.isSafeInteger(first.page.total) ||
    first.page.total < 0 ||
    unique.size > first.page.total ||
    [...unique.values()].some((item) => item.plantId !== plantId)
  ) {
    throw new Error('생산라인 전체 목록의 쪽 정보가 일관되지 않습니다.');
  }

  const totalPages = Math.ceil(first.page.total / first.page.size);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await requestPage(page);
    const items = next.items.map(toProductionLineFact);
    if (
      next.page.page !== page ||
      next.page.size !== first.page.size ||
      next.page.total !== first.page.total ||
      items.some((item) => item.plantId !== plantId)
    ) {
      throw new Error('생산라인 전체 목록의 쪽 정보가 일관되지 않습니다.');
    }
    items.forEach((item) => unique.set(item.productionLineId, item));
  }
  if (unique.size !== first.page.total) {
    throw new Error('생산라인 전체 목록을 완성하지 못했습니다.');
  }
  return { items: [...unique.values()], total: first.page.total };
};

export const useBomReferenceQuery = (
  itemId: number | null,
): UseQueryResult<BomReferenceResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanReferenceKeys.boms(itemId),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 BOM 개정을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/boms', { params: { query: { parentItemId: itemId } } }),
      ).then((response) => ({ items: response.items.map(toBomRevisionFact) }));
    },
  });
};

export const useRoutingReferenceQuery = (
  itemId: number | null,
): UseQueryResult<RoutingReferenceResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanReferenceKeys.routings(itemId),
    enabled: itemId !== null,
    queryFn: () => {
      if (itemId === null) {
        throw new Error('품목을 고르기 전에는 Routing 개정을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/routings', { params: { query: { itemId } } }),
      ).then((response) => ({ items: response.items.map(toRoutingRevisionFact) }));
    },
  });
};

export const useProductionLineReferenceQuery = (
  plantId: number | null,
): UseQueryResult<ProductionLineReferenceResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanReferenceKeys.productionLines(plantId),
    enabled: plantId !== null,
    queryFn: () => {
      if (plantId === null) {
        throw new Error('공장을 고르기 전에는 생산 라인을 조회하지 않습니다.');
      }

      return fetchAllProductionLines(client, plantId);
    },
  });
};
