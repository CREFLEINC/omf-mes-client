import { Button, Checkbox, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { Select } from '../../patterns/select';
import { defaultWarehouseFilters } from './code-options';
import type { WarehouseFilters } from './types';

export interface WarehouseFilterBarProps {
  /** 적용된(URL에 반영된) 조건 */
  appliedFilters: WarehouseFilters;
  /** 조회 버튼·Enter·초기화·즉시 적용 칸이 호출 */
  onApplyFilters: (next: WarehouseFilters) => void;
  /** 창고 등록 — 조건 줄 오른쪽 끝(입고 관리 짜임에는 머리 줄이 없다) */
  onAddWarehouse: () => void;
  warehouseTypeOptions: { value: string; label: string }[];
  /** 공장 선택지. 미사용 공장은 지금 고른 값일 때만 남는다 */
  plantOptions: { value: string; label: string }[];
}

const t = messages.warehouseLocation;

/**
 * 창고 조회 조건 — 입고 관리처럼 화면 위 상자에 한 줄로 둔다(사용자 지시 2026-10-29).
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
  const plantSelectId = useId();
  const typeSelectId = useId();
  const [draftQ, setDraftQ] = useState(appliedFilters.q);
  const appliedQ = appliedFilters.q;

  useEffect(() => {
    setDraftQ(appliedQ);
  }, [appliedQ]);

  return (
    <div className="filter-bar">
      <SearchInput
        label={t.filters.searchLabel}
        placeholder={t.filters.searchPlaceholder}
        value={draftQ}
        onChange={(event) => setDraftQ(event.target.value)}
        onSearch={(value) => onApplyFilters({ ...appliedFilters, q: value })}
        clearLabel={messages.common.clear}
      />
      <div className="field-cell">
        <label className="field-label" htmlFor={plantSelectId}>
          {t.fields.plant}
        </label>
        <Select
          id={plantSelectId}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={appliedFilters.plantId}
          onChange={(value) => onApplyFilters({ ...appliedFilters, plantId: value })}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={typeSelectId}>
          {t.fields.warehouseType}
        </label>
        <Select
          id={typeSelectId}
          options={[{ value: '', label: t.filters.typeAll }, ...warehouseTypeOptions]}
          value={appliedFilters.warehouseTypeCode}
          onChange={(value) => onApplyFilters({ ...appliedFilters, warehouseTypeCode: value })}
        />
      </div>
      {/* 해제 축이라 변경 즉시 적용한다(공장·유형과 같다). */}
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={appliedFilters.includeInactive}
          onChange={(event) =>
            onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
          }
        >
          {messages.common.includeInactive}
        </Checkbox>
      </div>
      {/*
       * 조회·초기화는 한 묶음 — 좁아져 줄이 넘쳐도 둘이 함께 다음 줄로 간다(규범 2-1).
       */}
      <div className="filter-actions field-cell-unlabeled">
        <Button onClick={() => onApplyFilters({ ...appliedFilters, q: draftQ })}>
          {messages.common.search}
        </Button>
        <Button variant="outlined" onClick={() => onApplyFilters(defaultWarehouseFilters)}>
          {messages.common.reset}
        </Button>
      </div>
      <div className="field-cell-unlabeled warehouse-location-add">
        <Button onClick={onAddWarehouse}>{t.actions.addWarehouse}</Button>
      </div>
    </div>
  );
};
