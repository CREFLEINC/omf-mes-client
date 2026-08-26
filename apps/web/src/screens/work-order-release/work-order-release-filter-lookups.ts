import type { SelectItems } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type CodeValue = components['schemas']['CodeValue'];
type ProductionLine = components['schemas']['ProductionLine'];
type PageMeta = components['schemas']['PageMeta'];

const t = messages.workOrderRelease.filter;
const LOOKUP_PAGE_SIZE = 200;

export interface WorkOrderReleaseStatusValue {
  code: string;
  codeName: string;
  displayOrder: number;
  isActive: boolean;
}

export interface WorkOrderReleaseProductionLine {
  productionLineId: number;
  lineCode: string;
  lineName: string;
  isActive: boolean;
}

export interface WorkOrderReleaseLookupList<T> {
  items: T[];
  truncated: boolean;
}

export interface WorkOrderReleaseLookupSnapshot<T> {
  data: WorkOrderReleaseLookupList<T> | undefined;
  isError: boolean;
  isPending: boolean;
}

export interface WorkOrderReleaseFilterLookups {
  statusOptions: SelectItems;
  productionLineOptions: SelectItems;
  statusUnavailableReason: string | null;
  productionLineUnavailableReason: string | null;
}

export const WORK_ORDER_RELEASE_STATUS_GROUP = 'WORK_ORDER_STATUS';

export const workOrderReleaseFilterLookupKeys = {
  statusValues: ['work-order-release', 'filter-lookups', 'status-values'] as const,
  productionLines: ['work-order-release', 'filter-lookups', 'production-lines'] as const,
};

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

export const useWorkOrderReleaseStatusValues = (): UseQueryResult<
  WorkOrderReleaseLookupList<WorkOrderReleaseStatusValue>
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderReleaseFilterLookupKeys.statusValues,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: WORK_ORDER_RELEASE_STATUS_GROUP,
              includeInactive: false,
              page: 1,
              size: LOOKUP_PAGE_SIZE,
            },
          },
        }),
      );

      return {
        items: data.items.map((value: CodeValue) => ({
          code: value.code,
          codeName: value.codeName,
          displayOrder: value.displayOrder,
          isActive: value.isActive,
        })),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};

export const useWorkOrderReleaseProductionLines = (): UseQueryResult<
  WorkOrderReleaseLookupList<WorkOrderReleaseProductionLine>
> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workOrderReleaseFilterLookupKeys.productionLines,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/production-lines', {
          params: { query: { includeInactive: false, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      );

      return {
        items: data.items.map((line: ProductionLine) => ({
          productionLineId: line.productionLineId,
          lineCode: line.lineCode,
          lineName: line.lineName,
          isActive: line.isActive,
        })),
        truncated: isTruncated(data.page, data.items.length),
      };
    },
  });
};

const unavailableReason = <T>(
  snapshot: WorkOrderReleaseLookupSnapshot<T>,
  reasons: { loading: string; failed: string; truncated: string },
): string | null => {
  if (snapshot.isError) return reasons.failed;
  if (snapshot.isPending) return reasons.loading;
  if (snapshot.data?.truncated === true) return reasons.truncated;
  return null;
};

export const toWorkOrderReleaseFilterLookups = (
  status: WorkOrderReleaseLookupSnapshot<WorkOrderReleaseStatusValue>,
  productionLines: WorkOrderReleaseLookupSnapshot<WorkOrderReleaseProductionLine>,
): WorkOrderReleaseFilterLookups => ({
  statusOptions:
    status.data?.items
      .filter((value) => value.isActive)
      .slice()
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((value) => ({
        value: value.code,
        label: value.codeName.trim() === '' ? value.code : value.codeName,
      })) ?? [],
  productionLineOptions:
    productionLines.data?.items
      .filter((line) => line.isActive)
      .map((line) => ({
        value: String(line.productionLineId),
        label: `${line.lineCode} · ${line.lineName}`,
      })) ?? [],
  statusUnavailableReason: unavailableReason(status, {
    loading: t.statusLookupLoading,
    failed: t.statusLookupFailed,
    truncated: t.statusLookupTruncated,
  }),
  productionLineUnavailableReason: unavailableReason(productionLines, {
    loading: t.productionLineLookupLoading,
    failed: t.productionLineLookupFailed,
    truncated: t.productionLineLookupTruncated,
  }),
});
