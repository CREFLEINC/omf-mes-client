import { Button, Checkbox, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { Select } from '../../patterns/select';
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
        <Button className="warehouse-location-add" onClick={onAddWarehouse}>
          {t.actions.addWarehouse}
        </Button>
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
