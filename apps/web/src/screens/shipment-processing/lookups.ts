import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

/**
 * FK로 이어진 값을 채우는 선택 목록·이름 풀이 — 거래처(고객·운송사)·작업자(상차담당).
 *
 * `item-extended-attrs/lookups.ts`의 `LookupResult` 관용구를 따른다. 전부
 * `includeInactive=true`(거래처·작업자) 한 번으로 받아 두고 표시 규칙은 화면이 정한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const LOOKUP_PAGE_SIZE = 200;

export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참 — 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: { total: number }, shown: number): boolean => page.total > shown;

const lookupKeys = {
  partners: ['shipment-processing-lookups', 'partners'] as const,
  workers: ['shipment-processing-lookups', 'workers'] as const,
};

/** 거래처 — 고객명 표시와 운송사 선택지를 함께 낸다(둘 다 같은 자원이다). */
export const usePartnerLookup = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.partners,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/partners', {
          params: { query: { includeInactive: true, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.partnerId),
        label: `${item.partnerCode} · ${item.partnerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 작업자 — 상차담당 선택지. */
export const useWorkerLookup = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.workers,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/workers', {
          params: { query: { includeInactive: true, page: 1, size: LOOKUP_PAGE_SIZE } },
        }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.workerId),
        label: `${item.workerNo} · ${item.workerName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
  };
};

/** 값을 이름으로 풀어낸다. 찾지 못하면 `null` — 화면이 「알 수 없음」으로 낼지는 화면이 정한다. */
export const lookupLabel = (
  entries: readonly LookupEntry[],
  value: number | null,
): string | null => {
  if (value === null) return null;

  return entries.find((entry) => entry.value === String(value))?.label ?? null;
};
