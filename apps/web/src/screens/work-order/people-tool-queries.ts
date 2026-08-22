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
  workers: (plantId: number | null, page: number) =>
    ['work-order-people-tools', 'workers', plantId, page] as const,
};

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

export const useWorkOrderWorkers = (
  plantId: number | null,
  page: number,
): UseQueryResult<WorkOrderPeopleToolList<WorkOrderWorkerFact>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderPeopleToolKeys.workers(plantId, page),
    enabled: plantId !== null,
    queryFn: async () => {
      if (plantId === null) {
        throw new Error('A plant is required to load workers.');
      }

      return toPeopleToolList(
        await runRequest(() =>
          client.GET('/mdm/workers', {
            params: { query: { plantId, includeInactive: true, page } },
          }),
        ),
        toWorkOrderWorkerFact,
      );
    },
  });
};
