import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ProcessDefectCode } from './defect-draft';
import type { Lot, WorkOrder } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const productionResultKeys = {
  all: ['production-result'] as const,
  workOrder: (workOrderId: number) => ['production-result', 'work-order', workOrderId] as const,
  lots: (workOrderId: number) => ['production-result', 'lots', workOrderId] as const,
  defectCodes: (processId: number) => ['production-result', 'defect-codes', processId] as const,
};

/** 한 공정에 매핑된 불량 코드는 수십 건이다 — 한 쪽에 다 받는다. */
const DEFECT_CODE_PAGE_SIZE = 200;

/**
 * 이 W/O 공정에 매핑된 불량 코드. 서버가 매핑으로 거르고, 저장 검증도 같은 기준이라 여기서 고른
 * 코드는 저장에서 통과한다.
 */
export const useProcessDefectCodes = (
  processId: number | null,
): UseQueryResult<ProcessDefectCode[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionResultKeys.defectCodes(processId ?? 0),
    enabled: processId !== null,
    queryFn: async () => {
      if (processId === null) throw new Error('공정을 모르면 불량 코드를 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/quality/defect-codes', {
          params: { query: { processId, page: 1, size: DEFECT_CODE_PAGE_SIZE } },
        }),
      );
      return data.items;
    },
  });
};

/** 서버가 인라인으로 낼 수 있는 오류를 이 화면의 어느 칸에 놓을지. 없는 칸은 적지 않는다. */
export const SAVE_FIELDS = ['goodQty', 'remarks'] as const;

/**
 * 작업지시 한 건 — **헤더의 W/O·품목과 잔여수량의 출처**.
 *
 * ⭐ **`withProgress` 를 켠다.** 잔여수량은 「지시 수량 − 양품 누계」인데 누계는 이 옵션이
 * 있을 때만 실려 온다. 켜지 않으면 `progress` 가 비어 오고, 그때는 **잔여를 모르는 것**이지
 * 0 인 것이 아니다.
 */
export const useWorkOrder = (workOrderId: number | null): UseQueryResult<WorkOrder> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionResultKeys.workOrder(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId }, query: { withProgress: true } },
        }),
      );
    },
  });
};

/**
 * 이 작업지시가 원천인 LOT 목록 — 좌단 《대상 LOT》.
 *
 * ⭐ **`workOrderId` 축이 정본이다.** 계약이 이 축의 설명에 「POP 의 실적 대상 LOT 선택
 * (`P-02-04` §5)」을 직접 적어 두었다.
 *
 * ⚠ **완료 여부로 좁히지 않는다.** 스펙이 그런 필터를 적은 적이 없고, 여기서 임의로 걸면
 * 설계가 승인한 적 없는 판단이 목록에 굳는다.
 */
export const useTargetLots = (workOrderId: number | null): UseQueryResult<Lot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionResultKeys.lots(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<Lot[]> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 대상 LOT 을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { workOrderId } } }),
      );

      return data.items;
    },
  });
};
