import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { departmentKeys } from './department-queries';
import type { LookupEntry, PageMeta } from './types';

/**
 * FK로 이어진 값을 채우는 선택 목록. **지어내는 것이 아니라 실제로 조회한다** —
 * 자리표시로 두는 것은 값 목록이 확정되지 않은 코드뿐이다.
 *
 * 전부 `includeInactive=true`로 한 번 받아 두고 표시 규칙은 화면이 정한다.
 * 기본 조회는 사용 중인 것만 내려주므로, 미사용 값을 참조하는 행을 열면 이름이 비어 보인다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다 */
  truncated: boolean;
  /** 조회가 실패했으면 참. 실패를 삼키면 선택칸이 이유 없이 비어 보인다 */
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 서버가 보낸 전체 건수가 받은 건수보다 많으면 잘린 것이다. */
const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

const lookupKeys = {
  businessUnits: ['common-code-lookups', 'business-units'] as const,
  plants: ['common-code-lookups', 'plants'] as const,
  processes: ['common-code-lookups', 'processes'] as const,
};

/** 사업부 — 부서 필터·부서 폼·작업자 상세의 사업부 이름. */
export const useBusinessUnitOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.businessUnits,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/business-units', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.businessUnitId),
        label: `${item.businessUnitCode} · ${item.businessUnitName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/**
 * 부서 전체 — 상위 부서 선택지와 작업자 필터·작업자 상세의 부서 이름이 함께 쓴다.
 *
 * **좌 목록의 조회와 별개다.** 쪽 나눔 때문에 상위 부서가 다른 쪽에 있을 수 있어
 * 보이는 목록만으로는 상위를 고를 수 없다. 캐시 키도 목록과 갈라 둔다.
 */
export const useDepartmentOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: departmentKeys.options,
    // 쓰지 않는 탭·상태에서 부르면 좌 목록 조회와 섞여 어느 요청이 무엇인지 가릴 수 없다.
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/departments', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.departmentId),
        label: `${item.departmentCode} · ${item.departmentName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 공장 — 작업자 상세의 공장 이름. 필터로는 쓰지 않는다(§4.2). */
export const usePlantOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.plantId),
        label: item.plantName,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 공정 — 자격 편집 창의 공정 선택지. 비우면 「전체 공정」이 정상 값이다. */
export const useProcessOptions = (enabled: boolean): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.processes,
    enabled,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/processes', { params: { query: { includeInactive: true } } }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.processId),
        label: item.processName,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};
