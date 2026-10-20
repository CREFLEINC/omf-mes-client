import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * 사원정보 조회 (ERP)의 읽기. 경로 리터럴은 이 파일에만 둔다 —
 * `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 쓰기 경로는 없다. 작업자 본체는 전부 ERP 수신본이다.
 */

export type Worker = components['schemas']['Worker'];
export type PageMeta = components['schemas']['PageMeta'];

export interface WorkerListResult {
  items: Worker[];
  page: PageMeta;
}

/** 값이 있을 때만 키가 실린다 — 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽힌다. */
export interface WorkerListQuery {
  q?: string;
  includeInactive?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

export const workerKeys = {
  all: ['erp-employee'] as const,
  list: (query: WorkerListQuery) => ['erp-employee', 'list', query] as const,
  detail: (id: number | null) => ['erp-employee', 'detail', id] as const,
};

export const useWorkerList = (query: WorkerListQuery): UseQueryResult<WorkerListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/mdm/workers', { params: { query } })),
  });
};

/** 사원 상세. 고르기 전에는 조회하지 않는다 — 들어오기만 해도 부르면 쓰지 않는 요청이 나간다. */
export const useWorkerDetail = (id: number | null): UseQueryResult<Worker> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.detail(id),
    enabled: id !== null,
    queryFn: async () => {
      if (id === null) {
        throw new Error('사원을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/workers/{workerId}', { params: { path: { workerId: id } } }),
      );

      // 편집 가능 여부(editability)는 쓰지 않는다 — 이 화면에는 쓰기가 없다.
      return data.worker;
    },
  });
};
