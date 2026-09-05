import { AlertBanner, Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { toFilterChips, type FilterChipNames, type ShipmentFilters } from './filters';
import { validatePeriod, type PeriodInput } from './period';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.shipmentSchedule;

export interface ShipmentFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 기간. 편집 중인 값은 이 부품 안에만 있다. */
  appliedPeriod: PeriodInput;
  appliedFilters: ShipmentFilters;
  customerOptions: SelectOption[];
  shipToPartnerOptions: SelectOption[];
  /** 고정 계약이 정의한 출하 진행 상태 선택지. */
  progressOptions: readonly string[];
  chipNames: FilterChipNames;
  customerNote?: string;
  shipToPartnerNote?: string;
  onSearch: (period: PeriodInput, filters: ShipmentFilters) => void;
  onRemoveFilter: (key: keyof ShipmentFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄.
 *
 * 트리거 모델은 「모아서 적용, 해제는 즉시」다(W-01-09와 같다) — 「조회」를 누를 때만 주소가
 * 바뀌고 그때 조회된다. 조건 칩의 ×는 해제라 즉시 반영한다.
 *
 * **출하일 시작이 필수다**(공유계약 L-3) — W-01-09(기간이 완전히 선택)와 반대다. 잠그는 것은
 * 시작일 없음 · 형식 오류 · 뒤집힌 기간 셋뿐이다.
 */
export const ShipmentFilterBar = ({
  appliedPeriod,
  appliedFilters,
  customerOptions,
  shipToPartnerOptions,
  progressOptions,
  chipNames,
  customerNote,
  shipToPartnerNote,
  onSearch,
  onRemoveFilter,
  onReset,
}: ShipmentFilterBarProps) => {
  const reasonId = useId();

  const [period, setPeriod] = useState<PeriodInput>(appliedPeriod);
  const [filters, setFilters] = useState<ShipmentFilters>(appliedFilters);

  /*
   * 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다(#43과 같은 사정을 막는다).
   * 값이 실제로 달라졌을 때만 편집 중인 값을 되돌린다.
   */
  const { from: appliedFrom, to: appliedTo } = appliedPeriod;
  const {
    customer: appliedCustomer,
    shipToPartner: appliedShipToPartner,
    progress: appliedProgress,
    inspection: appliedInspection,
  } = appliedFilters;

  useEffect(() => {
    setPeriod({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  useEffect(() => {
    setFilters({
      customer: appliedCustomer,
      shipToPartner: appliedShipToPartner,
      progress: appliedProgress,
      inspection: appliedInspection,
    });
  }, [appliedCustomer, appliedShipToPartner, appliedProgress, appliedInspection]);

  const searchReason = validatePeriod(period);

  const search = (): void => {
    if (searchReason !== null) return;

    onSearch(period, filters);
  };

  const chips = toFilterChips(appliedFilters, chipNames);

  /* 「전체」를 값이 빈 선택지로 둔다 — 두지 않으면 한 번 고른 뒤에 해제할 방법이 칸 안에 없어진다. */
  const withAll = (options: SelectOption[]): SelectOption[] => [
    { value: '', label: t.filters.all },
    ...options,
  ];

  const inspectionOptions: SelectOption[] = [
    { value: '', label: t.filters.all },
    { value: 'true', label: t.filters.inspectionRequired },
    { value: 'false', label: t.filters.inspectionNotRequired },
  ];

  return (
    <>
      <div className="filter-bar">
        <TextField
          type="date"
          label={t.fields.periodFrom}
          value={period.from}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, from: event.target.value }));
          }}
        />
        <TextField
          type="date"
          label={t.fields.periodTo}
          value={period.to}
          onChange={(event) => {
            setPeriod((prev) => ({ ...prev, to: event.target.value }));
          }}
        />

        <SelectField
          wide
          label={t.fields.customer}
          options={withAll(customerOptions)}
          value={filters.customer}
          note={customerNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, customer: value }));
          }}
        />
        <SelectField
          wide
          label={t.fields.shipToPartner}
          options={withAll(shipToPartnerOptions)}
          value={filters.shipToPartner}
          note={shipToPartnerNote}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, shipToPartner: value }));
          }}
        />
        <SelectField
          wide
          label={t.fields.progress}
          options={withAll(progressOptions.map((code) => ({ value: code, label: code })))}
          value={filters.progress}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, progress: value as ShipmentFilters['progress'] }));
          }}
        />
        <SelectField
          label={t.fields.inspection}
          options={inspectionOptions}
          value={filters.inspection}
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, inspection: value }));
          }}
        />

        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              disabled={searchReason !== null}
              aria-describedby={searchReason === null ? undefined : reasonId}
              onClick={search}
            >
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={onReset}>
              {messages.common.reset}
            </Button>
          </div>
          {searchReason !== null && (
            <span id={reasonId} className="field-note">
              {searchReason}
            </span>
          )}
        </div>
      </div>

      {/* 확정 사항(스펙 §5-2)을 안내한다 — 빼기만 하고 이유를 말하지 않으면 「고장났다」로 읽힌다. */}
      <p className="field-note">{t.filters.timeSlotNote}</p>
      {/* 계약에 자리가 없어 이번 슬라이스에서 뺀 구획을 밝힌다 — 감추면 「원래 없다」로 읽힌다. */}
      <AlertBanner variant="info" title={t.filters.summaryNote} />

      {chips.length > 0 && (
        <div className="filter-bar">
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              variant="status"
              removeLabel={chip.removeLabel}
              onRemove={() => {
                onRemoveFilter(chip.key);
              }}
            >
              {chip.label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};
