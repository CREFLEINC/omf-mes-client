import { Checkbox, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useApiClient } from './api-context';
import { type LookupEntry, type LookupSource, selectableLookupOptions } from './lookup-display';
import { type MasterDataPlant, plantSelectOf } from './master-data-plant';
import { runRequest } from './request';
import { Select } from './select';

/*
 * 창고 조회 조건 — 창고·Location 과 창고 배치도의 왼쪽 위가 같은 상자를 쓴다(사용자 지시 2026-10-30). 조건 모양 · 처음
 * 값 · 서버 질의로 옮기는 규칙도 여기 한 벌로 둔다.
 */

export interface WarehouseFilters {
  q: string;
  /** 공장 번호를 문자열로 — DS Select 값과 같은 모양이다. 빈 문자열이면 공장으로 거르지 않는다. */
  plantId: string;
  warehouseTypeCode: string;
  includeInactive: boolean;
}

/** 화면을 처음 열었을 때의 조회 조건. */
export const defaultWarehouseFilters: WarehouseFilters = {
  q: '',
  plantId: '',
  warehouseTypeCode: '',
  includeInactive: false,
};

/**
 * 공장 번호 질의. 조회 조건을 URL이 소유하는 화면이 있어 손으로 고친 주소(`?plant=abc`)가 그대로 들어온다. 거르지 않으면
 * 정수가 아닌 `plantId` 가 실려 서버가 400 으로 거절하고, 사용자는 조회 실패만 본다.
 */
const plantIdQuery = (value: string): { plantId: number } | Record<string, never> => {
  if (value === '') return {};
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? { plantId: parsed } : {};
};

/** 창고 목록(`GET /mdm/warehouses`) 질의 — 조건은 서버로 보낸다(화면에서 거르면 서버가 자른 뒤의 결과만 걸러진다). */
export const warehouseListQuery = (filters: WarehouseFilters) => ({
  ...(filters.q === '' ? {} : { q: filters.q }),
  ...plantIdQuery(filters.plantId),
  ...(filters.warehouseTypeCode === '' ? {} : { warehouseTypeCode: filters.warehouseTypeCode }),
  includeInactive: filters.includeInactive,
});

/**
 * 보일 창고 — 외부 창고는 숨긴다(사용자 결정 2026-10-30 · 서버 #932). 「미사용 포함」을 켜면 외부 창고도 보인다 — 숨긴 창고를
 * 다시 내부로 되돌릴 길이다. 서버에 외부를 빼는 질의가 없어 받은 쪽 안에서 거른다.
 */
export const visibleWarehouses = <T extends { isExternal: boolean }>(
  items: readonly T[],
  filters: Pick<WarehouseFilters, 'includeInactive'>,
): T[] => (filters.includeInactive ? [...items] : items.filter((item) => !item.isExternal));

const EMPTY_ENTRIES: LookupEntry[] = [];

/** 창고 유형 공통코드 그룹(고정 계약 G-32). */
const WAREHOUSE_TYPE_GROUP = 'WAREHOUSE_TYPE';

/**
 * 조건 상자의 선택지 — 공장 · 창고 유형. 미사용 값까지 받아 두고 고를 수 있는 것만 낸다(지금 고른 미사용 값은 남긴다).
 * 창고·Location 은 같은 목록을 제 참조 묶음(`useLookupOptions`)으로 받아 넘긴다.
 */
