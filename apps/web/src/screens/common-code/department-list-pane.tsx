import {
  AlertBanner,
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

import { ORPHAN_GROUP_KEY, groupKeyOf, hasDeepHierarchy } from './department-hierarchy';
import {
  clearScopedFilter,
  hasAnyScopedFilter,
  toScopedFilterChips,
  type ScopedFilterLabels,
} from './filters';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { SelectField } from './select-field';
import type { DepartmentRow, ScopedFilters, SelectOption } from './types';

const t = messages.commonCode;

/** 화면을 처음 열었을 때의 조회 조건. 「초기화」가 돌아가는 자리이기도 하다. */
export const EMPTY_SCOPED_FILTERS: ScopedFilters = { q: '', scopeId: '', includeInactive: false };

const CHIP_LABELS: ScopedFilterLabels = {
  keyword: t.filters.chipKeyword,
  keywordRemove: t.filters.chipRemoveKeyword,
  scope: t.filters.chipBusinessUnit,
  scopeRemove: t.filters.chipRemoveBusinessUnit,
  includeInactiveRemove: t.filters.chipRemoveIncludeInactive,
};

export interface DepartmentListPaneProps {
  /** 표시 순서로 **이미 정렬된** 행. 디자인 시스템 `Table`의 그룹 순서가 이 배열 순서로 정해진다 */
  rows: DepartmentRow[];
  /** 그룹 판정에 쓰는 색인. 상위가 여기 없으면 그 행은 고아 그룹으로 간다 */
  byId: ReadonlyMap<number, DepartmentRow>;
  isLoading: boolean;
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: ScopedFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: ScopedFilters) => void;
  businessUnitOptions: SelectOption[];
  /** 조건 칩에 낼 사업부 이름. 번호를 그대로 보이면 무엇을 걸었는지 모른다 */
  businessUnitLabel: (scopeId: string) => string;
  /** 선택 목록이 잘렸거나 실패했다는 안내 슬롯 */
  optionsNotice: ReactNode;
  pageView: PageView;
  onChangePage: (page: number) => void;
  selectedDepartmentId: number | null;
  onSelect: (departmentId: number) => void;
  /** 등록 폼이 이미 열려 있으면 참. 같은 폼을 두 번 열지 않는다 */
  isCreating: boolean;
  onAddDepartment: () => void;
  /**
   * 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 —
   * 실패를 「등록된 부서가 없습니다」로 보이면 사실과 다른 안내가 된다.
   */
  loadError: ReactNode;
}

/**
 * 좌 페인 — 부서를 상위–하위 2단으로 보고 고르는 자리.
 *
 * **열은 둘뿐이다**(부서코드·부서명). 「사용 여부」를 열로 두지 않고 이름 뒤 접미로 붙인다 —
 * 좁은 좌 페인에서 열 하나를 더 두면 이름 열이 짓눌린다(결정 11).
 *
 * **계층을 다시 계산하지 않는다.** 3단 이상 행도 자기 상위의 그룹에 그대로 두고,
 * 그런 행이 있다는 사실만 안내로 낸다 — 표시를 위해 접으면 서버에 있는 관계와 화면이 어긋난다.
 */
