import { AlertBanner, EmptyState, SkeletonText, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { DateRangeFields } from '../../patterns/date-range-fields';
import { InfoLabel } from '../../patterns/info-tip';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { Select } from '../../patterns/select';
import type { ExpeditedLookup } from './lookups';
import type { Period } from './period';
import { formatQty, type QuantityLimits } from './quantity';
import {
  remainingQtyOf,
  type ShipmentRequestTarget,
  type ShipmentRequestTargetLine,
} from './types';

const t = messages.expeditedShipment;

export interface TargetPaneProps {
  /** LOT을 고르기 전에는 조회도 선택도 열지 않는다 — 품목이 있어야 좁힐 수 있다. */
  hasLot: boolean;
  period: Period;
  isPeriodUsable: boolean;
  targets: readonly ShipmentRequestTarget[];
  truncated: boolean;
  isLoading: boolean;
  isError: boolean;
  selected: ShipmentRequestTarget | null;
  /** 고른 지시에서 LOT 품목과 맞는 라인. 지시를 골랐는데 없으면 그 사유를 낸다. */
  line: ShipmentRequestTargetLine | null;
  /** 수량의 두 상한. LOT과 라인이 모두 정해져야 나온다. */
  limits: QuantityLimits | null;
  qty: string;
  qtyError: string | undefined;
  showQtyError: boolean;
  uoms: ExpeditedLookup;
  onChangePeriod: (period: Period) => void;
  onSelect: (shipmentRequestId: number | null) => void;
  onChangeQty: (qty: string) => void;
}

/** ② 출하 대상 — 출하작업지시와 수량. */
export const TargetPane = ({
  hasLot,
  period,
  isPeriodUsable,
  targets,
  truncated,
  isLoading,
  isError,
  selected,
  line,
  limits,
  qty,
  qtyError,
  showQtyError,
  uoms,
  onChangePeriod,
  onSelect,
  onChangeQty,
}: TargetPaneProps) => {
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const selectId = useId();
  const qtyId = useId();
  const qtyNoteId = `${qtyId}-note`;
  const hasQtyError = showQtyError && qtyError !== undefined;

  if (!hasLot) {
    return (
      <section className="pane" aria-label={t.panes.target}>
        <h2>{t.panes.target}</h2>
        <EmptyState size="sm" title={t.target.selectLotFirst} />
      </section>
    );
  }

  const options = targets.map((target) => ({
    value: String(target.shipmentRequestId),
    label: `${target.shipmentRequestNo} · ${target.requestedShipDate}`,
  }));

  return (
    <section className="pane" aria-label={t.panes.target}>
      <h2>{t.panes.target}</h2>

      <div className="filter-bar">
        {/*
         * ⚠ 스펙에 없는 칸이다 — 계약이 출하일 시작을 필수로 두어(L-3) 기간 없이는 목록을
         * 부를 수조차 없다. 몰래 고정하면 어제 지시가 안 보이는 이유를 알 길이 없다.
         */}
        {/* 기간의 뜻은 시작일 라벨 옆 ⓘ 로, 칸 아래에는 막혔을 때만 이유를 적는다(관리웹 정리 시안 A). */}
        <DateRangeFields
          required
          startLabel={t.target.fields.requestedShipDateFrom}
          endLabel={t.target.fields.requestedShipDateTo}
          info={t.target.periodNote}
          placeholder={messages.common.selectDate}
          describedBy={isPeriodUsable ? undefined : periodNoteId}
          from={period.from}
          to={period.to}
          onChange={(from, to) => onChangePeriod({ from, to })}
          note={
            !isPeriodUsable && (
              <span id={periodNoteId} className="field-note">
                {t.target.periodInvalid}
              </span>
            )
          }
        />
      </div>

      {isError ? (
        <AlertBanner variant="error">{t.target.loadFailed}</AlertBanner>
      ) : isLoading ? (
        <div role="status" aria-label={t.target.loading}>
          <SkeletonText lines={2} />
        </div>
      ) : (
        <>
          <div className="field-cell wide-select">
            {/* 품목이 맞는 지시만 보인다는 사실은 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
            <InfoLabel
              htmlFor={selectId}
              label={t.target.label}
              info={t.target.filteredByItem}
              required
            />
            <Select
              id={selectId}
              options={options}
              value={selected === null ? null : String(selected.shipmentRequestId)}
              placeholder={options.length === 0 ? t.target.empty : t.target.placeholder}
              onChange={(value) => onSelect(value === '' ? null : Number(value))}
            />
          </div>

          {truncated && <AlertBanner variant="warning">{t.lot.truncated}</AlertBanner>}
        </>
      )}

      {selected !== null && line === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.target.noLine}</AlertBanner>
        </div>
      )}

      {line !== null && (
        <>
          <dl className="filter-bar">
            <div className="field-cell">
              <dt className="field-label">{t.target.fields.allocatedQty}</dt>
              <dd>{formatQty(line.allocatedQty)}</dd>
            </div>
            <div className="field-cell">
              <dt className="field-label">{t.target.fields.remainingQty}</dt>
              <dd>
                {formatQty(remainingQtyOf(line))} {lookupDisplayLabel(uoms, line.uomId)}
              </dd>
            </div>
          </dl>

          <div className="field-cell">
            {/* 넣을 수 있는 범위(두 상한)는 라벨 옆 ⓘ 로, 칸 아래에는 틀렸을 때만 오류를 적는다(관리웹 정리 시안 A). */}
            {limits === null ? (
              <span className="field-label">
                <label htmlFor={qtyId}>{t.target.fields.qty}</label>
                <span className="required-mark" aria-hidden="true">
                  {' *'}
                </span>
              </span>
            ) : (
              <InfoLabel
                htmlFor={qtyId}
                label={t.target.fields.qty}
                info={t.qty.limitNote(formatQty(limits.lotQty), formatQty(limits.remainingQty))}
                required
              />
            )}
            <TextField
              id={qtyId}
              value={qty}
              inputMode="decimal"
              aria-required="true"
              aria-describedby={hasQtyError ? qtyNoteId : undefined}
              aria-invalid={hasQtyError}
              onChange={(event) => onChangeQty(event.target.value)}
            />
            {hasQtyError && (
              <span id={qtyNoteId} className="field-error">
                {qtyError}
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
};
