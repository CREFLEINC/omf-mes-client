import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useApiClient } from '../../../patterns/api-context';
import { REFERENCE_PAGE_SIZE, type ReferenceSource } from '../../../patterns/reference-picker';
import { runRequest } from '../../../patterns/request';
import { workOrderResourceKeys } from '../../work-order/resource-queries';

/**
 * 4M 배정과 생산계획 단계의 참조 선택 팝업 조회(C-12). 공장 안에서 사용 중인 것만 찾는다.
 */
const t = messages.erpWorkOrderFlow.process.pickers;

export const useLineSource = (plantId: number | null): ReferenceSource | null => {
  const { client } = useApiClient();
  return useMemo(
    () =>
      plantId === null
        ? null
        : {
            title: t.line,
            key: ['reference', 'line', plantId],
            columns: { code: t.columns.lineCode, name: t.columns.lineName },
            search: async (term, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/production-lines', {
                  params: {
                    query: {
                      plantId,
                      ...(term === '' ? {} : { q: term }),
                      page,
                      size: REFERENCE_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                items: data.items.map((item) => ({
                  id: item.productionLineId,
                  code: item.lineCode,
                  name: item.lineName,
                })),
                total: data.page.total,
              };
            },
          },
    [client, plantId],
  );
};

export const useEquipmentSource = (
  plantId: number | null,
  lineId: number | null,
): ReferenceSource | null => {
  const { client } = useApiClient();
  return useMemo(
    () =>
      plantId === null
        ? null
        : {
            title: t.equipment,
            key: ['reference', 'equipment', plantId, lineId],
            columns: { code: t.columns.equipmentCode, name: t.columns.equipmentName },
            search: async (term, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/equipments', {
                  params: {
                    query: {
                      plantId,
                      ...(lineId === null ? {} : { productionLineId: lineId }),
                      ...(term === '' ? {} : { q: term }),
                      page,
                      size: REFERENCE_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                items: data.items.map((item) => ({
                  id: item.equipmentId,
                  code: item.equipmentCode,
                  name: item.equipmentName,
                  parentId: item.productionLineId ?? null,
                })),
                total: data.page.total,
              };
            },
          },
    [client, lineId, plantId],
  );
};

export const useMoldSource = (plantId: number | null): ReferenceSource | null => {
  const { client } = useApiClient();
  return useMemo(
    () =>
      plantId === null
        ? null
        : {
            title: t.mold,
            key: ['reference', 'mold', plantId],
            columns: { code: t.columns.moldCode, name: t.columns.moldName },
            search: async (term, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/molds', {
                  params: {
                    query: {
                      plantId,
                      toolTypeCode: 'MOLD',
                      ...(term === '' ? {} : { q: term }),
                      page,
                      size: REFERENCE_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                items: data.items.map((item) => ({
                  id: item.moldId,
                  code: item.moldCode,
                  name: item.moldName,
                })),
                total: data.page.total,
              };
            },
          },
    [client, plantId],
  );
};

export const useWorkerSource = (plantId: number | null): ReferenceSource | null => {
  const { client } = useApiClient();
  return useMemo(
    () =>
      plantId === null
        ? null
        : {
            title: t.worker,
            key: ['reference', 'worker', plantId],
            columns: { code: t.columns.workerNo, name: t.columns.workerName },
            search: async (term, page) => {
              const data = await runRequest(() =>
                client.GET('/mdm/workers', {
                  params: {
                    query: {
                      plantId,
                      ...(term === '' ? {} : { q: term }),
                      page,
                      size: REFERENCE_PAGE_SIZE,
                    },
                  },
                }),
              );
              return {
                items: data.items.map((item) => ({
                  id: item.workerId,
                  code: item.workerNo,
                  name: item.workerName,
                })),
                total: data.page.total,
              };
            },
          },
    [client, plantId],
  );
};

/**
 * 위치는 창고에 딸린다(C-12 의존 관계). 칸의 창고 유형(완제품은 제품창고, 그 밖은 일반 창고)의 창고를 분류 필터로 두고,
 * 창고를 바꿔 가며 위치를 찾는다. 위치를 고르면 창고도 정해진다.
 */
export const useLocationSource = (
  plantId: number | null,
  warehouseTypeCode: string,
): ReferenceSource | null => {
  const { client } = useApiClient();
  const warehouses = useQuery({
    queryKey: workOrderResourceKeys.warehouses,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { includeInactive: true, size: 200 } } }),
      ),
  });
  return useMemo(() => {
    const options = (warehouses.data?.items ?? [])
      .filter(
        (item) =>
          item.isActive && item.plantId === plantId && item.warehouseTypeCode === warehouseTypeCode,
      )
      .map((item) => ({ value: String(item.warehouseId), label: item.warehouseName }));
    const first = options[0];
    if (plantId === null || first === undefined) return null;
    return {
      title: t.location,
      key: ['reference', 'location', plantId, warehouseTypeCode],
      columns: {
        code: t.columns.locationCode,
        name: t.columns.locationName,
        group: t.columns.warehouse,
      },
      filter: { label: t.columns.warehouse, value: first.value, options },
      search: async (term, page, warehouseId) => {
        const data = await runRequest(() =>
          client.GET('/mdm/locations', {
            params: {
              query: {
                warehouseId: Number(warehouseId),
                ...(term === '' ? {} : { q: term }),
                page,
                size: REFERENCE_PAGE_SIZE,
              },
            },
          }),
        );
        const group = options.find((option) => option.value === warehouseId)?.label;
        return {
          items: data.items.map((item) => ({
            id: item.locationId,
            code: item.locationCode,
            name: item.locationName,
            ...(group === undefined ? {} : { group }),
          })),
          total: data.page.total,
        };
      },
    };
  }, [client, plantId, warehouseTypeCode, warehouses.data]);
};
