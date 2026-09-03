import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  defectWindow,
  toDispatchBody,
  toReturnBody,
  type DefectRecord,
  type RepairExecution,
  type RepairResult,
} from './repair';

export const repairKeys = {
  defects: (lotId: number | null) => ['repair-defects', lotId] as const,
  /*
   * 거르지 않은 전체와 한 LOT 의 것을 다른 이름으로 가른다. 하나로 두면 스캔 전의 null 이
   * 전체와 같은 이름이 되어, 이 LOT 의 것을 묻는 자리에 남의 건이 들어온다.
   */
  open: () => ['repair-open', 'all'] as const,
  openForLot: (lotId: number | null) => ['repair-open', 'lot', lotId ?? 'none'] as const,
};

/**
 * 이 LOT 에 달린 불량 기록.
 *
 * 처분 유형으로 거르지 않는다. 그 코드 문자열이 아직 확정 전이라, 지어내 실으면 값이 달라지는
 * 날 목록이 조용히 비고 화면은 불량이 없다고 말한다.
 */
export const useDefectRecords = (lotId: number | null): UseQueryResult<DefectRecord[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repairKeys.defects(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT을 찾기 전에는 불량을 조회하지 않습니다.');
      }

      const window = defectWindow(new Date());
      const data = await runRequest(() =>
        client.GET('/quality/defect-records', {
          params: {
            query: { lotId, detectedFrom: window.from, detectedTo: window.to },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 아직 닫히지 않은 수리 건.
 *
 * 상태 컬럼으로 거르지 않는다 - 반출 시각이 비어 있는 것이 곧 열린 건이고, 그 판정은 서버가
 * 한다. 목록이 쪽 단위라 받아 놓고 화면이 거르면 쪽 안에서만 걸러진다.
 */
export const useOpenRepairs = (): UseQueryResult<RepairExecution[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repairKeys.open(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/production/repair-executions', { params: { query: { open: true } } }),
      );

      return data.items;
    },
  });
};

/**
 * 스캔한 LOT 의 열린 수리 건.
 *
 * 스캔 전에는 묻지 않는다. 물으면 서버가 거르지 않은 전체를 주고, 그 자리에 남의 건이 들어와
 * 자동 선택으로 골라진다 - 스캔한 적 없이 반출이 열린다. 전체를 받는 조회와 이름도 가른다.
 */
export const useOpenRepairsForLot = (lotId: number | null): UseQueryResult<RepairExecution[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: repairKeys.openForLot(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT 을 스캔하기 전에는 열린 건을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/production/repair-executions', {
          params: { query: { open: true, lotId } },
        }),
      );

      return data.items;
    },
  });
};

export interface DispatchVariables {
  defect: DefectRecord;
  qty: string;
  workerNo: string;
  /*
   * 화면이 들고 있는 키. 여기서 만들면 재시도마다 값이 달라져 멱등키가 아무것도 막지 못한다 -
   * 서버가 기록한 뒤 응답이 유실되면 사람이 다시 누르고, 새 키라 같은 일이 한 번 더 일어난다.
   */
  idempotencyKey: string;
}

export interface ReturnVariables {
  repairExecutionId: number;
  result: RepairResult;
  workerNo: string;
  idempotencyKey: string;
}

/**
 * 수리 투입을 등록한다.
 *
 * 큐에 담지 않는다 - 이 화면은 연결이 있어야 서고, 담아 둔 투입은 반출할 때 서버에 없어
 * 왕복의 앞쪽을 찾지 못한다.
 */
export const useDispatchRepair = (): UseMutationResult<
  RepairExecution,
  Error,
  DispatchVariables
> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: ({ defect, qty, workerNo, idempotencyKey }: DispatchVariables) =>
      runRequest(() =>
        client.POST('/production/repair-executions', {
          params: {
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
          body: toDispatchBody(defect, qty, new Date().toISOString()),
        }),
      ),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['repair-open'] });
    },
  });
};

/** 수리 반출을 등록해 왕복을 닫는다. 반출 시각이 생기면 열린 목록에서 빠진다. */
export const useReturnRepair = (): UseMutationResult<RepairExecution, Error, ReturnVariables> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: ({ repairExecutionId, result, workerNo, idempotencyKey }: ReturnVariables) =>
      runRequest(() =>
        client.POST('/production/repair-executions/{repairExecutionId}:return', {
          params: {
            path: { repairExecutionId },
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
          body: toReturnBody(new Date().toISOString(), result),
        }),
      ),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['repair-open'] });
    },
  });
};
