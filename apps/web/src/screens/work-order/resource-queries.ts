import type { components, LineDefaultLocations } from '@omf-mes/api-client';
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
  /** 라인 기본 위치 — 4M 에서 라인을 고르면 W/O 기본 위치를 이 값으로 덮어쓴다. */
  defaultWipLocationId: number | null;
  defaultFgLocationId: number | null;
  defaultScrapLocationId: number | null;
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
  /** 창고를 함께 보여야 WIP·완제품 위치를 가를 수 있다. 창고 목록에 없으면 `null`. */
  warehouseCode: string | null;
  warehouseTypeCode: string | null;
  warehouseName: string | null;
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
  locations: (warehouseId: number) => ['work-order-resources', 'locations', warehouseId] as const,
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
  ...lineDefaultLocationsOf(productionLine),
});

/** 서버 선행 칸이라 생성 타입에 없다 — 없으면 비어 있는 것으로 본다. */
export const lineDefaultLocationsOf = (
  source: object,
): Required<{ [K in keyof LineDefaultLocations]: number | null }> => {
  const value = source as LineDefaultLocations;
  return {
    defaultWipLocationId: value.defaultWipLocationId ?? null,
    defaultFgLocationId: value.defaultFgLocationId ?? null,
    defaultScrapLocationId: value.defaultScrapLocationId ?? null,
  };
};

/**
 * 기본 위치 칸마다 보여 줄 창고 유형. 자재창고(MATERIAL)는 어느 칸에도 두지 않는다 — WIP 위치로
 * 자재창고를 고르면 출고가 창고 안에서 맴돈다.
 */
export const LINE_LOCATION_WAREHOUSE_TYPES = {
  defaultWipLocationId: 'GENERAL',
  defaultFgLocationId: 'PRODUCT',
  defaultScrapLocationId: 'GENERAL',
} as const;

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

const toWorkOrderLocationFact = (
  location: Location,
  warehouse: Warehouse | undefined,
): WorkOrderLocationFact => ({
  locationId: location.locationId,
  warehouseId: location.warehouseId,
  warehouseCode: warehouse?.warehouseCode ?? null,
  warehouseTypeCode: warehouse?.warehouseTypeCode ?? null,
  warehouseName: warehouse?.warehouseName ?? null,
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
 *
 * 그 공장의 창고만, 자재창고는 빼고 부른다 — 창고를 먼저 거르고 위치를 부르므로 거른 창고의
 * 위치만 받는다(잘림은 창고 하나가 한 쪽을 넘을 때만 생긴다). 칸별 유형은 `LINE_LOCATION_WAREHOUSE_TYPES`.
 */
export const useWorkOrderLocations = (plantId: number | null): WorkOrderLocationLookup => {
  const { client } = useApiClient();
  const warehouses = useQuery({
    queryKey: workOrderResourceKeys.warehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: true, size: 200 } } }),
      ),
  });
  const activeWarehouseIds =
    warehouses.data?.items
      .filter(
        (warehouse) =>
          warehouse.isActive &&
          warehouse.plantId === plantId &&
          warehouse.warehouseTypeCode !== 'MATERIAL',
      )
      .map((warehouse) => warehouse.warehouseId) ?? [];
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
    items: locations.flatMap(
      (query) =>
        query.data?.items.map((location) =>
          toWorkOrderLocationFact(
            location,
            warehouses.data?.items.find(
              (warehouse) => warehouse.warehouseId === location.warehouseId,
            ),
          ),
        ) ?? [],
    ),
    truncated:
      (warehouses.data !== undefined &&
        warehouses.data.page.total > warehouses.data.items.length) ||
      locations.some(
        (query) => query.data !== undefined && query.data.page.total > query.data.items.length,
      ),
    isPending: warehouses.isPending || locations.some((query) => query.isPending),
    isError: warehouses.isError || locations.some((query) => query.isError),
  };
};