export const useWarehouseFilterOptions = (
  applied: WarehouseFilters,
): {
  plantOptions: { value: string; label: string }[];
  warehouseTypeOptions: { value: string; label: string }[];
} => {
  const { client } = useApiClient();
  const plants = useQuery({
    queryKey: ['warehouse-filter', 'plants'],
    queryFn: () =>
      runRequest(() => client.GET('/mdm/plants', { params: { query: { includeInactive: true } } })),
  });
  const types = useQuery({
    queryKey: ['warehouse-filter', 'warehouse-types'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/code-values', {
          params: {
            query: {
              codeGroupCode: WAREHOUSE_TYPE_GROUP,
              includeInactive: true,
              page: 1,
              size: 200,
            },
          },
        }),
      ),
  });

  const plantSource: LookupSource<LookupEntry> = {
    entries:
      plants.data?.items.map((item) => ({
        value: String(item.plantId),
        label: item.plantName,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: plants.isError,
    isLoading: plants.isPending,
  };
  const typeSource: LookupSource<LookupEntry> = {
    entries:
      types.data?.items.map((item) => ({
        value: item.code,
        label: item.codeName.trim() === '' ? item.code : item.codeName,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    isError: types.isError,
    isLoading: types.isPending,
  };

  return {
    plantOptions: selectableLookupOptions(plantSource, applied.plantId),
    warehouseTypeOptions: selectableLookupOptions(typeSource, applied.warehouseTypeCode),
  };
};

export interface WarehouseFilterBarProps {
  /** 적용된(URL에 반영된) 조건 */
  appliedFilters: WarehouseFilters;
  /** 검색어(입력이 멈춘 뒤 · Enter · X)와 공장 · 유형 · 미사용 포함(바꾸는 즉시)이 부른다. */
  onApplyFilters: (next: WarehouseFilters) => void;
  warehouseTypeOptions: { value: string; label: string }[];
  /** 공장 선택지. 미사용 공장은 지금 고른 값일 때만 남는다 */
  plantOptions: { value: string; label: string }[];
  /** 위 줄 사업부가 정한 공장 — 하나면 공장 칸을 감춘다. */
  plant?: MasterDataPlant;
  /** 검색칸 — 창고 배치도는 창고를 선택칸으로 고르므로 끈다(사용자 지시 2026-11-24). 기본 켬. */
  showSearch?: boolean;
  /** 유형 선택칸 바로 오른쪽에 둘 칸 — 창고 배치도의 창고 선택. */
  afterType?: ReactNode;
  /** 미사용 포함 뒤에 둘 칸 — 창고 배치도의 「중지된 위치도 보기」. */
  extra?: ReactNode;
  /** 줄 아래 안내(창고 선택의 까닭 등). */
  note?: ReactNode;
}

const t = messages.warehouseLocation;

/** 검색어는 입력이 이만큼 멈추면 적용한다 — 글자마다 조회하지 않게. */
export const WAREHOUSE_SEARCH_DELAY_MS = 300;

/**
 * 창고 조회 조건 — 왼쪽 창고 목록 위에 한 줄로(안 A, 사용자 결정 2026-11-24): 검색 · 공장 · 유형 · 미사용 포함.
 * [조회] · [창고 추가] 단추는 없다 — 검색어는 입력이 멈추면 바로 적용하고, 창고는 ERP 에서 받아 만든다.
 *
 * ⛔ 유형(공장도 같다)을 draft 에 두면 안 된다(omf-all-around#17 · 실화면 재현 2026-09-18) — 바꾸는 즉시 적용한다.
 * ⛔ 입력 중인 검색어는 바깥에서 적용된 검색어가 바뀔 때만 맞춘다 — 이 칸이 보낸 값이 돌아온 것은 무시해야 그 사이
 *    더 친 글자가 지워지지 않는다. 공장 · 유형 · 미사용을 바꿀 때도 입력하던 검색어가 남는다.
 */
export const WarehouseFilterBar = ({
  appliedFilters,
  onApplyFilters,
  warehouseTypeOptions,
  plantOptions,
  plant,
  showSearch = true,
  afterType,
  extra,
  note,
}: WarehouseFilterBarProps) => {
  const [draftQ, setDraftQ] = useState(appliedFilters.q);
  const appliedQ = appliedFilters.q;
  const plantSelect = plantSelectOf(plant, appliedFilters.plantId, [
    { value: '', label: t.filters.plantAll },
    ...plantOptions,
  ]);
  /** 이 칸이 마지막으로 보낸 검색어 — 그 값이 적용돼 돌아올 때는 입력칸을 덮지 않는다. */
  const sentQ = useRef(appliedQ);
  /* 타이머가 늦게 불려도 그때의 조건(공장 · 유형 · 미사용)에 검색어만 얹는다. */
  const latest = useRef({ appliedFilters, onApplyFilters });
  latest.current = { appliedFilters, onApplyFilters };

  useEffect(() => {
    if (appliedQ === sentQ.current) return;
    sentQ.current = appliedQ;
    setDraftQ(appliedQ);
  }, [appliedQ]);

  const applyQ = (value: string) => {
    sentQ.current = value;
    latest.current.onApplyFilters({ ...latest.current.appliedFilters, q: value });
  };

  useEffect(() => {
    if (draftQ === sentQ.current) return undefined;
    const timer = window.setTimeout(() => applyQ(draftQ), WAREHOUSE_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draftQ]);

  return (
    <div className="warehouse-location-filter filter-field-surface">
      <div className="warehouse-location-filter-row is-one-line">
        {showSearch && (
          <SearchInput
            aria-label={t.filters.searchLabel}
            placeholder={t.filters.searchPlaceholder}
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            /* Enter 는 기다리지 않고 바로. */
            onSearch={(value) => applyQ(value)}
            /* 검색칸의 X(사용자 지시 2026-10-29) — 검색어를 비우고 바로 다시 조회한다. */
            onClear={() => {
              setDraftQ('');
              applyQ('');
            }}
            clearLabel={messages.common.clear}
          />
        )}
        {plantSelect !== null && (
          <div className="warehouse-filter-select">
            <Select
              aria-label={t.fields.plant}
              options={plantSelect.options}
              value={plantSelect.value}
              onChange={(value) => onApplyFilters({ ...appliedFilters, plantId: value })}
            />
          </div>
        )}
        <div className="warehouse-filter-select">
          <Select
            aria-label={t.fields.warehouseType}
            options={[{ value: '', label: t.filters.typeAll }, ...warehouseTypeOptions]}
            value={appliedFilters.warehouseTypeCode}
            onChange={(value) => onApplyFilters({ ...appliedFilters, warehouseTypeCode: value })}
          />
        </div>
        {afterType}
        {/* 해제 축이라 변경 즉시 적용한다(공장·유형과 같다). */}
        <Checkbox
          checked={appliedFilters.includeInactive}
          onChange={(event) =>
            onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
          }
        >
          {messages.common.includeInactive}
        </Checkbox>
        {extra}
      </div>
      {note}
    </div>
  );
};
