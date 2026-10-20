import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import type { InboundScheduleListResult, InboundScheduleQuery } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 하나뿐이다**(`GET /logistics/purchase-order-lines`).
 *
 * 라인마다 헤더 칸(발주번호·공급사·납기)이 함께 실려 와 발주 상세·라인 경로를 따로 부르지 않는다.
 * **쓰기 오퍼레이션이 없다.** 입하 등록은 「자재 입고 처리」·「초과 입하 분리」가 한다.
 */

/**
 * ⚠ **생성 타입에 아직 없는 경로다**(omf-mes-server#749 · 장부 P-78 — 계약 사본에 없다). `openapi-fetch` 는 경로를
 * 리터럴 타입으로 요구해 그대로는 부를 수 없으므로, 이 경로 하나만 받는 모양으로 클라이언트를
 * **좁혀 본다.** 실행은 같은 클라이언트가 한다 — 인증 쿠키·질의 직렬화·오류 정규화가 그대로 선다.
 *
 * 계약 사본이 `gen:api` 로 실리면 이 타입과 넓힘을 지우고 `client.GET` 을 바로 부른다.
 */
interface PurchaseOrderLinesClient {
  GET: (
    path: '/logistics/purchase-order-lines',
    init: { params: { query: InboundScheduleQuery } },
  ) => Promise<ApiCallResult<InboundScheduleListResult>>;
}

export const scheduleKeys = {
  all: ['inbound-schedule'] as const,
  list: (query: InboundScheduleQuery | null) => ['inbound-schedule', 'list', query] as const,
};

/**
 * 입하 예정 목록.
 *
 * **조건이 하나도 없어도 조회한다** — 들어오자마자 「들어올 것」이 납기 순으로 보여야 한다.
 * 기본 조건(미완료만)은 서버 기본이라 질의에 싣지 않는다.
 *
 * `null`은 **보내면 반드시 400이 되는 기간**에서만 온다(없는 날짜·뒤집힌 기간).
 * 그때는 조회하지 않고 조건 줄이 사유를 밝힌다.
 */
export const useInboundSchedule = (
  query: InboundScheduleQuery | null,
): UseQueryResult<InboundScheduleListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: scheduleKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('보낼 수 없는 기간에서는 목록을 조회하지 않습니다.');
      }

      const linesClient = client as unknown as PurchaseOrderLinesClient;

      return runRequest(() =>
        linesClient.GET('/logistics/purchase-order-lines', { params: { query } }),
      );
    },
  });
};
