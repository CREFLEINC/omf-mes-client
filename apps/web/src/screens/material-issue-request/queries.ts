import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  toExistingRequestView,
  toShortageLineView,
  toWorkOrderView,
  type ExistingRequestListResult,
  type ShortageLineView,
  type WorkOrderListResult,
} from './types';

/**
 * 이 화면의 읽기 셋 — W/O 검색 · 소요 집계 · 기존 요청.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/** 한 번에 받아 둘 W/O 건수. 더 있으면 「검색어로 좁히세요」를 낸다. */
export const WORK_ORDER_SEARCH_SIZE = 50;

export const materialIssueRequestKeys = {
  all: ['material-issue-request'] as const,
  workOrders: (q: string) => ['material-issue-request', 'work-orders', q] as const,
  shortage: (workOrderId: number) => ['material-issue-request', 'shortage', workOrderId] as const,
  existingAll: ['material-issue-request', 'existing'] as const,
  existing: (workOrderId: number) => ['material-issue-request', 'existing', workOrderId] as const,
};

const fetchWorkOrders = async (client: Client, q: string): Promise<WorkOrderListResult> => {
  const data = await runRequest(() =>
    client.GET('/production/work-orders', {
      params: {
        query: {
          ...(q === '' ? {} : { q }),
          /* 실적 누계는 이 화면이 쓰지 않는다 — 켜면 줄마다 집계를 세게 된다. */
          withProgress: false,
          size: WORK_ORDER_SEARCH_SIZE,
        },
      },
    }),
  );

  return {
    items: data.items.map(toWorkOrderView),
    page: data.page,
  };
};

/**
 * 대상 W/O 검색.
 *
 * ⛔ **상태로 좁히지 않는다.** 스펙 §5-6 이 W/O 검색·선택을 항상 열어 두라고 적었고, `open=true`
 * 로 좁히면 아직 배포되지 않은 W/O 가 목록에서 사라진다 — 그 W/O 의 부족 자재를 미리 요청할
 * 길이 없어진다.
 *
 * **글자마다 찾지 않는다.** 확정된 검색어(`q`)만 받는다 — 확정 전에는 화면이 부르지 않는다.
 */
export const useWorkOrderSearch = (q: string): UseQueryResult<WorkOrderListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialIssueRequestKeys.workOrders(q),
    queryFn: () => fetchWorkOrders(client, q),
  });
};

/**
 * 소요·기출고·부족 — **한 호출이 표의 세 열을 다 채운다.**
 *
 * ⛔ **자재 명세(BOM)를 따로 조회하지 않는다**(요구서 §3-9 명시). 부족은 서버가 낸다
 * (공유계약 L-2) — 화면이 소요에서 기출고를 빼 다시 세지 않는다.
 *
 * **버튼을 눌러야 부른다.** W/O 를 고르는 것만으로는 부르지 않는다 — 사용자가 「불러오기」를
 * 눌러야 이미 손보던 줄이 갈릴 수 있다는 사실이 조작에 드러난다.
 */
export const useShortage = (
  workOrderId: number | null,
  enabled: boolean,
): UseQueryResult<ShortageLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialIssueRequestKeys.shortage(workOrderId ?? 0),
    enabled: enabled && workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('W/O 를 고르기 전에는 소요량을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/material-issue-requests/shortage', {
          params: { query: { workOrderId } },
        }),
      ).then((data) => data.items.map(toShortageLineView));
    },
  });
};

/**
 * 같은 W/O 앞으로 이미 발행된 요청.
 *
 * **실패하면 조용히 접는다** — 경고를 세우지 못했다는 이유로 발행을 막지 않는다. 스펙 §6 이
 * 애초에 중복을 막지 않는다고 적었으므로, 이 조회는 알림이지 관문이 아니다.
 */
export const useExistingRequests = (
  workOrderId: number | null,
): UseQueryResult<ExistingRequestListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: materialIssueRequestKeys.existing(workOrderId ?? 0),
    enabled: workOrderId !== null,
    queryFn: () => {
      if (workOrderId === null) {
        throw new Error('W/O 를 고르기 전에는 기존 요청을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/material-issue-requests', {
          params: { query: { workOrderId } },
        }),
      ).then((data) => ({
        items: data.items.map(toExistingRequestView),
        /*
         * ⚠ **건수는 쪽 길이가 아니라 전체다.** `size` 를 지정하지 않아 쪽 크기를 서버가 정하므로,
         * 첫 쪽 길이로 「N건」이라 말하면 요청이 쌓인 W/O 에서 **실제보다 적게** 단언하게 된다 —
         * 중복 경고가 이 화면의 목적 중 하나라 그 숫자가 어긋나면 경고의 값이 깎인다.
         */
        total: data.page.total,
      }));
    },
  });
};
