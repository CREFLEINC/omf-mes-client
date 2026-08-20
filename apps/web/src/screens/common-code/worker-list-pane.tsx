import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { EMPTY_SCOPED_FILTERS } from './department-list-pane';
import {
  clearScopedFilter,
  hasAnyScopedFilter,
  toScopedFilterChips,
  type ScopedFilterLabels,
} from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { SelectField } from './select-field';
import type { ScopedFilters, SelectOption, Worker } from './types';

const t = messages.commonCode;

const CHIP_LABELS: ScopedFilterLabels = {
  keyword: t.filters.chipKeyword,
  keywordRemove: t.filters.chipRemoveKeyword,
  scope: t.filters.chipDepartment,
  scopeRemove: t.filters.chipRemoveDepartment,
  includeInactiveRemove: t.filters.chipRemoveIncludeInactive,
};

export interface WorkerListPaneProps {
  workers: Worker[];
  isLoading: boolean;
  appliedFilters: ScopedFilters;
  onApplyFilters: (next: ScopedFilters) => void;
  departmentOptions: SelectOption[];
  /** 조건 칩에 낼 부서 이름. 번호를 그대로 보이면 무엇을 걸었는지 모른다 */
  departmentLabel: (scopeId: string) => string;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedWorkerId: number | null;
  onSelect: (workerId: number) => void;
  loadError: ReactNode;
}

/**
 * 좌 페인 — 작업자를 찾아 고르는 자리.
 *
 * **쓰기 액션이 없다.** 계약에 작업자 등록·수정 경로가 아예 없어 「작업자 추가」를 둘 자리가 아니다.
 *
 * **열은 둘뿐이다**(사번·성명). 「사용 여부」는 이름 뒤 접미로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다(결정 11).
 *
 * **공장·사업부 필터를 두지 않는다** — 좌 페인에 필터 컨트롤 넷을 놓으면 표가 짓눌린다.
 */
export const WorkerListPane = ({
  workers,
  isLoading,
  appliedFilters,
  onApplyFilters,
  departmentOptions,
  departmentLabel,
  optionsNotice,
  pageView,
  onChangePage,
  selectedWorkerId,
  onSelect,
  loadError,
}: WorkerListPaneProps) => {
  /* 트리거 모델: 편집은 모아서 적용, 해제는 즉시. */
  const [draft, setDraft] = useState<ScopedFilters>(appliedFilters);
  const {
    q: appliedQ,
    scopeId: appliedScopeId,
    includeInactive: appliedIncludeInactive,
  } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, scopeId: appliedScopeId, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedScopeId, appliedIncludeInactive]);

  const columns: Column<Worker>[] = [
    {
      key: 'workerNo',
      header: t.worker.fields.workerNo,
      width: '140px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.workerId === selectedWorkerId ? 'true' : undefined}
          onClick={() => onSelect(row.workerId)}
        >
          {row.workerNo}
        </button>
      ),
    },
    {
      key: 'workerName',
      header: t.worker.fields.workerName,
      render: (row) =>
        row.isActive ? row.workerName : `${row.workerName}${t.values.inactiveSuffix}`,
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — 셋을 뭉치면 사실과 다른 안내가 된다.
   * ① 범위 밖 쪽 ② 조건이 걸린 0건 ③ 조건 없는 0건.
   *
   * ③의 안내가 다른 자원과 다르다 — **여기서 만들 수 없는 자료**라 「추가하세요」가 아니라
   * 「원본 시스템을 확인하세요」다.
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

    if (hasAnyScopedFilter(appliedFilters)) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.worker.empty.noMatchTitle}
          description={t.worker.empty.noMatchDescription}
          action={
            <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_SCOPED_FILTERS)}>
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
        title={t.worker.empty.noneTitle}
        description={t.worker.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.workers}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <Table
          density="compact"
          columns={columns}
          rows={workers}
          getRowId={(row) => String(row.workerId)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toScopedFilterChips(appliedFilters, departmentLabel, CHIP_LABELS);

  return (
    <section className="pane" aria-label={t.panes.worker}>
      {optionsNotice}

      <div className="filter-bar">
        <SearchInput
          label={t.filters.workerSearchLabel}
          placeholder={t.filters.workerSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/*
         * 규범 3-2 — 「SYN-DEPT-01 · 합성 부서 A」는 트리거 폭에 갇혀 잘린다
         * (디자인 시스템 이슈 #62). 판단 기준은 코드값이 아니라 선택지 문구다.
         */}
        <SelectField
          label={t.filters.department}
          wide
          options={[{ value: '', label: t.filters.departmentAll }, ...departmentOptions]}
          value={draft.scopeId}
          onChange={(value) => setDraft((prev) => ({ ...prev, scopeId: value }))}
        />

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

        <div className="filter-actions field-cell-unlabeled">
          <Button onClick={() => onApplyFilters(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={() => onApplyFilters(EMPTY_SCOPED_FILTERS)}>
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
            onRemove={() => onApplyFilters(clearScopedFilter(appliedFilters, chip.key))}
          >
            {chip.label}
          </Chip>
        ))}
      </div>

      {listSlot()}
    </section>
  );
};
