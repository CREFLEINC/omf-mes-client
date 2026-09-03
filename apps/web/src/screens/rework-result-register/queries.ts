import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { REWORK_WORK_ORDER_TYPE_CODE } from './result';

export const reworkResultKeys = {
  list: ['rework-result-register', 'work-orders'] as const,
  source: (id: number) => ['rework-result-register', 'source', id] as const,
  dispositions: (id: number) => ['rework-result-register', 'dispositions', id] as const,
  gate: (terminalId: number, processId: number) =>
    ['rework-result-register', 'gate', terminalId, processId] as const,
};

export const useReworkWorkOrders = () => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reworkResultKeys.list,
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: { workOrderTypeCode: REWORK_WORK_ORDER_TYPE_CODE, open: true, size: 20 },
          },
        }),
      ),
  });
};

export const useReworkSource = (nonconformanceId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reworkResultKeys.source(nonconformanceId ?? 0),
    enabled: nonconformanceId !== null,
    queryFn: () => {
      if (nonconformanceId === null) throw new Error('원천 부적합이 없습니다.');
      return runRequest(() =>
        client.GET('/quality/nonconformances/{nonconformanceId}', {
          params: { path: { nonconformanceId } },
        }),
      );
    },
  });
};

export const useDispositionDecisions = (nonconformanceId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reworkResultKeys.dispositions(nonconformanceId ?? 0),
    enabled: nonconformanceId !== null,
    queryFn: () => {
      if (nonconformanceId === null) throw new Error('원천 부적합이 없습니다.');
      return runRequest(() =>
        client.GET('/quality/nonconformances/{nonconformanceId}/disposition-decisions', {
          params: { path: { nonconformanceId } },
        }),
      );
    },
  });
};

export const useResultGate = (terminalId: number | null, processId: number | null) => {
  const { client } = useApiClient();
  const identified = terminalId !== null && processId !== null;
  const query = useQuery({
    queryKey: reworkResultKeys.gate(terminalId ?? 0, processId ?? 0),
    enabled: identified,
    queryFn: async () => {
      if (terminalId === null || processId === null) return false;
      const data = await runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}/processes', {
          params: { path: { terminalId } },
        }),
      );
      return data.items.find((row) => row.processId === processId)?.canInputResult ?? false;
    },
  });
  return {
    allowed: identified && query.isSuccess && query.data === true,
    checking: identified && query.isPending,
    unavailable: query.isError,
    unidentified: !identified,
  };
};
