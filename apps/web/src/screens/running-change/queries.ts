import type { ApiClient } from '@omf-mes/api-client';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toCurrentInputView, type CurrentInputView } from './types';

/**
 * 《현재 투입》 조회 — **교체 대상의 모집단**이다(스펙 §3).
 *
 * ⭐ **작업지시 축으로 읽는다.** 세션 축(`workSessionId`)이 계약에 있지만 세션은 없을 수
 * 있고(§5-4 — nullable), 세션으로 좁히면 **세션이 없을 때 교체 대상이 통째로 빈다.** 교체할
 * 부품은 작업지시에 매여 있지 세션에 매여 있지 않다 — 세션은 「어느 구간에서 했는가」일 뿐이다.
 *
 * ⛔ **`consumptionTypeCode`로 좁히지 않는다.** 값 목록이 확정 전이라 지어낸 값으로 좁히면
 * 목록이 **오류 없이 조용히** 빈다(계약 `x-internal-note` · omf-mes#252).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

export const runningChangeKeys = {
  all: ['running-change'] as const,
  currentInputs: (workOrderId: number) =>
    ['running-change', 'current-inputs', workOrderId] as const,
  changeReasons: ['running-change', 'change-reasons'] as const,
};

/**
 * 교체 사유 값이 사는 공통코드 그룹(스펙 §4-A · 공유계약 `G-32` 2026-09-03 등재).
 *
 * ⛔ **값을 화면이 지어내지 않는다** — 고객이 `W-06-06` 에서 운영 중에 채우는 갈래다
 * (`G-31` 마스터안전형). 화면이 하는 일은 받아서 보여 주는 것까지다.
 */
const CHANGE_REASON_GROUP_CODE = 'MATERIAL_CHANGE_REASON';

/** 사유는 한 화면에 다 보여야 한다 — 쪽을 넘기게 두지 않는다. */
const REASON_PAGE_SIZE = 100;

/**
 * 한 화면에 담을 투입 줄 수의 상한.
 *
 * 계약의 기본이 50이라 그대로 두면 51번째부터 **교체 대상 목록에서 조용히 사라진다** —
 * 고를 수 없는 것이 없는 것으로 보인다. 한 작업지시의 투입 건수가 이 상한을 넘는 일은
 * 현장 규모상 드물고, 넘으면 그때 페이지 이동을 세운다(전용 부품이 없다는 통지대로 조합으로).
 */
const PAGE_SIZE = 200;

const fetchCurrentInputs = async (
  client: Client,
  workOrderId: number,
): Promise<CurrentInputView[]> => {
  const data = await runRequest(() =>
    client.GET('/production/material-consumptions', {
      params: { query: { workOrderId, size: PAGE_SIZE } },
    }),
  );

  return data.items.map(toCurrentInputView);
};

export interface CurrentInputsResult {
  rows: CurrentInputView[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * 이 작업지시에 등록된 투입 전부.
 *
 * `workOrderId`가 `null`이면 부르지 않는다 — 주소에 작업지시가 없는 상태다.
 *
 * ⛔ **실패를 빈 목록으로 접지 않는다.** 「투입이 없다」로 보이면 작업자는 교체할 것이 없다고
 * 읽고 화면을 떠난다 — 실제로는 조회가 실패한 것이다.
 */
export const useCurrentInputs = (workOrderId: number | null): CurrentInputsResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: runningChangeKeys.currentInputs(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('작업지시 없이는 현재 투입을 조회하지 않습니다.');
      }

      return fetchCurrentInputs(client, workOrderId);
    },
  });

  /*
   * ⭐ **참조를 고정한다.** 화면이 「서버가 받아 준 건이 늘면 다시 읽는다」를 효과로 걸어
   * 두는데, 이 함수가 렌더마다 새 참조면 그 효과가 렌더마다 돌아 **단말이 조회를 쏟아 낸다.**
   */
  const { refetch } = query;
  const refetchRows = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    rows: query.data ?? [],
    isPending: workOrderId !== null && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: refetchRows,
  };
};

export interface ChangeReason {
  code: string;
  codeName: string;
}

export interface ChangeReasonsResult {
  reasons: ChangeReason[];
  isPending: boolean;
  isError: boolean;
}

/**
 * 교체 사유 선택지.
 *
 * ⭐ **「값 목록 미확정」이 아니다**(스펙 §8 미결 1 · 2026-09-03 판정). 값은 고객이 정하고
 * **받는 곳은 있다** — 그래서 칸을 잠가 두지 않고 조회해서 연다.
 *
 * ⚠ **비어서 올 수 있다.** 고객이 아직 채우지 않았으면 0건이 정상이고, 그때만 「고를 것이
 * 없다」로 잠근다(스펙 §6 · `G-2`). 사유는 `nullable` 이라 없이도 등록은 선다.
 */
export const useChangeReasons = (): ChangeReasonsResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: runningChangeKeys.changeReasons,
    queryFn: async (): Promise<ChangeReason[]> => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: CHANGE_REASON_GROUP_CODE,
              page: 1,
              size: REASON_PAGE_SIZE,
            },
          },
        }),
      );

      return data.items.map((item) => ({ code: item.code, codeName: item.codeName }));
    },
  });

  return {
    reasons: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
  };
};
