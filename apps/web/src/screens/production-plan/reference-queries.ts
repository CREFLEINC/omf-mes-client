import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PageMeta } from './types';

type Bom = components['schemas']['Bom'];
type Routing = components['schemas']['Routing'];
type ProductionLine = components['schemas']['ProductionLine'];

export interface BomRevisionFact {
  bomId: number;
  parentItemId: number;
  bomCode: string;
  bomVersion: number;
  statusCode: string;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo: string | null | undefined;
  baseQty: number;
  baseUomId: number;
}

export interface RoutingRevisionFact {
  routingId: number;
  itemId: number;
  routingCode: string;
  routingVersion: number;
  statusCode: string;
  effectiveFrom: string | null | undefined;
  effectiveTo: string | null | undefined;
}

export interface ProductionLineFact {
  productionLineId: number;
  plantId: number;
  parentLineId: number | null | undefined;
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
  page: PageMeta;
  truncated: boolean;
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
  effectiveTo: bom.effectiveTo,
  baseQty: bom.baseQty,
  baseUomId: bom.baseUomId,
});

const toRoutingRevisionFact = (routing: Routing): RoutingRevisionFact => ({
  routingId: routing.routingId,
  itemId: routing.itemId,
  routingCode: routing.routingCode,
  routingVersion: routing.routingVersion,
  statusCode: routing.statusCode,
  effectiveFrom: routing.effectiveFrom,
  effectiveTo: routing.effectiveTo,
});

const toProductionLineFact = (productionLine: ProductionLine): ProductionLineFact => ({
  productionLineId: productionLine.productionLineId,
  plantId: productionLine.plantId,
  parentLineId: productionLine.parentLineId,
  lineCode: productionLine.lineCode,
  lineName: productionLine.lineName,
  lineTypeCode: productionLine.lineTypeCode,
  isActive: productionLine.isActive,
});

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

      return runRequest(() =>
        client.GET('/mdm/production-lines', {
          params: { query: { plantId, includeInactive: true } },
        }),
      ).then((response) => ({
        items: response.items.map(toProductionLineFact),
        page: response.page,
        truncated: response.page.total > response.items.length,
      }));
    },
  });
};
