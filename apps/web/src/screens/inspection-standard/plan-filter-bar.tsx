import { Button, Checkbox, Chip, SearchInput, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { DEFAULT_PLAN_FILTERS, INSPECTION_TYPE_OPTIONS } from './code-options';
import { FieldLabel } from './field-label';
import { clearFilter, toFilterChips } from './filters';
import type { PlanFilters } from './types';

const t = messages.inspectionStandard;

export interface PlanFilterBarProps {
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: PlanFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: PlanFilters) => void;
}

/**
 * 검사기준 조회 조건 — 검사 조회·판정처럼 목록 위 카드 한 줄에 선다(omf-all-around#196).
 * 목록 구획 안에 두면 좌우 배치에서 좁은 목록 칸에 조건 셋이 끼어 줄이 넘친다.
 */
export const PlanFilterBar = ({ appliedFilters, onApplyFilters }: PlanFilterBarProps) => {
  const typeSelectId = useId();

  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<PlanFilters>(appliedFilters);
  const {
    q: appliedQ,
    inspectionTypeCode: appliedInspectionTypeCode,
    includeInactive: appliedIncludeInactive,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      inspectionTypeCode: appliedInspectionTypeCode,
      includeInactive: appliedIncludeInactive,
    });
  }, [appliedQ, appliedInspectionTypeCode, appliedIncludeInactive]);

  const chips = toFilterChips(appliedFilters);

  return (
    <>
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
          clearLabel={messages.common.clear}
        />

        {/*
         * 규범 3-2 — 선택지 목록이 트리거 폭에 갇혀 있어(디자인 시스템 이슈 #62) 최소 폭을 주지 않으면
         * 「IQC (수입검사)」가 「IQC (수⋯」로 잘려 무엇을 고르는지 읽을 수 없다.
         */}
        <div className="field-cell wide-select">
          <FieldLabel htmlFor={typeSelectId} label={t.filters.inspectionType} />
          <Select
            id={typeSelectId}
            options={[{ value: '', label: t.filters.typeAll }, ...INSPECTION_TYPE_OPTIONS]}
            value={draft.inspectionTypeCode}
            onChange={(value) => setDraft((prev) => ({ ...prev, inspectionTypeCode: value }))}
          />
        </div>

        {/* 해제 축이라 변경 즉시 적용한다. */}
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
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 조회는 이 줄의 주 동작 — 검사 조회·판정과 같은 주 색(filled · 빨강)이다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button type="button" variant="filled" onClick={() => onApplyFilters(draft)}>
            {messages.common.search}
          </Button>
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_PLAN_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => onApplyFilters(clearFilter(appliedFilters, chip.key))}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};
