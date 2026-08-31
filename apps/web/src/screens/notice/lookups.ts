import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조 — 대상 작업지시 하나뿐이다.
 *
 * ⭐ **열린 작업지시만 낸다.** 이미 끝난 지시에 공지를 붙이면 볼 사람이 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.notice;

export interface LookupResult {
  entries: LookupEntry[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/** **실패가 잘림보다 앞선다** — 낡은 자료와 실패가 함께 참일 때 실패를 감추지 않는다. */
export const lookupNote = (lookup: LookupResult, failed: string): string | undefined => {
  if (lookup.isError) return failed;
  if (lookup.truncated) return t.form.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  workOrders: ['notice-lookups', 'work-orders'] as const,
};

export const useWorkOrderOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.workOrders,
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders', { params: { query: { open: true } } }),
      ),
  });
  const data = query.data;
  const page = data?.page;

  return {
    entries:
      data?.items?.map((item) => ({
        value: String(item.workOrderId),
        label: item.workOrderNo,
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    truncated: page !== undefined && isTruncated(page, data?.items?.length ?? 0),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
