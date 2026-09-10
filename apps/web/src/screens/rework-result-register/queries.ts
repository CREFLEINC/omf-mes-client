import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { REWORK_WORK_ORDER_TYPE_CODE } from './result';

export const reworkResultKeys = {
  list: ['rework-result-register', 'work-orders'] as const,
  source: (id: number) => ['rework-result-register', 'source', id] as const,
  dispositions: (id: number) => ['rework-result-register', 'dispositions', id] as const,
  sourceLot: (id: number) => ['rework-result-register', 'source-lot', id] as const,
  gate: (terminalId: number, processId: number) =>
    ['rework-result-register', 'gate', terminalId, processId] as const,
};

export const useReworkWorkOrders = (page = 1) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: [...reworkResultKeys.list, page],
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: { workOrderTypeCode: REWORK_WORK_ORDER_TYPE_CODE, open: true, page, size: 20 },
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

/**
 * 원 LOT 한 건 — **번호와 초기 수량**을 받는다.
 *
 * 스펙 §3 ①이 이 줄을 「원 LOT  FG-…-0288  160 EA」로 그린다. 작업지시가 주는 것은
 * `reworkSourceLotId`(숫자)뿐이라 **번호를 그대로 보이면 작업자가 실물 라벨과 대조할 수 없다.**
 */
export const useReworkSourceLot = (lotId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reworkResultKeys.sourceLot(lotId ?? 0),
    enabled: lotId !== null,
    queryFn: () => {
      if (lotId === null) throw new Error('원 LOT 이 없습니다.');
      return runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }));
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
