import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ProductionLine = components['schemas']['ProductionLine'];
type Equipment = components['schemas']['Equipment'];
type PageMeta = components['schemas']['PageMeta'];

export interface WorkOrderProductionLineFact {
  productionLineId: number;
  plantId: number;
  parentLineId: number | null;
  lineCode: string;
  lineName: string;
  lineTypeCode: string;
  isActive: boolean;
}

export interface WorkOrderEquipmentFact {
  equipmentId: number;
  plantId: number;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeCode: string;
  processId: number | null;
  productionLineId: number | null;
  statusCode: string;
  isActive: boolean;
}

export interface WorkOrderResourceList<TItem> {
  items: TItem[];
  page: PageMeta;
  truncated: boolean;
}

export const workOrderResourceKeys = {
  all: ['work-order-resources'] as const,
  productionLines: (plantId: number | null, page: number) =>
    ['work-order-resources', 'production-lines', plantId, page] as const,
  equipments: (plantId: number | null, productionLineId: number | null, page: number) =>
    ['work-order-resources', 'equipments', plantId, productionLineId, page] as const,
};

export const toWorkOrderProductionLineFact = (
  productionLine: ProductionLine,
): WorkOrderProductionLineFact => ({
  productionLineId: productionLine.productionLineId,
  plantId: productionLine.plantId,
  parentLineId: productionLine.parentLineId ?? null,
  lineCode: productionLine.lineCode,
  lineName: productionLine.lineName,
  lineTypeCode: productionLine.lineTypeCode,
  isActive: productionLine.isActive,
});

export const toWorkOrderEquipmentFact = (equipment: Equipment): WorkOrderEquipmentFact => ({
  equipmentId: equipment.equipmentId,
  plantId: equipment.plantId,
  equipmentCode: equipment.equipmentCode,
  equipmentName: equipment.equipmentName,
  equipmentTypeCode: equipment.equipmentTypeCode,
  processId: equipment.processId ?? null,
  productionLineId: equipment.productionLineId ?? null,
  statusCode: equipment.statusCode,
  isActive: equipment.isActive,
});

const toResourceList = <TSource, TFact>(
  response: { items: TSource[]; page: PageMeta },
  toFact: (item: TSource) => TFact,
): WorkOrderResourceList<TFact> => ({
  items: response.items.map(toFact),
  page: response.page,
  truncated: response.page.total > response.items.length,
});

export const useWorkOrderProductionLines = (
  plantId: number | null,
  page: number,
): UseQueryResult<WorkOrderResourceList<WorkOrderProductionLineFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderResourceKeys.productionLines(plantId, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load production lines.');
      }

      return toResourceList(
        await runRequest(() =>
          client.GET('/mdm/production-lines', {
            params: { query: { plantId, includeInactive: true, page } },
          }),
        ),
        toWorkOrderProductionLineFact,
      );
    },
  });
};

export const useWorkOrderEquipments = (
  plantId: number | null,
  productionLineId: number | null,
  page: number,
): UseQueryResult<WorkOrderResourceList<WorkOrderEquipmentFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderResourceKeys.equipments(plantId, productionLineId, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load equipment.');
      }

      return toResourceList(
        await runRequest(() =>
          client.GET('/mdm/equipments', {
            params: {
              query: {
                plantId,
                ...(productionLineId === null ? {} : { productionLineId }),
                statusCode: 'IN_SERVICE',
                includeInactive: true,
                page,
              },
            },
          }),
        ),
        toWorkOrderEquipmentFact,
      );
    },
  });
};
