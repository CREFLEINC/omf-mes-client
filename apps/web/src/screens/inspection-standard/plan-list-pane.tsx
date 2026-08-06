import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import { DEFAULT_PLAN_FILTERS, INSPECTION_TYPE_OPTIONS, inspectionTypeLabel } from './code-options';
import { DisabledAction } from './disabled-action';
import { FieldLabel } from './field-label';
import { clearFilter, hasAnyFilter, toFilterChips } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { InspectionPlan, PlanFilters } from './types';

const t = messages.inspectionStandard;

export interface PlanListPaneProps {
  plans: InspectionPlan[];
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: PlanFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: PlanFilters) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedPlanId: number | null;
  onSelect: (inspectionPlanId: number) => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 검사기준이 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 좌 페인 — 검사기준을 찾아 고르는 자리.
 *
 * **열은 셋뿐이다**(기준코드·기준명·유형). 계약의 목록 행에는 품목·승인 시각·사용 여부도 있으나
 * 이 칸이 `minmax(240px, 1fr)`이라 열을 늘리면 표를 읽을 수 없다 —
 * 승인 여부와 품목은 기준을 고른 뒤 「기준 정보」 구획의 값 표기로 본다.
 *
 * **정렬 가능한 열을 두지 않는다.** 계약의 목록 쿼리에 정렬 파라미터가 없어
 * 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 되어 사용자를 속인다.
 */
export const PlanListPane = ({
  plans,
  isLoading,
  appliedFilters,
  onApplyFilters,
  pageView,
  onChangePage,
  selectedPlanId,
  onSelect,
  loadError,
}: PlanListPaneProps) => {
  const typeSelectId = useId();

  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<PlanFilters>(appliedFilters);
  useEffect(() => {
    setDraft(appliedFilters);
  }, [appliedFilters]);

  const columns: Column<InspectionPlan>[] = [
    {
      key: 'inspectionPlanCode',
      header: t.fields.inspectionPlanCode,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.inspectionPlanId === selectedPlanId ? 'true' : undefined}
          onClick={() => onSelect(row.inspectionPlanId)}
        >
          {row.inspectionPlanCode}
        </button>
      ),
    },
    { key: 'inspectionPlanName', header: t.fields.inspectionPlanName },
    {
      key: 'inspectionTypeCode',
      header: t.fields.inspectionType,
      render: (row) => inspectionTypeLabel(row.inspectionTypeCode),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.planNoMatchTitle}
      description={t.empty.planNoMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_PLAN_FILTERS)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.empty.planNoneTitle}
      description={t.empty.planNoneDescription}
    />
  );

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.plans}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <Table
          density="compact"
          columns={columns}
          rows={plans}
          getRowId={(row) => String(row.inspectionPlanId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toFilterChips(appliedFilters);

  return (
    <section className="pane" aria-label={t.panes.plan}>
      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/*
         * 값이 3자(`IQC`)로 짧아 `.field-cell.wide-select`를 붙이지 않는다 —
         * 값이 짧은 선택칸에 붙이면 좁은 좌 페인의 줄이 쓸데없이 일찍 넘어간다(규범 3-2 이탈 조건 1).
         */}
        <div className="field-cell">
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
         * 갈라지면 남은 버튼이 무엇에 딸린 것인지 읽히지 않는다.
         */}
        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_PLAN_FILTERS)}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

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

      {listSlot()}

      <div className="filter-bar">
        {/*
         * 계약에 올리기 경로가 없고 양식도 정해지지 않았다. 감추면 사용자가
         * 「이 화면에는 없는 기능」으로 오해하고 다른 곳을 찾는다 — 사유와 함께 비활성으로 둔다.
         */}
        <DisabledAction
          label={t.actions.excelUpload}
          reason={t.actionReasons.excelUploadUnavailable}
        />
      </div>
    </section>
  );
};
