import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Mold = components['schemas']['Mold'];
type Worker = components['schemas']['Worker'];
type PageMeta = components['schemas']['PageMeta'];

export interface WorkOrderMoldFact {
  moldId: number;
  plantId: number;
  moldCode: string;
  moldName: string;
  toolTypeCode: string;
  availableShotCount: number | null;
  statusCode: string;
  isActive: boolean;
}

export interface WorkOrderWorkerFact {
  workerId: number;
  workerNo: string;
  workerName: string;
  businessUnitId: number;
  plantId: number;
  departmentId: number | null;
  statusCode: string;
  isActive: boolean;
}

export interface WorkOrderPeopleToolList<TItem> {
  items: TItem[];
  page: PageMeta;
  truncated: boolean;
}

export const workOrderPeopleToolKeys = {
  all: ['work-order-people-tools'] as const,
  molds: (plantId: number | null, page: number) =>
    ['work-order-people-tools', 'molds', plantId, page] as const,
  workers: (plantId: number | null, page: number, term: string) =>
    ['work-order-people-tools', 'workers', plantId, page, term] as const,
  worker: (workerId: number | null) => ['work-order-people-tools', 'worker', workerId] as const,
};

/** 계약 최대 쪽 크기. 넘는 작업자는 사번·성명 검색(`q`)으로 찾는다. */
export const WORKER_PAGE_SIZE = 200;

export const toWorkOrderMoldFact = (mold: Mold): WorkOrderMoldFact => ({
  moldId: mold.moldId,
  plantId: mold.plantId,
  moldCode: mold.moldCode,
  moldName: mold.moldName,
  toolTypeCode: mold.toolTypeCode,
  availableShotCount: mold.availableShotCount ?? null,
  statusCode: mold.statusCode,
  isActive: mold.isActive,
});

export const toWorkOrderWorkerFact = (worker: Worker): WorkOrderWorkerFact => ({
  workerId: worker.workerId,
  workerNo: worker.workerNo,
  workerName: worker.workerName,
  businessUnitId: worker.businessUnitId,
  plantId: worker.plantId,
  departmentId: worker.departmentId ?? null,
  statusCode: worker.statusCode,
  isActive: worker.isActive,
});

const toPeopleToolList = <TSource, TFact>(
  response: { items: TSource[]; page: PageMeta },
  toFact: (item: TSource) => TFact,
): WorkOrderPeopleToolList<TFact> => ({
  items: response.items.map(toFact),
  page: response.page,
  truncated: response.page.total > response.items.length,
});

export const useWorkOrderMolds = (
  plantId: number | null,
  page: number,
): UseQueryResult<WorkOrderPeopleToolList<WorkOrderMoldFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderPeopleToolKeys.molds(plantId, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load molds.');
      }

      return toPeopleToolList(
        await runRequest(() =>
          client.GET('/mdm/molds', {
            params: { query: { plantId, toolTypeCode: 'MOLD', includeInactive: true, page } },
          }),
        ),
        toWorkOrderMoldFact,
      );
    },
  });
};

/**
 * 담당 작업자 선택지. 공장 작업자는 수백 명이라 한 쪽에 다 오지 않는다 —
 * 검색어가 있으면 계약의 `q`(사번·성명)로 다시 묻는다.
 */
export const useWorkOrderWorkers = (
  plantId: number | null,
  page: number,
  term = '',
): UseQueryResult<WorkOrderPeopleToolList<WorkOrderWorkerFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderPeopleToolKeys.workers(plantId, page, term),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load workers.');
      }

      return toPeopleToolList(
        await runRequest(() =>
          client.GET('/mdm/workers', {
            params: {
              query: {
                plantId,
                ...(term === '' ? {} : { q: term }),
                includeInactive: true,
                page,
                size: WORKER_PAGE_SIZE,
              },
            },
          }),
        ),
        toWorkOrderWorkerFact,
      );
    },
  });
};

/** 저장된 담당 작업자가 선택지 쪽에 없을 때 그 한 명의 이름을 푼다. */
export const useWorkOrderWorker = (
  workerId: number | null,
): UseQueryResult<WorkOrderWorkerFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderPeopleToolKeys.worker(workerId),
    enabled: workerId !== null,
    queryFn: async () => {
      if (workerId === null) {
        throw new Error('A worker is required to load the worker.');
      }

      const detail = await runRequest(() =>
        client.GET('/mdm/workers/{workerId}', { params: { path: { workerId } } }),
      );

      return toWorkOrderWorkerFact(detail.worker);
    },
  });
};
