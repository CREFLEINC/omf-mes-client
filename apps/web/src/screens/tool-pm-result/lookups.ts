import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조 셋 — 툴 · 수행자 · **이 툴의 열린 보전 오더**.
 *
 * ⭐ **오더 목록을 툴로 좁힌다.** 좁히지 않으면 다른 툴의 오더를 골라 마감하게 되고, 그
 * 마감은 되돌릴 수 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.toolPmResult;

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
  if (lookup.truncated) return t.tool.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  tools: ['tool-pm-result-lookups', 'tools'] as const,
  users: ['tool-pm-result-lookups', 'users'] as const,
  orders: (moldId: number | null) => ['tool-pm-result-lookups', 'orders', moldId ?? 0] as const,
};

export const useToolOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.tools,
    queryFn: () => runRequest(() => client.GET('/mdm/molds', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.moldId),
        label: `${item.moldCode} · ${item.moldName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

export const useUserOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.users,
    queryFn: () => runRequest(() => client.GET('/app/users', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.appUserId),
        label: `${item.loginId} · ${item.userName}`,
        isActive: item.statusCode === 'ACTIVE',
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** ⭐ **이 툴의** 오더만 낸다 — 다른 툴의 오더를 마감하면 되돌릴 수 없다. */
export const useOrderOptions = (moldId: number | null): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.orders(moldId),
    enabled: moldId !== null,
    queryFn: () => {
      if (moldId === null) {
        throw new Error('툴을 고르기 전에는 오더를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/maintenance/orders', {
          params: { query: { targetTypeCode: 'MOLD', targetId: moldId, statusCode: 'ISSUED' } },
        }),
      );
    },
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.maintenanceOrderId),
        label: item.maintenanceOrderNo ?? String(item.maintenanceOrderId),
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    truncated: data?.page !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
