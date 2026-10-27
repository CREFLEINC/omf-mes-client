import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { DEFAULT_PLAN_FILTERS, inspectionTypeLabel } from './code-options';
import { DisabledAction } from './disabled-action';
import { hasAnyFilter } from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { InspectionPlan, PlanFilters } from './types';

const t = messages.inspectionStandard;

export interface PlanListPaneProps {
  plans: InspectionPlan[];
  isLoading: boolean;
  /** 적용된 조건 — 0건 안내를 가른다(조건 줄은 `PlanFilterBar` 가 목록 위에 따로 세운다) */
  appliedFilters: PlanFilters;
  /** 0건 안내의 초기화가 호출한다 */
  onApplyFilters: (next: PlanFilters) => void;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedPlanId: number | null;
  onSelect: (inspectionPlanId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddPlan: () => void;
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
  isCreating,
  onAddPlan,
  loadError,
}: PlanListPaneProps) => {
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

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   *
   * ① 범위 밖 쪽: 결과는 있는데 이 쪽에 없다. 주소를 손으로 고치거나 조건이 좁아졌을 때 생기며
   *   「등록된 것이 없다」로 내면 거짓말이 된다 — 돌아갈 길(첫 쪽으로)을 함께 준다.
   * ② 조건이 걸린 0건: 조건을 줄이면 나올 수 있다.
   * ③ 조건 없는 0건: 정말로 아무것도 없다.
   *
   * ①을 먼저 본다. 범위 밖은 `total > 0`일 때만 참이라 ②·③과 겹치지 않는다.
   */
  const emptySlot = ((): ReactNode => {
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={() => onChangePage(1)}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (hasAnyFilter(appliedFilters)) {
      return (
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
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.planNoneTitle}
        description={t.empty.planNoneDescription}
      />
    );
  })();

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

  return (
    <section className="pane inspection-standard-list-pane" aria-label={t.panes.plan}>
      {listSlot()}

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onAddPlan}>
            {t.actions.addPlan}
          </Button>
        </div>

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
