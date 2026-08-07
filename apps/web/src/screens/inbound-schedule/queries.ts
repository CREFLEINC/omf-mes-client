import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { AsnFilterQuery } from './filters';
import type { PeriodQuery } from './period';
import { toAsnLineView, toAsnView, type AsnLineView, type AsnListResult } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 둘뿐이다.**
 *
 * 계약에는 상세(`GET /logistics/asns/{asnId}`)도 있으나 **부르지 않는다.** 상세가 주는
 * `{asn, lines}` 중 `asn`은 목록 응답의 행에 이미 들어 있어, 상세를 부르면 같은 값을 한 번 더 받는다.
 * 한 건을 고르면 라인 경로만 부른다 — 요청 1회다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **쓰기 오퍼레이션이 없다.** ERP 수신본이라 계약 자체에 등록·수정·삭제가 없다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`는 싣지 않는다. 서버 기본값을 그대로 쓰고 쪽 크기를 화면이 정하지 않는다.
 */
export type AsnListQuery = PeriodQuery &
  AsnFilterQuery & {
    /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
    page?: number;
  };

export const asnKeys = {
  all: ['asns'] as const,
  list: (query: AsnListQuery | null) => ['asns', 'list', query] as const,
  lines: (asnId: number | null) => ['asns', 'lines', asnId] as const,
};

const fetchAsns = async (client: Client, query: AsnListQuery): Promise<AsnListResult> => {
  const data = await runRequest(() => client.GET('/logistics/asns', { params: { query } }));

  return { items: data.items.map(toAsnView), page: data.page };
};

/**
 * 입하 예정 목록.
 *
 * **조건이 하나도 없어도 조회한다**(`query`가 빈 객체여도 부른다). 이 경로는 파티션 테이블이
 * 아니라 기간이 필수가 아니다(이슈 #20 §6) — 「기간이 없으면 조회하지 않는다」 가드를 두면
 * 빈 화면으로 시작하게 되고, 기간이 필수가 아니라는 사실이 화면에서 사라진다.
 *
 * `null`은 **보내면 반드시 400이 되는 기간**에서만 온다(없는 날짜·뒤집힌 기간).
 * 그때는 조회하지 않고 조건 줄이 사유를 밝힌다.
 */
export const useAsnList = (query: AsnListQuery | null): UseQueryResult<AsnListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: asnKeys.list(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('보낼 수 없는 기간에서는 목록을 조회하지 않습니다.');
      }

      return fetchAsns(client, query);
    },
  });
};

const fetchAsnLines = async (client: Client, asnId: number): Promise<AsnLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/asns/{asnId}/lines', { params: { path: { asnId } } }),
  );

  return data.items.map(toAsnLineView);
};

/**
 * 고른 건의 라인.
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 건을 다시 그려도
 * 요청이 한 번을 넘지 않는다 — 렌더마다 부르면 표를 훑는 동안 요청이 계속 나간다.
 */
export const useAsnLines = (asnId: number | null): UseQueryResult<AsnLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: asnKeys.lines(asnId),
    enabled: asnId !== null,
    queryFn: () => {
      if (asnId === null) {
        throw new Error('건을 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchAsnLines(client, asnId);
    },
  });
};
