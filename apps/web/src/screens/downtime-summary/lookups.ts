import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 조건 줄이 푸는 참조 셋 — 공장 · 설비 그룹 · 설비.
 *
 * ⭐ **설비 목록은 고른 공장으로 좁힌다.** 좁히지 않으면 다른 공장의 설비가 목록에 섞이고,
 * 그것을 고르면 공장 조건과 어긋나는 요청이 나간다. 그룹 목록도 같다.
 *
 * `includeInactive`를 켜지 않는다 — 이것은 **고르는 목록**이지 과거 자료를 푸는 목록이 아니다.
 *
 * 셋을 독립 조회로 두는 이유는 캐시 키를 갈라 한쪽 재시도가 다른 쪽에 번지지 않게 하기 위해서다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.downtimeSummary;

export interface LookupResult {
  entries: LookupEntry[];
  /** 목록이 잘렸으면 참. 고를 수 없는 값이 생겼다는 뜻이다. */
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;

/**
 * 선택칸 아래에 붙일 안내.
 *
 * **실패가 잘림보다 앞선다** — 첫 조회가 잘린 목록을 주고 다시 부르기가 실패하면 낡은 자료와
 * 실패가 함께 참이 된다. 그때 「일부만 보인다」고만 말하면 목록이 낡았다는 사실이 가려진다.
 */
export const lookupNote = (lookup: LookupResult, name: string): string | undefined => {
  if (lookup.isError) return t.filters.lookupFailed(name);
  if (lookup.truncated) return t.filters.lookupTruncated(name);

  return undefined;
};

export const lookupKeys = {
  plants: ['downtime-summary-lookups', 'plants'] as const,
  equipmentGroups: (plantId: number | undefined) =>
    ['downtime-summary-lookups', 'equipment-groups', plantId ?? null] as const,
  equipments: (plantId: number | undefined) =>
    ['downtime-summary-lookups', 'equipments', plantId ?? null] as const,
};

export const usePlantOptions = (): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.plants,
    queryFn: () => runRequest(() => client.GET('/mdm/plants', { params: { query: {} } })),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.plantId),
        label: `${item.plantCode} · ${item.plantName}`,
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

export const useEquipmentGroupOptions = (plantId: number | undefined): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.equipmentGroups(plantId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipment-groups', {
          params: { query: plantId === undefined ? {} : { plantId } },
        }),
      ),
  });

  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.equipmentGroupId),
        label: `${item.groupCode} · ${item.groupName}`,
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

export const useEquipmentOptions = (plantId: number | undefined): LookupResult => {
  const { client } = useApiClient();

  const query = useQuery({
    queryKey: lookupKeys.equipments(plantId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/equipments', {
          params: { query: plantId === undefined ? {} : { plantId } },
        }),
      ),
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
