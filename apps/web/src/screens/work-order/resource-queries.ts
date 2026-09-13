import type { components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type ProductionLine = components['schemas']['ProductionLine'];
type Equipment = components['schemas']['Equipment'];
type Shift = components['schemas']['Shift'];
type Warehouse = components['schemas']['Warehouse'];
type Location = components['schemas']['Location'];
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

export interface WorkOrderShiftFact {
  shiftId: number;
  plantId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  isActive: boolean;
}

export interface WorkOrderLocationFact {
  locationId: number;
  warehouseId: number;
  locationCode: string;
  locationName: string;
  isActive: boolean;
}

export interface WorkOrderLocationLookup {
  items: WorkOrderLocationFact[];
  truncated: boolean;
  isPending: boolean;
  isError: boolean;
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
  shifts: (plantId: number | null, page: number) =>
    ['work-order-resources', 'shifts', plantId, page] as const,
  warehouses: ['work-order-resources', 'warehouses'] as const,
  locations: (warehouseId: number) =>
    ['work-order-resources', 'locations', warehouseId] as const,
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

export const toWorkOrderShiftFact = (shift: Shift): WorkOrderShiftFact => ({
  shiftId: shift.shiftId,
  plantId: shift.plantId,
  shiftCode: shift.shiftCode,
  shiftName: shift.shiftName,
  startTime: shift.startTime,
  endTime: shift.endTime,
  crossesMidnight: shift.crossesMidnight,
  isActive: shift.isActive,
});

const toWorkOrderLocationFact = (location: Location): WorkOrderLocationFact => ({
  locationId: location.locationId,
  warehouseId: location.warehouseId,
  locationCode: location.locationCode,
  locationName: location.locationName,
  isActive: location.isActive,
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

export const useWorkOrderShifts = (
  plantId: number | null,
  page: number,
): UseQueryResult<WorkOrderResourceList<WorkOrderShiftFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderResourceKeys.shifts(plantId, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load shifts.');
      }

      return toResourceList(
        await runRequest(() =>
          client.GET('/mdm/shifts', {
            params: { query: { plantId, includeInactive: true, page } },
          }),
        ),
        toWorkOrderShiftFact,
      );
    },
  });
};

/**
 * 작업지시는 기본 위치의 창고를 별도로 갖지 않는다. Location API가 창고를 필수로 받으므로
 * 실제 창고별 목록을 합쳐 선택한다. 창고 ID를 화면이나 시드에 고정하지 않는다.
 */
export const useWorkOrderLocations = (): WorkOrderLocationLookup => {
  const { client } = useApiClient();
  const warehouses = useQuery({
    queryKey: workOrderResourceKeys.warehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: true, size: 200 } } }),
      ),
  });
  const activeWarehouseIds =
    warehouses.data?.items.filter((warehouse) => warehouse.isActive).map((warehouse) => warehouse.warehouseId) ??
    [];
  const locations = useQueries({
    queries: activeWarehouseIds.map((warehouseId) => ({
      queryKey: workOrderResourceKeys.locations(warehouseId),
      queryFn: () =>
        runRequest(() =>
          client.GET('/mdm/locations', {
            params: { query: { warehouseId, includeInactive: true, size: 200 } },
          }),
        ),
    })),
  });

  return {
    items: locations.flatMap((query) => query.data?.items.map(toWorkOrderLocationFact) ?? []),
    truncated:
      (warehouses.data !== undefined && warehouses.data.page.total > warehouses.data.items.length) ||
      locations.some(
        (query) => query.data !== undefined && query.data.page.total > query.data.items.length,
      ),
    isPending: warehouses.isPending || locations.some((query) => query.isPending),
    isError: warehouses.isError || locations.some((query) => query.isError),
  };
};
