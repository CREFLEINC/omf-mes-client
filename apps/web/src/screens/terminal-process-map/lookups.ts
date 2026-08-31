import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta } from './types';

/**
 * 이 화면이 푸는 참조 셋 — 공장 · 설비 · 공정.
 *
 * ⛔ **설치 위치는 열지 않는다** — 계약이 Location 조회에 창고를 필수로 요구해, 이 화면에서
 * 열려면 창고 고르기부터 얹어야 한다. 선택 항목이라 없어도 단말이 선다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.terminalProcessMap;

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
  if (lookup.truncated) return t.terminal.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  plants: ['terminal-process-map-lookups', 'plants'] as const,
  equipments: ['terminal-process-map-lookups', 'equipments'] as const,
  processes: ['terminal-process-map-lookups', 'processes'] as const,
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

/** 표에 더할 공정. **쓰지 않는 공정도 고를 수 있어야 한다** — 새로 여는 자리가 여기다. */
export const useProcessOptions = (): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.processes,
    queryFn: () => runRequest(() => client.GET('/mdm/processes', { params: { query: {} } })),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.processId),
        label: `${item.processCode} · ${item.processName}`,
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
