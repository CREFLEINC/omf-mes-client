import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toWorkerListQuery } from './filters';
import type { PageMeta, ScopedFilters, Worker } from './types';

type WorkerDetailResponse = components['schemas']['WorkerDetailResponse'];
type WorkerQualificationListResponse = components['schemas']['WorkerQualificationListResponse'];

/**
 * 작업자의 조회와 캐시 키.
 *
 * **`etagPath`가 없다.** `GET /mdm/workers/{id}`가 `ETag`를 아예 주지 않는다(계약 실측) —
 * 그래서 이 파일에 상세 경로를 만드는 함수를 두지 않는다. 자격 치환에 그 경로를 주면
 * 토큰을 찾지 못해 **요청이 나가지 않고 멈춘다**(「저장을 눌러도 아무 일이 없다」).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface WorkerListResponse {
  items: Worker[];
  page: PageMeta;
}

export const workerKeys = {
  all: ['common-code-workers'] as const,
  list: (filters: ScopedFilters, page: number) =>
    ['common-code-workers', 'list', filters, page] as const,
  detail: (workerId: number) => ['common-code-workers', 'detail', workerId] as const,
  qualifications: (workerId: number) =>
    ['common-code-workers', 'qualifications', workerId] as const,
};

/**
 * 자격 목록 조회 경로. `PUT` 저장의 `etagPath`가 이 문자열과 정확히 같아야
 * `useMasterWrite`가 이 조회로 잡힌 토큰을 찾는다(client#602 — 이 경로의 `GET` 200 응답에
 * `ETag`가 신설됐다).
 */
export const workerQualificationsPath = (workerId: number): string =>
  `/mdm/workers/${String(workerId)}/qualifications`;

/**
 * 작업자 목록. 조건은 서버로 보낸다.
 *
 * **`plantId`·`businessUnitId`를 보내지 않는다** — 그 필터를 만들지 않았고,
 * 화면에 없는 조건을 요청에 실으면 사용자가 되돌릴 수단이 없다.
 */
export const useWorkerList = (
  filters: ScopedFilters,
  page: number,
  enabled: boolean,
): UseQueryResult<WorkerListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.list(filters, page),
    // 다른 탭에 있는 동안에는 조회하지 않는다.
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/workers', { params: { query: toWorkerListQuery(filters, page) } }),
      ),
  });
};

/**
 * 작업자 상세. **응답에 `ETag`가 없다** — 낙관적 잠금이 걸리는 쓰기가 이 자원에 없기 때문이다.
 * 계약에 `POST /mdm/workers`도 `PUT /mdm/workers/{id}`도 없다.
 */
export const useWorkerDetail = (workerId: number | null): UseQueryResult<WorkerDetailResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.detail(workerId ?? 0),
    enabled: workerId !== null,
    queryFn: () => {
      if (workerId === null) {
        throw new Error('작업자를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/workers/{workerId}', { params: { path: { workerId } } }),
      );
    },
  });
};

/**
 * 자격·인증 목록. **쪽 나눔이 없다**(`items`만 오고 `page`가 없다 — 계약 실측).
 * 그래서 자격 표에 쪽 이동을 두지 않는다.
 *
 * 이 응답의 `ETag`가 저장(`PUT`)의 `If-Match`를 채운다(client#602) —
 * `workerQualificationsPath`가 그 경로 문자열을 낸다.
 */
export const useWorkerQualifications = (
  workerId: number | null,
): UseQueryResult<WorkerQualificationListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.qualifications(workerId ?? 0),
    enabled: workerId !== null,
    queryFn: () => {
      if (workerId === null) {
        throw new Error('작업자를 고르기 전에는 자격을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/mdm/workers/{workerId}/qualifications', { params: { path: { workerId } } }),
      );
    },
  });
};
