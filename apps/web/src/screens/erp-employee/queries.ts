import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages } from '../../patterns/fetch-all-pages';
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
  plantId?: number;
  departmentId?: number;
  includeInactive?: boolean;
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
  /** 쪽 크기를 고른 때만 싣는다 — 고르지 않으면 서버 기본값. */
  size?: number;
}

export const workerKeys = {
  all: ['erp-employee'] as const,
  list: (query: WorkerListQuery) => ['erp-employee', 'list', query] as const,
  plants: ['erp-employee', 'lookup', 'plants'] as const,
  departments: ['erp-employee', 'lookup', 'departments'] as const,
};

export interface SelectOption {
  value: string;
  label: string;
}

const EMPTY_OPTIONS: SelectOption[] = [];

export const useWorkerList = (query: WorkerListQuery): UseQueryResult<WorkerListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: workerKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/mdm/workers', { params: { query } })),
  });
};

/*
 * 조건 줄의 공장 · 부서 선택지. users-roles/lookups.ts 와 같은 조회(`includeInactive=true`, 「코드 · 이름」)를
 * 이 화면이 따로 둔다 — 화면 슬라이스끼리 조회 파일을 나눠 쓰지 않는다. 퇴사자 행이 미사용 부서를 가리킬 수 있어
 * 미사용도 받고, 쪽에 잘려 고를 수 없는 값이 생기지 않게 끝까지 받는다.
 */
export const usePlantOptions = (): SelectOption[] => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: workerKeys.plants,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/plants', { params: { query: { includeInactive: true, page, size } } }),
        ),
      );
      return data.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
      }));
    },
  });
  return query.data ?? EMPTY_OPTIONS;
};

export const useDepartmentOptions = (): SelectOption[] => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: workerKeys.departments,
    queryFn: async () => {
      const data = await fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/mdm/departments', {
            params: { query: { includeInactive: true, page, size } },
          }),
        ),
      );
      return data.items.map((item) => ({
        value: String(item.departmentId),
        label: `${item.departmentCode} · ${item.departmentName}`,
      }));
    },
  });
  return query.data ?? EMPTY_OPTIONS;
};