export const DepartmentListPane = ({
  rows,
  byId,
  isLoading,
  appliedFilters,
  onApplyFilters,
  businessUnitOptions,
  businessUnitLabel,
  optionsNotice,
  pageView,
  onChangePage,
  selectedDepartmentId,
  onSelect,
  isCreating,
  onAddDepartment,
  loadError,
}: DepartmentListPaneProps) => {
  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<ScopedFilters>(appliedFilters);
  const {
    q: appliedQ,
    scopeId: appliedScopeId,
    includeInactive: appliedIncludeInactive,
  } = appliedFilters;

  useEffect(() => {
    setDraft({ q: appliedQ, scopeId: appliedScopeId, includeInactive: appliedIncludeInactive });
  }, [appliedQ, appliedScopeId, appliedIncludeInactive]);

  const groupLabel = (groupKey: string): string => {
    if (groupKey === ORPHAN_GROUP_KEY) return t.department.groupHeaderOrphan;

    const head = byId.get(Number(groupKey));
    return head === undefined
      ? groupKey
      : t.department.values.groupHeader(head.departmentCode, head.departmentName);
  };

  const columns: Column<DepartmentRow>[] = [
    {
      key: 'departmentCode',
      header: t.department.fields.departmentCode,
      width: '160px',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={row.departmentId === selectedDepartmentId ? 'true' : undefined}
          onClick={() => onSelect(row.departmentId)}
        >
          {row.departmentCode}
        </button>
      ),
    },
    {
      key: 'departmentName',
      header: t.department.fields.departmentName,
      render: (row) =>
        row.isActive ? row.departmentName : `${row.departmentName}${t.values.inactiveSuffix}`,
    },
  ];

  /**
   * 빈 상태는 세 갈래다 — **셋을 뭉치면 사실과 다른 안내가 된다.**
   * ① 범위 밖 쪽(결과는 있는데 이 쪽에 없다) ② 조건이 걸린 0건 ③ 조건 없는 0건.
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
          title={t.department.empty.noMatchTitle}
          description={t.department.empty.noMatchDescription}
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
        title={t.department.empty.noneTitle}
        description={t.department.empty.noneDescription}
      />
    );
  })();

  /** 조회 실패 → 로딩 → 표 순서로 하나만 낸다. 실패했는데 빈 표를 함께 보이면 안 된다. */
  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.departments}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.departmentId)}
          // 행 순서 재배치 기능은 쓰지 않는다 — 계층 그룹과 병용하면 조용히 무시된다.
          groupBy={(row) => groupKeyOf(row, byId)}
          renderGroupHeader={(groupKey) => groupLabel(groupKey)}
          empty={emptySlot}
        />
        <PageNav view={pageView} onChange={onChangePage} />
      </>
    );
  };

  const chips = toScopedFilterChips(appliedFilters, businessUnitLabel, CHIP_LABELS);

  return (
    <section className="pane" aria-label={t.panes.department}>
      {optionsNotice}

      {/*
       * 이슈 §6이 예고한 「2단 표시로는 부족한」 상태를 감추지 않는다.
       * 목록 위에 한 번만 낸다 — 행마다 되풀이하면 표를 읽을 수 없다.
       */}
      {hasDeepHierarchy(rows, byId) && (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.department.notices.deepHierarchy}</AlertBanner>
        </div>
      )}

      {/* 결과가 없어도 필터 바는 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
      <div className="filter-bar">
        <SearchInput
          label={t.filters.departmentSearchLabel}
          placeholder={t.filters.departmentSearchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />

        {/*
         * 규범 3-2 — 「SYN-BU-01 · 합성 사업부 A」처럼 코드와 이름을 함께 담은 선택지는
         * 트리거 폭에 갇혀 잘린다(디자인 시스템 이슈 #62). 판단 기준은 코드값이 아니라 선택지 문구다.
         * 이미 있는 옵트인 클래스라 `app.css`를 고치지 않는다.
         */}
        <SelectField
          label={t.filters.businessUnit}
          wide
          options={[{ value: '', label: t.filters.businessUnitAll }, ...businessUnitOptions]}
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

        {/*
         * 조회와 초기화는 짝이라 함께 줄바꿈되게 묶는다(배치 규범 2-1).
         * 갈라지면 남은 버튼이 무엇에 딸린 것인지 읽히지 않는다.
         */}
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

      <div className="filter-bar">
        <div className="field-cell">
          <Button variant="outlined" disabled={isCreating} onClick={onAddDepartment}>
            {t.actions.addDepartment}
          </Button>
        </div>
      </div>
    </section>
  );
};
