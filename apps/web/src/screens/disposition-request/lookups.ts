import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupEntry, LookupSource } from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';
import { SEVERITY_CODE_GROUP, type CodeOption } from './codes';
import type { PageMeta } from './types';

/**
 * 참조 이름과 선택지 — 등록·의뢰로 바뀌지 않는 값들이다.
 *
 * ⚠ 뿌리 키를 화면 캐시(`requestKeys`)와 «가른다» — 같은 뿌리를 쓰면 쓰기의 무효화가 접두로 걸려
 * 저장 한 번마다 단위·창고·부서 전량이 다시 나간다.
 */
const ROOT = 'disposition-request-lookups';

export interface RequestLookup extends LookupSource {
  entries: LookupEntry[];
  /** 목록이 잘렸다 — 이름을 못 찾은 것이 「없는 값」인지 「잘린 값」인지 가르는 데 쓴다. */
  truncated: boolean;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

const toLookup = (
  data: { entries: LookupEntry[]; page: PageMeta } | undefined,
  isError: boolean,
  isLoading: boolean,
): RequestLookup => ({
  entries: data?.entries ?? EMPTY_ENTRIES,
  truncated: data !== undefined && data.page.total > data.entries.length,
  isError,
  isLoading,
});

const nameOr = (value: string): string =>
  value.trim() === '' ? messages.common.reference.unknown : value;

/** 수량의 단위를 이름으로 보이기 위한 것 — 단위 자체는 대상 LOT이 정한다. */
export const useUomLookup = (): RequestLookup => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'uoms'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/uoms', { params: { query: { includeInactive: true } } }),
      );

      return {
        entries: data.items.map((uom) => ({
          value: String(uom.uomId),
          label: nameOr(uom.uomCode),
          isActive: uom.isActive,
        })),
        page: data.page,
      };
    },
  });

  return toLookup(query.data, query.isError, query.isPending);
};

/** 코드값 선택지 — 비어 오면 비어 있는 대로 낸다. 값을 지어내지 않는다(G-2). */
export interface CodeOptionSource {
  options: CodeOption[];
  isLoading: boolean;
  isError: boolean;
}

const toOptions = (
  data: CodeOption[] | undefined,
  isError: boolean,
  isLoading: boolean,
): CodeOptionSource => ({ options: data ?? [], isError, isLoading });

/**
 * 심각도 — 고객이 늘리는 값이라 화면이 외우지 않고 코드값으로 받는다(스펙 §4-A · 공유계약 G-32).
 * 채번 식별자(`codeGroupId`)가 아니라 코드로 부른다 — 환경마다 다르다.
 */
export const useSeverityOptions = (): CodeOptionSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'code-values', SEVERITY_CODE_GROUP],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: SEVERITY_CODE_GROUP } },
        }),
      );

      return data.items
        .filter((item) => item.isActive)
        .map((item) => ({ value: item.code, label: nameOr(item.nameKo ?? item.codeName) }));
    },
  });

  return toOptions(query.data, query.isError, query.isPending);
};

/**
 * 불량창고 — 판정 대상은 불량창고에 들어온 LOT이라 창고 조건은 그 목록에서 고른다
 * (계약: 목록은 `GET /mdm/warehouses?isDefect=true`가 준다).
 */
export const useDefectWarehouseOptions = (): CodeOptionSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'defect-warehouses'],
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { isDefect: true } } }),
      );

      return data.items.map((warehouse) => ({
        value: String(warehouse.warehouseId),
        label: `${warehouse.warehouseCode} · ${nameOr(warehouse.warehouseName)}`,
      }));
    },
  });

  return toOptions(query.data, query.isError, query.isPending);
};

/** 담당 부서 — 선택 항목이다. 비어 오면 칸을 감추지 않고 선택지 없음으로 둔다. */
export const useDepartmentOptions = (): CodeOptionSource => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: [ROOT, 'departments'],
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/mdm/departments'));

      return data.items
        .filter((department) => department.isActive)
        .map((department) => ({
          value: String(department.departmentId),
          label: nameOr(department.nameKo ?? department.departmentName),
        }));
    },
  });

  return toOptions(query.data, query.isError, query.isPending);
};
