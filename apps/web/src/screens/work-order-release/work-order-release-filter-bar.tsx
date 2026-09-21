import { Button, Select, TextField, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

const t = messages.workOrderRelease.filter;

export interface WorkOrderReleaseFilterValues {
  productionLineId: string;
  plannedStartFrom: string;
  plannedStartTo: string;
  statusCode: string;
}

export const EMPTY_WORK_ORDER_RELEASE_FILTERS: WorkOrderReleaseFilterValues = {
  productionLineId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
};

export interface WorkOrderReleaseFilterBarProps {
  appliedFilters: WorkOrderReleaseFilterValues;
  productionLineOptions: SelectItems;
  statusOptions: SelectItems;
  productionLineUnavailableReason: string | null;
  statusUnavailableReason: string | null;
  onSearch: (filters: WorkOrderReleaseFilterValues) => void;
  onReset: () => void;
}

export const WorkOrderReleaseFilterBar = ({
  appliedFilters,
  productionLineOptions,
  statusOptions,
  productionLineUnavailableReason,
  statusUnavailableReason,
  onSearch,
  onReset,
}: WorkOrderReleaseFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const productionLineId = useId();
  const statusId = useId();
  const dateRangeLabelId = useId();
  const lineNoteId = `${productionLineId}-note`;
  const statusNoteId = `${statusId}-note`;
  const validationId = `${statusId}-validation`;
  const {
    productionLineId: appliedProductionLineId,
    plannedStartFrom,
    plannedStartTo,
    statusCode,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      productionLineId: appliedProductionLineId,
      plannedStartFrom,
      plannedStartTo,
      statusCode,
    });
  }, [appliedProductionLineId, plannedStartFrom, plannedStartTo, statusCode]);

  const statusReason =
    statusUnavailableReason ?? (statusOptions.length === 0 ? t.statusEmpty : null);
  const validationReasons: string[] = [];
  if (draft.statusCode === '') validationReasons.push(t.statusRequired);
  if (
    draft.plannedStartFrom !== '' &&
    draft.plannedStartTo !== '' &&
    draft.plannedStartFrom > draft.plannedStartTo
  ) {
    validationReasons.push(t.dateRange);
  }
  const searchDisabled = validationReasons.length > 0;
  const visibleReasons = validationReasons.filter((reason) => reason !== t.statusRequired);

  return (
    <section className="pane work-order-release-filter-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.pane}</h2>
      <form
        className="filter-bar work-order-release-filter"
        onSubmit={(event) => {
          event.preventDefault();
          if (!searchDisabled) onSearch({ ...draft });
        }}
      >
        {/*
          필수 칸이라 맨 앞에 둔다(생산 라인 왼쪽) — 고르지 않으면 조회가 잠긴다(사용자 지시 2026-09-20).
          필수 표시는 `<label>` 밖에 둔다 — 문자열에 붙이면 접근성 이름이 「이름 *」이 된다(배치 규범 3).
        */}
        <div className="field-cell wide-select">
          <span className="field-label">
            <label htmlFor={statusId}>{t.status}</label>
            <span className="required-mark" aria-hidden="true">
              {' '}
              *
            </span>
          </span>
          <Select
            id={statusId}
            aria-describedby={statusReason === null ? undefined : statusNoteId}
            aria-required
            disabled={statusReason !== null}
            options={statusOptions}
            value={draft.statusCode === '' ? null : draft.statusCode}
            onChange={(value) => setDraft((current) => ({ ...current, statusCode: value }))}
          />
          {statusReason !== null && (
            <p className="field-note" id={statusNoteId}>
              {statusReason}
            </p>
          )}
        </div>
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={productionLineId}>
            {t.productionLine}
          </label>
          <Select
            id={productionLineId}
            aria-describedby={productionLineUnavailableReason === null ? undefined : lineNoteId}
            disabled={productionLineUnavailableReason !== null}
            options={[{ value: '', label: t.all }, ...productionLineOptions]}
            value={draft.productionLineId}
            onChange={(value) => setDraft((current) => ({ ...current, productionLineId: value }))}
          />
          {productionLineUnavailableReason !== null && (
            <p className="field-note" id={lineNoteId}>
              {productionLineUnavailableReason}
            </p>
          )}
        </div>
        {/*
          두 칸은 「계획 시작일」 하나를 범위로 거른다 — 같은 라벨을 두 번 쓰지 않고 한 묶음으로 보인다
          (사용자 지시 2026-09-20). 서버로 가는 값은 종전대로 시작·끝 두 개다.
          칸 이름은 `aria-label` 로 남긴다 — 화면 낭독기에서는 어느 칸이 시작인지 알아야 한다.
        */}
        <div className="field-cell work-order-release-date-range">
          <span className="field-label" id={dateRangeLabelId}>
            {t.plannedStartRange}
          </span>
          <div
            className="work-order-release-date-range-row"
            role="group"
            aria-labelledby={dateRangeLabelId}
          >
            <TextField
              type="date"
              aria-label={t.plannedStartFrom}
              value={draft.plannedStartFrom}
              onChange={(event) =>
                setDraft((current) => ({ ...current, plannedStartFrom: event.target.value }))
              }
            />
            <span className="work-order-release-date-range-separator" aria-hidden="true">
              {t.plannedStartRangeSeparator}
            </span>
            <TextField
              type="date"
              aria-label={t.plannedStartTo}
              value={draft.plannedStartTo}
              onChange={(event) =>
                setDraft((current) => ({ ...current, plannedStartTo: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              type="submit"
              aria-describedby={visibleReasons.length > 0 ? validationId : undefined}
              disabled={searchDisabled}
            >
              {t.search}
            </Button>
            <Button
              type="button"
              variant="outlined"
              onClick={() => {
                setDraft(EMPTY_WORK_ORDER_RELEASE_FILTERS);
                onReset();
              }}
            >
              {t.reset}
            </Button>
          </div>
          {/*
            상태 미선택은 칸의 필수 표시가 이미 말한다 — 버튼 아래에 같은 말을 두지 않는다
            (사용자 지시 2026-09-20). 기간이 뒤집힌 것처럼 칸만으로 알 수 없는 것만 남긴다.
          */}
          {visibleReasons.length > 0 && (
            <p className="field-error" id={validationId}>
              {visibleReasons.join(' ')}
            </p>
          )}
        </div>
      </form>
    </section>
  );
};
