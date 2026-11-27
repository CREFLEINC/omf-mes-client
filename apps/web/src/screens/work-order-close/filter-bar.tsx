import { Button, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type JSX, useEffect, useId, useState } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { Select } from '../../patterns/select';
import { canFilterByJudgment } from './filter-initialization';

export interface WorkOrderCloseFilterValues {
  productionOrderId: string;
  plannedStartFrom: string;
  plannedStartTo: string;
  statusCode: string;
  /** '' 이면 판정으로 거르지 않는다 */
  judgmentCode: string;
}
export interface WorkOrderCloseFilterBarProps {
  appliedFilters: WorkOrderCloseFilterValues;
  /** 「초기화」가 되돌리는 처음 값(상태 목록이 준비되면 「진행 또는 중단」). 이와 다를 때만 「초기화」가 보인다. */
  initialFilters: WorkOrderCloseFilterValues;
  productionOrderOptions: SelectItems;
  statusOptions: SelectItems;
  productionOrderUnavailableReason: string | null;
  statusUnavailableReason: string | null;
  onSearch: (filters: WorkOrderCloseFilterValues) => void;
  onReset: () => void;
}
const judgmentLabels = messages.workOrderClose.detailSummary.judgments;
const isJudgmentKey = (code: string): code is keyof typeof judgmentLabels =>
  Object.hasOwn(judgmentLabels, code);

/**
 * 마감 후보 조회 조건.
 *
 * **보이는 조건은 셋이다**(C-6) — P/O · 계획 시작일 · 마감 상태. 마감 상태는 조회에 꼭 있어야 해 늘 보인다.
 * 판정은 「조건 더보기」에 접고, 걸려 있으면 칩으로만 알린다. 「초기화」는 처음 값과 다를 때만 보인다.
 *
 * 계획 시작일은 시작 · 끝 두 칸이다(`patterns/date-range-fields`). 값과 요청 파라미터는 그대로 시작 · 끝 두 값이다.
 */
