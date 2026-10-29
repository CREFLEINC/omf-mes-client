import { Button, Checkbox, Chip, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { Select } from '../../patterns/select';
import { DEFAULT_PLAN_FILTERS, INSPECTION_TYPE_OPTIONS } from './code-options';
import { FieldLabel } from './field-label';
import { clearFilter, toFilterChips } from './filters';
import { PlanPickerDialog } from './plan-picker-dialog';
import { useItemNameLabels } from './queries';
import type { PlanFilters } from './types';

const t = messages.inspectionStandard;

export interface PlanFilterBarProps {
  /** 적용된(주소에 반영된) 조건 — 조건 칩의 렌더 기준 */
  appliedFilters: PlanFilters;
  /** 조회 버튼·Enter·칩 제거·초기화가 호출한다. 쪽은 늘 1로 돌아간다 */
  onApplyFilters: (next: PlanFilters) => void;
  /** 조회 · 초기화 뒤, 구분선 너머에 서는 화면 단추(엑셀 올리기 · 추가 · #196) */
  actions?: ReactNode;
}

/**
 * 검사기준 조회 조건 — 검사 조회·판정처럼 목록 위 카드 한 줄에 선다(omf-all-around#196).
 * 목록 구획 안에 두면 좌우 배치에서 좁은 목록 칸에 조건 셋이 끼어 줄이 넘친다.
 */
export const PlanFilterBar = ({ appliedFilters, onApplyFilters, actions }: PlanFilterBarProps) => {
  const typeSelectId = useId();
  const statusSelectId = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const openPicker = (): void => setIsPickerOpen(true);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const openItemPicker = (): void => setIsItemPickerOpen(true);

  /*
   * 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
   * 편집 중인 값은 draft에만 있고 조건 칩에 미러하지 않는다 — 칩은 「적용된 조건」의 표시다.
   */
  const [draft, setDraft] = useState<PlanFilters>(appliedFilters);
  /* 조건을 바꾸면 바로 조회한다 — 「조회」를 한 번 더 누르지 않게(사용자 지시 · #208). */
  const applyNow = (patch: Partial<PlanFilters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onApplyFilters(next);
  };
  const {
    q: appliedQ,
    inspectionTypeCode: appliedInspectionTypeCode,
    itemId: appliedItemId,
    includeInactive: appliedIncludeInactive,
    inactiveOnly: appliedInactiveOnly,
    unapprovedOnly: appliedUnapprovedOnly,
    versionStatus: appliedVersionStatus,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      q: appliedQ,
      inspectionTypeCode: appliedInspectionTypeCode,
      itemId: appliedItemId,
      includeInactive: appliedIncludeInactive,
      inactiveOnly: appliedInactiveOnly,
      unapprovedOnly: appliedUnapprovedOnly,
      versionStatus: appliedVersionStatus,
    });
  }, [
    appliedQ,
    appliedInspectionTypeCode,
    appliedItemId,
    appliedIncludeInactive,
    appliedInactiveOnly,
    appliedUnapprovedOnly,
    appliedVersionStatus,
  ]);

  /* 품목은 번호로 들고 이름은 품목 상세로 푼다 — 주소로 들어와 창을 거치지 않은 값도 이름이 선다. */
  const toItemId = (value: string): number | null => (value === '' ? null : Number(value));
  const itemLabelOf = useItemNameLabels([toItemId(draft.itemId), toItemId(appliedItemId)]);
  const draftItemLabel = itemLabelOf(toItemId(draft.itemId)) ?? '';
  const chips = toFilterChips(appliedFilters, itemLabelOf(toItemId(appliedItemId)) ?? '');

  return (
    <>
      <div className="filter-bar">
        {/* 순서: 검사 유형 → 검사 기준 검색 → 품목 검색 → 미승인 체크(사용자 지시 · #208). */}
        {/*
         * 규범 3-2 — 선택지 목록이 트리거 폭에 갇혀 있어(디자인 시스템 이슈 #62) 최소 폭을 주지 않으면
         * 「IQC (수입검사)」가 「IQC (수⋯」로 잘려 무엇을 고르는지 읽을 수 없다.
         */}
        <div className="field-cell inspection-standard-type-filter">
          <FieldLabel htmlFor={typeSelectId} label={t.filters.inspectionType} />
          <Select
            id={typeSelectId}
            options={[{ value: '', label: t.filters.typeAll }, ...INSPECTION_TYPE_OPTIONS]}
            value={draft.inspectionTypeCode}
            onChange={(value) => applyNow({ inspectionTypeCode: value })}
          />
        </div>

        {/* 상태 — 가장 높은 버전의 상태로 거른다(사용자 지시 · #208). 고르면 바로 조회한다. */}
        <div className="field-cell inspection-standard-status-filter">
          <FieldLabel htmlFor={statusSelectId} label={t.filters.versionStatus} />
          <Select
            id={statusSelectId}
            options={[
              { value: '', label: t.filters.versionStatusAll },
              ...(['draft', 'confirmed', 'obsolete'] as const).map((status) => ({
                value: status,
                label: t.filters.versionStatuses[status],
              })),
            ]}
            value={draft.versionStatus}
            onChange={(value) => applyNow({ versionStatus: value as PlanFilters['versionStatus'] })}
          />
        </div>

        {/*
         * 검사 기준은 **창에서 검색해서 고른다** — 검사 조회·판정의 품목 조건과 같은 모양(omf-all-around#196).
         * 읽기 전용 칸을 누르거나 엔터를 치면 창이 열리고, 고른 기준의 코드가 검색어로 들어간다.
         * 지우기는 값이 있을 때만 칸 안의 × 다. 고르거나 지우면 바로 조회한다(#208).
         */}
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          readOnly
          title={draft.q === '' ? undefined : draft.q}
          aria-haspopup="dialog"
          clearLabel={t.filters.searchClear}
          onClick={openPicker}
          onSearch={openPicker}
          onChange={() => undefined}
          onClear={() => applyNow({ q: '' })}
        />

        {/*
         * 품목 — 검사 조회·판정의 품목 조건과 같은 모양(#196). 읽기 전용 칸을 누르거나 엔터를 치면 품목 선택 창이 열린다.
         * 고르거나 지우면 바로 조회한다(#208). 지난 기준도 찾게 사용 중지 품목까지 찾는다.
         */}
        <SearchInput
          label={t.filters.item}
          placeholder={t.filters.itemPlaceholder}
          value={draftItemLabel}
          readOnly
          title={draftItemLabel === '' ? undefined : draftItemLabel}
          aria-haspopup="dialog"
          clearLabel={t.filters.itemClear}
          onClick={openItemPicker}
          onSearch={openItemPicker}
          onChange={() => undefined}
          onClear={() => applyNow({ itemId: '' })}
        />

        {/*
         * 「미승인」만 보기(사용자 지시 · #208) — 바로 적용한다. 사용 여부(전체 · 사용 · 미사용)는 탭 줄의 칩이 맡아
         * 종전 「미사용 포함」 체크는 걷었다.
         */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.unapprovedOnly}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, unapprovedOnly: event.target.checked })
            }
          >
            {t.filters.unapprovedOnly}
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
          {/* 초기화는 테두리 단추 — 조회 옆에서 한 단계 낮춘다(사용자 지시 · #196). */}
          <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_PLAN_FILTERS)}>
            {messages.common.reset}
          </Button>
          {actions !== undefined && (
            <>
              <span className="inspection-standard-filter-divider" aria-hidden />
              {actions}
            </>
          )}
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

      {/*
       * 두 검색 창은 조회 카드 밖(body)에 연다 — 카드 안에 두면 카드가 열린 창도 칸 하나로 쳐
       * 칸 사이 간격만큼 카드 높이가 늘어난다(사용자 지적 · #208).
       */}
      {isItemPickerOpen &&
        createPortal(
          <ItemPickerDialog
            multiple={false}
            compact
            includeInactive
            showAvailability={false}
            confirmLabel={t.filters.itemPick}
            onClose={() => setIsItemPickerOpen(false)}
            onConfirm={([item]) => {
              if (item !== undefined) applyNow({ itemId: String(item.itemId) });
              setIsItemPickerOpen(false);
            }}
          />,
          document.body,
        )}

      {isPickerOpen &&
        createPortal(
          <PlanPickerDialog
            includeInactive={appliedFilters.includeInactive || appliedFilters.inactiveOnly}
            onClose={() => setIsPickerOpen(false)}
            onConfirm={(plan) => {
              applyNow({ q: plan.inspectionPlanCode });
              setIsPickerOpen(false);
            }}
          />,
          document.body,
        )}
    </>
  );
};
