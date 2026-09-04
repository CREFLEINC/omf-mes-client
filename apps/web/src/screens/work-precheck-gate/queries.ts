import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { PRECHECK_POLICY_CODE, UNRESOLVED_CONTROL_LEVEL, type ControlLevelCode } from './codes';
import { cycleWindowStart } from './cycle-window';
import type { PrecheckTarget } from './verdict';
import type {
  BreakdownListResponse,
  EquipmentInspectionItemAssignmentsResponse,
  InspectionListResponse,
  OperationPolicyEffective,
} from './types';

/**
 * 이 게이트가 부르는 조회.
 *
 * ```
 * GET /app/operation-policies/effective?policyCode=PRECHECK_CONTROL_LEVEL   통제 수준
 * GET /mdm/equipments/{equipmentId}/inspection-items                        무엇을 점검해야 하나
 * GET /maintenance/inspections?equipmentId&inspectionTypeCode&inspectedFrom 주기 내 최근 한 건
 * GET /maintenance/breakdowns?equipmentId&openOnly                          열린 고장 «건수»
 * ```
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(L-6). 갱신은 [ 다시 확인 ] 을 누를 때만 일어난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const ALL_KEY = ['work-precheck-gate'] as const;

export const precheckKeys = {
  all: ALL_KEY,
  policy: (plantId: number | null, processId: number | null) =>
    [...ALL_KEY, 'policy', plantId, processId] as const,
  assignments: (equipmentId: number) => [...ALL_KEY, 'assignments', equipmentId] as const,
  inspection: (equipmentId: number, inspectionTypeCode: string, from: string) =>
    [...ALL_KEY, 'inspection', equipmentId, inspectionTypeCode, from] as const,
  breakdowns: (equipmentId: number) => [...ALL_KEY, 'breakdowns', equipmentId] as const,
};

/**
 * 통제 수준. **범위 해석은 서버가 한다** — 화면이 우선순위를 다시 구현하지 않는다.
 *
 * ⚠ 범위 축을 비워 보내도 된다. 공장·공정을 아직 모르면 「지정 없음」으로 해석된다.
 */
export const usePrecheckPolicy = (
  plantId: number | null,
  processId: number | null,
  enabled: boolean,
): UseQueryResult<OperationPolicyEffective> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: precheckKeys.policy(plantId, processId),
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/operation-policies/effective', {
          params: {
            query: {
              policyCode: PRECHECK_POLICY_CODE,
              ...(plantId === null ? {} : { plantId }),
              ...(processId === null ? {} : { processId }),
            },
          },
        }),
      ),
  });
};

/**
 * 해석된 통제 수준.
 *
 * ⭐ **적용 정책이 없으면 `WARN` 이다**(계약 설명 · 스펙 §6). ⛔ 화면이 기본값을 지어내
 * 무통제로 여는 것이 아니다 — 계약이 그 방향을 정했다.
 *
 * ⚠ 값이 세 값 중 하나가 아니면 역시 `WARN` 으로 다룬다. 모르는 문자열을 「미적용」으로
 * 읽으면 **통제가 조용히 꺼진다.**
 */
export const toControlLevel = (policy: OperationPolicyEffective): ControlLevelCode => {
  if (!policy.resolved) return UNRESOLVED_CONTROL_LEVEL;

  const value = (policy.valueText ?? '').trim();

  return value === 'BLOCK' || value === 'WARN' || value === 'OFF'
    ? value
    : UNRESOLVED_CONTROL_LEVEL;
};

/**
 * 이 설비가 무엇을 점검해야 하는가 — **`effective` 를 읽는다.**
 *
 * 설비에 직접 부여가 있으면 그것, 없으면 소속 그룹의 것이 온다(공유계약 B-17). 서버가
 * 해석한 결과이므로 화면이 층을 다시 훑지 않는다.
 */
export const useInspectionAssignments = (
  equipmentId: number | null,
  enabled: boolean,
): UseQueryResult<EquipmentInspectionItemAssignmentsResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: precheckKeys.assignments(equipmentId ?? 0),
    enabled: enabled && equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) throw new Error('설비를 모르면 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/mdm/equipments/{equipmentId}/inspection-items', {
          params: { path: { equipmentId } },
        }),
      );
    },
  });
};