export const WorkOrderCloseFilterBar = ({
  appliedFilters,
  initialFilters,
  productionOrderOptions,
  statusOptions,
  productionOrderUnavailableReason,
  statusUnavailableReason,
  onSearch,
  onReset,
}: WorkOrderCloseFilterBarProps): JSX.Element => {
  const t = messages.workOrderClose.filter;
  const [draft, setDraft] = useState(appliedFilters);
  const productionOrderId = useId();
  const statusId = useId();
  const productionOrderNoteId = `${productionOrderId}-note`;
  const statusNoteId = `${statusId}-note`;
  const {
    productionOrderId: appliedProductionOrderId,
    plannedStartFrom,
    plannedStartTo,
    statusCode,
    judgmentCode,
  } = appliedFilters;
  const judgmentId = useId();
  const judgmentNoteId = `${judgmentId}-note`;
  const more = useFilterMore();

  useEffect(() => {
    setDraft({
      productionOrderId: appliedProductionOrderId,
      plannedStartFrom,
      plannedStartTo,
      statusCode,
      judgmentCode,
    });
  }, [appliedProductionOrderId, plannedStartFrom, plannedStartTo, statusCode, judgmentCode]);
  const judgmentEnabled = canFilterByJudgment(draft.statusCode);

  const productionOrderReason = productionOrderUnavailableReason;
  const statusReason =
    statusUnavailableReason ?? (statusOptions.length === 0 ? t.statusEmpty : null);
  const validationReasons: string[] = [];
  if (draft.statusCode === '') validationReasons.push(t.statusRequired);
  if (
    draft.plannedStartFrom !== '' &&
    draft.plannedStartTo !== '' &&
    draft.plannedStartFrom > draft.plannedStartTo
  )
    validationReasons.push(t.dateRange);
  const validationId = `${statusId}-validation`;
  const searchDisabled = validationReasons.length > 0;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!searchDisabled) onSearch({ ...draft });
  };

  const isChanged = hasChangedFilters(initialFilters, draft, appliedFilters);
  /* 접힌 칸(판정)의 조건만 칩으로 — 보이는 칸의 값을 칩으로 겹쳐 적지 않는다. */
  const hiddenChips = [
    ...(judgmentCode === ''
      ? []
      : [
          {
            key: 'judgmentCode' as const,
            label: t.chipJudgment(
              isJudgmentKey(judgmentCode) ? judgmentLabels[judgmentCode] : judgmentCode,
            ),
          },
        ]),
  ];

  return (
    <section className="pane work-order-close-filter-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.pane}</h2>
      <form className="filter-bar work-order-close-filter" onSubmit={submit}>
        <div className="field-cell wide-select">
          <label className="field-label" htmlFor={productionOrderId}>
            {t.productionOrder}
          </label>
          <Select
            aria-describedby={productionOrderReason === null ? undefined : productionOrderNoteId}
            disabled={productionOrderReason !== null}
            id={productionOrderId}
            options={[{ value: '', label: t.all }, ...productionOrderOptions]}
            value={draft.productionOrderId}
            onChange={(productionOrderId) =>
              setDraft((current) => ({ ...current, productionOrderId }))
            }
          />
          {productionOrderReason === null ? null : (
            <p className="field-note" id={productionOrderNoteId}>
              {productionOrderReason}
            </p>
          )}
        </div>
        <DateRangeFields
          clearable
          startLabel={t.plannedStartFrom}
          endLabel={t.plannedStartTo}
          placeholder={messages.common.selectDate}
          from={draft.plannedStartFrom}
          to={draft.plannedStartTo}
          onChange={(plannedStartFrom, plannedStartTo) =>
            setDraft((current) => ({ ...current, plannedStartFrom, plannedStartTo }))
          }
        />
        <div className="field-cell wide-select">
          <span className="field-label">
            <label htmlFor={statusId}>{t.status}</label>
            <span className="required-mark" aria-hidden="true">
              {' *'}
            </span>
          </span>
          <Select
            aria-describedby={statusReason === null ? undefined : statusNoteId}
            aria-required
            disabled={statusReason !== null}
            id={statusId}
            options={statusOptions}
            value={draft.statusCode === '' ? null : draft.statusCode}
            onChange={(statusCode) =>
              setDraft((current) => ({
                ...current,
                statusCode,
                /* 판정으로 거를 수 없는 상태로 바꾸면 고른 판정을 남기지 않는다 — 보이지 않는 조건이 된다. */
                judgmentCode: canFilterByJudgment(statusCode) ? current.judgmentCode : '',
              }))
            }
          />
          {statusReason === null ? null : (
            <p className="field-note" id={statusNoteId}>
              {statusReason}
            </p>
          )}
        </div>
        <div className="field-cell field-cell-unlabeled filter-actions-end">
          <div className="filter-actions">
            <Button
              aria-describedby={searchDisabled ? validationId : undefined}
              disabled={searchDisabled}
              type="submit"
            >
              {t.search}
            </Button>
            {isChanged && (
              <Button type="button" variant="outlined" onClick={onReset}>
                {t.reset}
              </Button>
            )}
            <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
          </div>
          {searchDisabled ? (
            <p className="field-error" id={validationId}>
              {validationReasons.join(' ')}
            </p>
          ) : null}
        </div>
      </form>

      {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
      <div id={more.id} hidden={!more.isOpen}>
        <div className="filter-bar work-order-close-filter">
          <div className="field-cell">
            <label className="field-label" htmlFor={judgmentId}>
              {t.judgment}
            </label>
            <Select
              aria-describedby={judgmentEnabled ? undefined : judgmentNoteId}
              disabled={!judgmentEnabled}
              id={judgmentId}
              options={[
                { value: '', label: t.all },
                { value: 'UNDER', label: messages.workOrderClose.detailSummary.judgments.UNDER },
                { value: 'NORMAL', label: messages.workOrderClose.detailSummary.judgments.NORMAL },
                { value: 'OVER', label: messages.workOrderClose.detailSummary.judgments.OVER },
              ]}
              value={judgmentEnabled ? draft.judgmentCode : ''}
              onChange={(value) => setDraft((current) => ({ ...current, judgmentCode: value }))}
            />
            {judgmentEnabled ? null : (
              <p className="field-note" id={judgmentNoteId}>
                {t.judgmentUnavailable}
              </p>
            )}
          </div>
        </div>
      </div>

      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={() => onSearch({ ...appliedFilters, judgmentCode: '' })}
      />
    </section>
  );
};
