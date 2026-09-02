import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조 셋 — 설비 · 담당자(내부 사용자) · 점검·보전 항목 마스터.
 *
 * ⚠ **담당자는 내부 사용자만 가리킨다.** 외주 인력을 담을 칸이 없어(설계가 「만들지 않는다」로
 * 정했다) 그 사실을 폼에 적고 지시 내용으로 유도한다 — 목록을 늘려 흉내 내지 않는다.
 *
 * 셋을 독립 조회로 두어 캐시 키를 가른다 — 한쪽 재시도가 다른 쪽에 번지지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.maintenanceOrder;

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
  equipments: ['maintenance-order-lookups', 'equipments'] as const,
  users: ['maintenance-order-lookups', 'users'] as const,
  inspectionItems: ['maintenance-order-lookups', 'inspection-items'] as const,
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
        /* 계정은 `statusCode`로 살아 있음을 말한다 — `isActive`가 따로 없다. */
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

/**
 * 점검·보전 항목 마스터.
 *
 * ⭐ **설비 보전은 이 마스터를 반드시 가리킨다**(계약: 「부여가 없으면 발행할 수 없다」).
 * 그래서 목록이 비면 발행 자체가 막히고, 그 사실을 폼이 사유로 낸다.
 */
export const useInspectionItemOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.inspectionItems,
    queryFn: () =>
      runRequest(() => client.GET('/mdm/equipment-inspection-items', { params: { query: {} } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.equipmentInspectionItemId),
        label: `${item.itemCode} · ${item.itemName}`,
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
