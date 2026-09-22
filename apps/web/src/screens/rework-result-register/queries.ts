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
  defectCodes: ['rework-result-register', 'defect-codes'] as const,
};

/**
 * 불량 코드 후보 — 불량 > 0 이면 하나를 골라야 한다(스펙 §5-3 · 사용자 지시 2026-09-17).
 *
 * ⚠ **고른 값은 아직 서버로 가지 않는다.** 실적 저장 요청(`ProductionResultCreate`)에 불량 코드
 *   칸이 없다 — 화면에서만 필수로 막는다(사용자 선택 2026-09-17). 서버가 칸을 열면 실어 보낸다.
 */
export const useReworkDefectCodes = () => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: reworkResultKeys.defectCodes,
    queryFn: () =>
      runRequest(() => client.GET('/quality/defect-codes', { params: { query: { size: 100 } } })),
  });
};

/**
 * 배포 전 재작업 지시의 상태. 품질 담당이 처분 판정에서 발행하면 이 상태로 선다
 * (omf-all-around#47) — 배포까지 해야 실적을 받는다.
 */
export const PLANNED_STATUS_CODE = 'PLANNED';

/**
 * 재작업 W/O 후보.
 *
 * ⭐ **배포된 것과 «아직 배포 전」것을 함께 보인다**(사용자 결정 2026-09-21). 발행은 품질
 * 담당이 하고 배포는 그 뒤 단계라, 배포된 것만 보이면 현장은 **지시가 났는지조차 모른다.**
 *
 * ⛔ **배포 전은 고를 수 없다.** 서버가 `PLANNED` 의 실적을 받지 않는다(선발행 슬롯이 없다).
 * 고르게 두면 수량까지 넣은 뒤 저장에서 막힌다 — 목록에서 표식으로만 알린다(화면의 몫).
 *
 * ⚠ **질의 축이 하나라 두 번 묻는다.** `open` 은 「배포됐고 안 끝났다」이고 `statusCode` 는
 * 한 값만 받는다. 두 답을 합치되 **쪽 나누기는 배포된 쪽을 따른다** — 배포 전은 건수가 적고,
 * 고를 수 없는 줄이 쪽을 밀어내면 정작 고를 것이 뒤로 넘어간다.
 */
export const useReworkWorkOrders = (page = 1) => {
  const { client } = useApiClient();
  const open = useQuery({
    queryKey: [...reworkResultKeys.list, 'open', page],
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: { workOrderTypeCode: REWORK_WORK_ORDER_TYPE_CODE, open: true, page, size: 20 },
          },
        }),
      ),
  });
  const planned = useQuery({
    queryKey: [...reworkResultKeys.list, 'planned'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', {
          params: {
            query: {
              workOrderTypeCode: REWORK_WORK_ORDER_TYPE_CODE,
              statusCode: PLANNED_STATUS_CODE,
              page: 1,
              size: 20,
            },
          },
        }),
      ),
  });

  return { open, planned };
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
