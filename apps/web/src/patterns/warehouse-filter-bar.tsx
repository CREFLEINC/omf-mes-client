import { Button, Checkbox, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiClient } from './api-context';
import { type LookupEntry, type LookupSource, selectableLookupOptions } from './lookup-display';
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
  /** 조회 버튼·Enter·초기화·즉시 적용 칸이 호출 */
  onApplyFilters: (next: WarehouseFilters) => void;
  /** 창고 등록 — 조건 줄 오른쪽 끝(입고 관리 짜임에는 머리 줄이 없다). 없으면 단추도 없다(창고 배치도). */
  onAddWarehouse?: () => void;
  warehouseTypeOptions: { value: string; label: string }[];
  /** 공장 선택지. 미사용 공장은 지금 고른 값일 때만 남는다 */
  plantOptions: { value: string; label: string }[];
}

const t = messages.warehouseLocation;

/**
 * 창고 조회 조건 — 왼쪽 창고 목록 위에 좁게 둔다(사용자 지시 2026-10-29).
 *
 * 트리거 모델: **검색어만** 모아서 적용([조회]·Enter), 공장·창고 유형·미사용 포함은 바꾸는 즉시 적용.
 *
 * ⛔ 유형(공장도 같다)을 draft 에 두면 안 된다(omf-all-around#17 · 실화면 재현 2026-09-18). 유형을 고르기만
 *    하면 요청이 나가지 않아 「필터가 안 먹는다」로 보였고, [조회] 전에 「미사용 포함」을 누르면
 *    draft 가 적용값으로 덮여 고른 유형이 지워진 채 조회됐다.
 * ⛔ 입력 중인 검색어는 적용된 검색어가 바뀔 때만 맞춘다 — 즉시 적용 축(공장·유형·미사용)을 바꿀
 *    때 입력하던 검색어가 지워지지 않게 한다.
 */
export const WarehouseFilterBar = ({
  appliedFilters,
  onApplyFilters,
  onAddWarehouse,
  warehouseTypeOptions,
  plantOptions,
}: WarehouseFilterBarProps) => {
  const [draftQ, setDraftQ] = useState(appliedFilters.q);
  const appliedQ = appliedFilters.q;

  useEffect(() => {
    setDraftQ(appliedQ);
  }, [appliedQ]);

  /*
   * 왼쪽 목록 위에 두 줄로 좁게(사용자 지시 2026-10-29) — 윗줄 검색어(X 로 비움) · 조회 · 창고 추가, 아랫줄 공장 · 유형 ·
   * 미사용. 칸 라벨은 선택지 글자(「전체 공장」 등)가 대신해 접근명으로만 둔다.
   */
  return (
    <div className="warehouse-location-filter">
      <div className="warehouse-location-filter-row">
        <SearchInput
          aria-label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draftQ}
          onChange={(event) => setDraftQ(event.target.value)}
          onSearch={(value) => onApplyFilters({ ...appliedFilters, q: value })}
          /* 초기화 단추 대신 검색칸의 X(사용자 지시 2026-10-29) — 검색어를 비우고 바로 다시 조회한다. */
          onClear={() => {
            setDraftQ('');
            onApplyFilters({ ...appliedFilters, q: '' });
          }}
          clearLabel={messages.common.clear}
        />
        <Button onClick={() => onApplyFilters({ ...appliedFilters, q: draftQ })}>
          {messages.common.search}
        </Button>
        {onAddWarehouse !== undefined && (
          <Button className="warehouse-location-add" onClick={onAddWarehouse}>
            {t.actions.addWarehouse}
          </Button>
        )}
      </div>
      <div className="warehouse-location-filter-row">
        <Select
          aria-label={t.fields.plant}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={appliedFilters.plantId}
          onChange={(value) => onApplyFilters({ ...appliedFilters, plantId: value })}
        />
        <Select
          aria-label={t.fields.warehouseType}
          options={[{ value: '', label: t.filters.typeAll }, ...warehouseTypeOptions]}
          value={appliedFilters.warehouseTypeCode}
          onChange={(value) => onApplyFilters({ ...appliedFilters, warehouseTypeCode: value })}
        />
        {/* 해제 축이라 변경 즉시 적용한다(공장·유형과 같다). */}
        <Checkbox
          checked={appliedFilters.includeInactive}
          onChange={(event) =>
            onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
          }
        >
          {messages.common.includeInactive}
        </Checkbox>
      </div>
    </div>
  );
};
