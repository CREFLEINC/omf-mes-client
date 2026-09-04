import type { ApiClient, components, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import { toResultView, type ResultListResult } from './types';

/**
 * 이 화면의 오퍼레이션 — 목록 하나와 쓰기 하나.
 *
 * ⛔ **출고를 만드는 경로를 부르지 않는다.** 예비품 줄은 물류가 만든 출고 건을 **가리키기만**
 * 하고, 재고를 깎는 것은 물류의 일이다. 그래서 이 파일에 물류 쓰기 경로가 없다.
 *
 * ⛔ **설비 상태를 바꾸는 경로를 부르지 않는다.** 「지금 쓸 수 있는가」는 열린 보전 건이 없다로
 * 판정되며 자산 상태와 다른 축이다.
 *
 * ⚠ **누계 리셋을 보내지 않아 낙관적 잠금이 필요 없다.** 계약이 `resetCounter=true`일 때만
 * `If-Match`를 필수로 두었는데, 이 화면은 그 칸을 싣지 않는다 — 리셋은 툴 예방보전 실적의 몫이다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];
type MaintenanceResult = components['schemas']['MaintenanceResult'];
type MaintenanceResultCreate = components['schemas']['MaintenanceResultCreate'];

type ResultQueryParams = NonNullable<paths['/maintenance/results']['get']['parameters']['query']>;

export interface ResultListQuery {
  maintenanceOrderId?: number;
  /** 계약이 대상 유형을 두 값으로 닫았다(`EQUIPMENT`·`MOLD` · 코드 사전 2026-09-03) */
  targetTypeCode?: ResultQueryParams['targetTypeCode'];
  targetId?: number;
  startedFrom?: string;
  startedTo?: string;
  page?: number;
}

export const resultKeys = {
  all: ['maintenance-result'] as const,
  list: (query: ResultListQuery) => ['maintenance-result', 'list', query] as const,
};

const fetchList = async (client: Client, query: ResultListQuery): Promise<ResultListResult> => {
  const data = await runRequest(() => client.GET('/maintenance/results', { params: { query } }));

  return {
    items: data.items.map(toResultView),
    page: data.page ?? { page: query.page ?? 1, size: data.items.length, total: data.items.length },
  };
};

export const useResultList = (query: ResultListQuery): UseQueryResult<ResultListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: resultKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/** 화면이 소유한 입력칸 이름 — 오류를 그릴 자리가 있는 것만 넣는다. */
const KNOWN_FIELDS = [
  'targetId',
  'startedAt',
  'finishedAt',
  'resultNote',
  'performedByUserId',
  'outsourceVendorName',
] as const;

/**
 * 실적 등록.
 *
 * ⭐ 멱등 키 수명이 **`until-applied`**다. 실적은 지우는 경로가 없어(마감 전 수정만 있다)
 * 통신이 끊긴 뒤 다시 눌렀을 때 **같은 실적이 두 줄** 남으면 되돌릴 길이 마땅치 않다.
 * 본문이 있어 「값이 바뀌면 새 키」가 성립하므로 고쳐서 다시 보내는 길은 막히지 않는다.
 */
export const useResultCreate = (
  onSuccess: () => void,
): MasterWriteResult<MaintenanceResultCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<MaintenanceResultCreate, MaintenanceResult>({
    request: (body, headers) =>
      client.POST('/maintenance/results', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [resultKeys.all],
    knownFields: KNOWN_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
