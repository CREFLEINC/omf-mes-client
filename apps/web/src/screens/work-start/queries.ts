import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { Terminal, WorkOrderListResponse, WorkSession, Worker } from './types';

/**
 * 이 화면이 부르는 조회.
 *
 * ```
 * GET /mdm/terminals/{terminalId}                 이 설비가 무엇인가 (equipmentId·Code·Name)
 * GET /production/work-orders                     작업지시 목록 (이 설비 / 전체)
 * GET /production/work-sessions?workOrderId&open  재개할 «열린» 세션 찾기
 * GET /mdm/workers?workerNo                       사번 확인 (공통 계약 · 귀속이지 인증이 아니다)
 * ```
 *
 * 단말 기능 구성(`/mdm/terminals/{terminalId}/processes`)은 판정이 붙어 있어 `gating.ts` 가
 * 따로 소유한다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(L-6). 갱신은 사람이 다시 시도할 때만 일어난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

const ALL_KEY = ['work-start'] as const;

export const workStartKeys = {
  all: ALL_KEY,
  terminal: (terminalId: number) => [...ALL_KEY, 'terminal', terminalId] as const,
  /**
   * 목록. **설비 축까지 키에 넣는다** — 「이 설비」와 「전체」는 다른 목록이고, 한 키로 묶으면
   * 「전체 보기」를 껐을 때 다른 설비의 지시가 그대로 남는다.
   */
  workOrders: (equipmentId: number | null) => [...ALL_KEY, 'work-orders', equipmentId] as const,
  openSession: (workOrderId: number) => [...ALL_KEY, 'open-session', workOrderId] as const,
  worker: (workerNo: string) => [...ALL_KEY, 'worker', workerNo] as const,
};

/** 한 번에 받아 볼 최대 건수. 1024×768 단말의 목록 구획에 담기는 만큼만 본다. */
export const LIST_SIZE = 20;

/**
 * 이 단말 한 건 — **「이 설비」의 출처다**(스펙 §8 미결 8 해소 · omf-mes#262).
 *
 * ⛔ **화면이 설비를 고르지 않는다.** 단말이 어느 설비에 붙어 있는지는 기준정보가 갖고 있고,
 * 계약이 `equipmentCode`·`equipmentName` 까지 함께 내려 준다 — 헤더가 「PRS-01 프레스 1호기」로
 * 그리는 데 왕복이 한 번 더 필요하지 않다.
 */
export const useTerminal = (terminalId: number | null): UseQueryResult<Terminal> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workStartKeys.terminal(terminalId ?? 0),
    enabled: terminalId !== null,
    queryFn: () => {
      if (terminalId === null) throw new Error('단말을 모르면 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/terminals/{terminalId}', { params: { path: { terminalId } } }),
      );
    },
  });
};

const fetchWorkOrders = (
  client: Client,
  equipmentId: number | null,
): Promise<WorkOrderListResponse> =>
  runRequest(() =>
    client.GET('/production/work-orders', {
      params: {
        query: {
          /*
           * ⭐ **상태 코드 문자열을 쓰지 않는다.** `open` 은 「배포됐고 아직 완료·마감·취소되지
           *    않음」을 **서버가 시각 필드로** 판정하는 축이라, 값 목록이 확정되지 않은 지금도
           *    선다(요구서 §3-10 · omf-mes#271). 배포 대기와 중단 중이 함께 온다.
           *
           * ⛔ **응답을 화면이 걸러서는 성립하지 않는다** — 목록이 쪽 단위라 쪽 «안에서만»
           *    걸러진다. 두 조건 모두 서버에 싣는다.
           */
          open: true,
          /* 「전체 보기」는 이 축만 뺀다 — 다른 조건은 그대로다(§5-5). */
          ...(equipmentId === null ? {} : { plannedEquipmentId: equipmentId }),
          size: LIST_SIZE,
        },
      },
    }),
  );

/**
 * 작업지시 목록. `equipmentId` 가 `null` 이면 **전체 보기**다.
 *
 * ⚠ 설비를 아직 모르는 채로 기본 목록을 열지 않는다 — 축 없이 물으면 「이 설비 배포분」이라고
 * 그린 화면에 다른 설비의 지시가 실린다. 그 상태는 화면이 사유와 함께 말하고, 사용자가
 * 「전체 보기」를 골라야 열린다.
 */
export const useWorkOrders = (
  equipmentId: number | null,
  enabled: boolean,
): UseQueryResult<WorkOrderListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workStartKeys.workOrders(equipmentId),
    enabled,
    queryFn: () => fetchWorkOrders(client, equipmentId),
  });
};

/**
 * 재개할 세션 — **열려 있는 세션 하나**를 찾는다.
 *
 * ⛔ **재개는 새 세션을 열지 않는다**(스펙 §5-4 · 통지 #556). 중단해도 세션은 열려 있고
 * (`endedAt` 이 비어 있다) 재개는 같은 세션 안의 사건이라, 사건을 적재할 `workSessionId` 가
 * 필요하다. 그 식별자를 얻는 축이 `open=true` 다(회신 omf-mes#271).
 *
 * ⚠ **못 찾으면 재개하지 않는다.** 「중단 중인데 열린 세션이 없다」는 화면이 지어낼 수 없는
 * 상태다 — 새 세션을 열어 메우면 중단 구간이 사라진다.
 */
export const useOpenSession = (
  workOrderId: number | null,
  enabled: boolean,
): UseQueryResult<WorkSession | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workStartKeys.openSession(workOrderId ?? 0),
    enabled: enabled && workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) throw new Error('작업지시를 모르면 세션을 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/production/work-sessions', {
          params: { query: { workOrderId, open: true, page: 1, size: 2 } },
        }),
      );

      return data.items[0] ?? null;
    },
  });
};

/**
 * 사번 확인 — **존재와 재직만 본다.** 이 화면도 인증이 아니라 **귀속**이다(공유계약 D-5).
 *
 * ⭐ `includeInactive` 를 켠다 — 끄면 퇴사자가 「미등록」과 같은 모양(0건)으로 와서 문구가
 * 뒤바뀐다. 둘은 사용자가 할 일이 다르다.
 *
 * ⛔ **누르기 전에는 부르지 않는다** — 치는 동안 매 글자마다 조회하면 아직 다 치지도 않은
 * 사번으로 「등록되지 않았다」가 뜬다.
 */
export const useWorkerLookup = (workerNo: string | null): UseQueryResult<Worker[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workStartKeys.worker(workerNo ?? ''),
    enabled: workerNo !== null,
    queryFn: async () => {
      if (workerNo === null) throw new Error('사번 없이 조회하지 않습니다.');

      const data = await runRequest(() =>
        client.GET('/mdm/workers', {
          params: {
            query: { workerNo: workerNo.trim(), includeInactive: true, page: 1, size: 2 },
          },
        }),
      );

      return data.items;
    },
  });
};