/** 판정에 쓸 유형 하나 — 부여를 유형별로 접은 결과다. */
export interface PrecheckTypeWindow {
  inspectionTypeCode: string;
  /** 이 유형의 주기 창 시작일. 같은 유형에 부여가 여럿이면 **가장 좁은 창**을 쓴다. */
  windowFrom: string;
}

/**
 * 부여 목록을 **유형별 주기 창**으로 접는다.
 *
 * ⚠ 한 유형에 항목이 여럿 부여돼 있고 주기가 서로 다를 수 있다. 그때는 **가장 늦게 시작하는
 * 창**(=가장 좁은 창)을 쓴다 — 넓은 쪽을 쓰면 짧은 주기 항목의 지난 점검이 오늘 것으로
 * 인정된다.
 *
 * ⛔ 비활성 부여는 세지 않는다.
 */
export const toTypeWindows = (
  response: EquipmentInspectionItemAssignmentsResponse | undefined,
  today: string,
): PrecheckTypeWindow[] => {
  if (response === undefined) return [];
  /* 부여가 어느 층에도 없으면 점검 대상이 아니다 — 빈 목록이 그 뜻이다. */
  if (response.resolvedFromLevelCode === 'NONE') return [];

  const windows = new Map<string, string>();

  for (const item of response.effective) {
    if (item.isActive === false) continue;

    const code = item.inspectionTypeCode.trim();

    if (code === '') continue;

    const from = cycleWindowStart(item, today);
    const previous = windows.get(code);

    if (previous === undefined || from > previous) windows.set(code, from);
  }

  return [...windows].map(([inspectionTypeCode, windowFrom]) => ({
    inspectionTypeCode,
    windowFrom,
  }));
};

/**
 * 유형마다 **주기 창 안의 가장 최근 한 건**.
 *
 * ⭐ 기본 정렬이 점검 시각 내림차순이라 `size=1` 이면 그 한 건이 온다(계약 설명 · §5-5).
 * ⚠ 기간은 조건부 필수다(공유계약 L-3) — 창의 시작일을 반드시 싣는다.
 */
export const useLatestInspections = (
  equipmentId: number | null,
  windows: readonly PrecheckTypeWindow[],
  enabled: boolean,
): {
  targets: PrecheckTarget[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
} => {
  const { client } = useApiClient();

  const results = useQueries({
    queries: windows.map((window) => ({
      queryKey: precheckKeys.inspection(
        equipmentId ?? 0,
        window.inspectionTypeCode,
        window.windowFrom,
      ),
      enabled: enabled && equipmentId !== null,
      queryFn: (): Promise<InspectionListResponse> => {
        if (equipmentId === null) throw new Error('설비를 모르면 조회하지 않습니다.');

        return runRequest(() =>
          client.GET('/maintenance/inspections', {
            params: {
              query: {
                equipmentId,
                inspectionTypeCode: window.inspectionTypeCode,
                inspectedFrom: window.windowFrom,
                sort: 'inspectedAtDesc' as const,
                page: 1,
                size: 1,
              },
            },
          }),
        );
      },
    })),
  });

  return {
    targets: results.map((result, index) => {
      const window = windows[index];
      const newest = result.data?.items?.[0];

      return {
        inspectionTypeCode: window?.inspectionTypeCode ?? '',
        windowFrom: window?.windowFrom ?? '',
        latest:
          newest === undefined
            ? null
            : {
                inspectionId: newest.inspectionId,
                inspectedAt: newest.inspectedAt,
                overallResultCode: newest.overallResultCode,
                workerNo: newest.inspectorWorkerNo,
              },
      };
    }),
    isPending: results.some((result) => result.isPending),
    isError: results.some((result) => result.isError),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/**
 * 열린 고장 **건수**.
 *
 * ⛔ **막지 않는다**(§5-6) — 통제 대상은 점검 이력이지 고장이 아니다. 보이기만 한다.
 * ⭐ 목록을 세지 않고 `page.total` 을 읽는다(공유계약 L-1) — 쪽 안의 건수는 전체가 아니다.
 */
export const useOpenBreakdownCount = (
  equipmentId: number | null,
  enabled: boolean,
): UseQueryResult<BreakdownListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: precheckKeys.breakdowns(equipmentId ?? 0),
    enabled: enabled && equipmentId !== null,
    queryFn: () => {
      if (equipmentId === null) throw new Error('설비를 모르면 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { equipmentId, openOnly: true, page: 1, size: 1 } },
        }),
      );
    },
  });
};
