import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조 넷 — 설비 · 수행자 · 예비품 마스터 · **이미 만들어진 출고 건**.
 *
 * ⛔ **출고 건은 고르기만 한다.** 물류가 만든 것을 가리키는 목록이고, 이 화면이 만드는 길은
 * 없다(설계가 「만들지 않는다」로 정했다).
 *
 * ⚠ **예비품 마스터에 규격·재고 기준이 아직 없다** — 코드와 명칭뿐이다. 그 사실을 폼에 적는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.maintenanceResult;

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
export const lookupNote = (lookup: LookupResult, name: string): string | undefined => {
  if (lookup.isError) return t.form.lookupFailed(name);
  if (lookup.truncated) return t.form.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  equipments: ['maintenance-result-lookups', 'equipments'] as const,
  users: ['maintenance-result-lookups', 'users'] as const,
  spareParts: ['maintenance-result-lookups', 'spare-parts'] as const,
  goodsIssues: ['maintenance-result-lookups', 'goods-issues'] as const,
  orders: ['maintenance-result-lookups', 'orders'] as const,
};

export const useEquipmentOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.equipments,
    queryFn: () => runRequest(() => client.GET('/mdm/equipments', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.equipmentId),
        label: `${item.equipmentCode} · ${item.equipmentName}`,
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

export const useSparePartOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.spareParts,
    queryFn: () => runRequest(() => client.GET('/mdm/spare-parts', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.sparePartId),
        /* ⚠ 규격·재고 기준이 마스터에 아직 없다 — 코드와 명칭뿐이다. */
        label: `${item.sparePartCode} · ${item.sparePartName}`,
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

/** 이미 만들어진 출고 건. ⛔ 여기서 만들지 않는다 — 가리키기만 한다. */
export const useGoodsIssueOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.goodsIssues,
    queryFn: () =>
      runRequest(() => client.GET('/logistics/goods-issues', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.goodsIssueId),
        label: item.goodsIssueNo,
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    /* 계약이 이 목록의 쪽 정보를 선택으로 두었다 — 오지 않으면 받은 것이 전부로 본다. */
    truncated: data?.page !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

/** 보전 지시 — 실적이 이어받을 대상이다. ⭐ 지시 없이도 실적이 성립한다. */
export const useOrderOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.orders,
    queryFn: () => runRequest(() => client.GET('/maintenance/orders', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.maintenanceOrderId),
        label: item.maintenanceOrderNo ?? String(item.maintenanceOrderId),
        isActive: true,
      })) ?? EMPTY_ENTRIES,
    /* 계약이 이 목록의 쪽 정보를 선택으로 두었다 — 오지 않으면 받은 것이 전부로 본다. */
    truncated: data?.page !== undefined && isTruncated(data.page, data.items.length),
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
