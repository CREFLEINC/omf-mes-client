import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { masterName } from '../../patterns/master-name';
import { runRequest } from '../../patterns/request';
import type { LookupEntry, PageMeta, SelectOption } from './types';

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
  error: unknown;
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
    error: query.error,
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
    error: query.error,
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
    error: query.error,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};

const CODE_PAGE_SIZE = 100;

interface CodeEntry {
  value: string;
  label: string;
  isActive: boolean;
}

const EMPTY_CODES: CodeEntry[] = [];

export interface CodeLookup {
  /** 코드 → 표시명. 못 찾으면 코드를 그대로 돌려준다. */
  nameOf: (code: string) => string;
  entries: readonly CodeEntry[];
}

/**
 * 단말 유형·운영 상태 코드 → 공통코드 표시명(TERMINAL_TYPE · TERMINAL_STATUS).
 *
 * 화면이 이름을 박지 않는다 — 값 목록의 정본은 공통코드다. 사용 중지 코드로 만든 단말도
 * 남아 있으므로 사용 중지 코드까지 받는다. 이름을 못 찾으면 코드를 그대로 돌려준다.
 */
const useCodeLookup = (groupCode: string): CodeLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['terminal-process-map', 'code-names', groupCode] as const,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: { codeGroupCode: groupCode, includeInactive: true, size: CODE_PAGE_SIZE },
          },
        }),
      );

      return [...data.items]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((value) => ({
          value: value.code,
          label: masterName(value, value.codeName),
          isActive: value.isActive,
        }));
    },
  });
  const entries = query.data ?? EMPTY_CODES;

  return {
    nameOf: (code) => entries.find((entry) => entry.value === code)?.label ?? code,
    entries,
  };
};

/**
 * 폼 선택지 — 사용 중인 코드만 고를 수 있다(공통 selectableLookupOptions 와 같은 관례).
 * ⭐ **지금 값은 반드시 선택지에 남긴다** — 사용 중지 코드면 「(미사용)」을 붙이고, 목록을 못
 * 불러왔거나 이름이 없으면 코드 그대로 둔다. 그래야 현재 값이 사라지거나 저장이 막히지 않는다.
 */
export const codeSelectOptions = (lookup: CodeLookup, selected: string): SelectOption[] => {
  const options = lookup.entries
    .filter((entry) => entry.isActive || entry.value === selected)
    .map((entry) => ({
      value: entry.value,
      label: entry.isActive
        ? entry.label
        : `${entry.label}${messages.common.reference.inactiveSuffix}`,
    }));

  return selected === '' || options.some((option) => option.value === selected)
    ? options
    : [...options, { value: selected, label: selected }];
};

export interface TerminalCodeNames {
  type: (code: string) => string;
  status: (code: string) => string;
  typeLookup: CodeLookup;
  statusLookup: CodeLookup;
}

export const useTerminalCodeNames = (): TerminalCodeNames => {
  const typeLookup = useCodeLookup('TERMINAL_TYPE');
  const statusLookup = useCodeLookup('TERMINAL_STATUS');

  return { type: typeLookup.nameOf, status: statusLookup.nameOf, typeLookup, statusLookup };
};
