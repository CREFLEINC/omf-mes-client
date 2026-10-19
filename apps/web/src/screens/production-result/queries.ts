import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InspectionRequest, Lot, WorkOrder } from './types';

/**
 * 이 화면이 쓰는 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */
export const productionResultKeys = {
  all: ['production-result'] as const,
  workOrder: (workOrderId: number) => ['production-result', 'work-order', workOrderId] as const,
  lots: (workOrderId: number) => ['production-result', 'lots', workOrderId] as const,
  pqc: (workOrderId: number) => ['production-result', 'pqc', workOrderId] as const,
};

/** 서버가 인라인으로 낼 수 있는 오류를 이 화면의 어느 칸에 놓을지. 없는 칸은 적지 않는다. */
export const SAVE_FIELDS = ['goodQty', 'remarks'] as const;

/** PQC 대기 조회의 검사 유형. 요구서 §3-12 가 이 값을 그대로 적었다. */
const PQC_TYPE_CODE = 'PQC';
/** 취소된 의뢰는 검사 on 으로 세지 않는다. */
const CANCELLED = 'CANCELLED';

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

/**
 * 이 작업지시의 PQC 의뢰 — **검사 on/off 의 기준**이다(omf-all-around#107 · 사용자 결정 2026-10-19).
 *
 * 「생산 실적 등록 화면은 검사가 on 이면 무조건 PQC 검사 UI 와 같이, off 면 실적만」. 검사 on = 그 W/O 에 취소되지
 * 않은 PQC 의뢰가 있다(라우팅 검사 공정이면 배포가 만든다 · 서버 P-32). 대기·진행·확정 어느 상태든 분할한다 —
 * 확정 뒤에는 패널이 확정 결과를 읽기 전용으로 보인다. 여럿이면 가장 최근 의뢰다. 없으면 `null`.
 *
 * ⛔ 의뢰를 «만들지» 않는다 — 생성 경로가 계약에 없고 서버가 만든다(요구서 §3-12).
 */
export const useWorkOrderPqc = (
  workOrderId: number | null,
): UseQueryResult<InspectionRequest | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionResultKeys.pqc(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: async (): Promise<InspectionRequest | null> => {
      if (workOrderId === null) {
        throw new Error('작업지시를 모르면 검사 의뢰를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/quality/inspection-requests', {
          params: { query: { workOrderId, inspectionTypeCode: PQC_TYPE_CODE } },
        }),
      );

      const live = data.items.filter((request) => request.statusCode !== CANCELLED);
      return live.sort((a, b) => b.inspectionRequestId - a.inspectionRequestId)[0] ?? null;
    },
  });
};
