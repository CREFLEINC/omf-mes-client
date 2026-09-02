import { Button, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { codeNote, PLACEHOLDER_HISTORY_TYPES } from './code-options';
import { FieldLabel } from './field-label';
import { periodLockReason, type CalibrationFilters } from './filters';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.gaugeCalibration;

export interface CalibrationFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: CalibrationFilters;
  equipmentOptions: SelectOption[];
  equipmentNote?: string;
  onSearch: (filters: CalibrationFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄. 트리거 모델은 「모아서 적용」이다 — 「조회」를 누를 때만 주소가 바뀐다.
 *
 * **기간이 선택이다** — 계약이 두 날짜를 각각 선택으로 두었다. 그래서 잠그는 것은 **달력에 없는
 * 날**과 **뒤집힌 기간** 둘뿐이고, 비어 있는 것은 막지 않는다(「이 계측기의 전부」가 정상 조회다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const CalibrationFilterBar = ({
  appliedFilters,
  equipmentOptions,
  equipmentNote,
  onSearch,
  onReset,
}: CalibrationFilterBarProps) => {
  const periodId = useId();
  const reasonId = `${periodId}-reason`;

  const [filters, setFilters] = useState<CalibrationFilters>(appliedFilters);

  /* 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다. */
  const {
    equipment: appliedEquipment,
    historyType: appliedHistoryType,
    from: appliedFrom,
    to: appliedTo,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      equipment: appliedEquipment,
      historyType: appliedHistoryType,
      from: appliedFrom,
      to: appliedTo,
    });
  }, [appliedEquipment, appliedHistoryType, appliedFrom, appliedTo]);

  const lockReason = periodLockReason(filters);

  const search = (): void => {
    if (lockReason !== null) return;

    onSearch(filters);
  };

  return (
    <>
      <div className="filter-bar">
        <SelectField
          label={t.filters.equipment}
          options={[{ value: '', label: t.filters.all }, ...equipmentOptions]}
          value={filters.equipment}
          note={equipmentNote}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, equipment: value }));
          }}
        />

        <SelectField
          label={t.filters.historyType}
          options={[{ value: '', label: t.filters.all }, ...PLACEHOLDER_HISTORY_TYPES]}
          value={filters.historyType}
          note={codeNote(PLACEHOLDER_HISTORY_TYPES, t.filters.historyType)}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, historyType: value }));
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={periodId} label={t.filters.period} />
          <DatePicker
            id={periodId}
            mode="range"
            clearable
            placeholder={messages.common.selectDate}
            invalid={lockReason !== null}
            aria-describedby={lockReason === null ? undefined : reasonId}
            value={[
              filters.from === '' ? null : filters.from,
              filters.to === '' ? null : filters.to,
            ]}
            onChange={(value) => {
              setFilters((prev) => ({
                ...prev,
                from: value?.[0] ?? '',
                to: value?.[1] ?? '',
              }));
            }}
          />
        </div>

        <div className="filter-actions">
          <Button
            onClick={search}
            disabled={lockReason !== null}
            aria-describedby={lockReason === null ? undefined : reasonId}
          >
            {t.filters.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.filters.reset}
          </Button>
        </div>
      </div>

      {lockReason !== null && (
        <p id={reasonId} className="pane-lead">
          {lockReason}
        </p>
      )}
    </>
  );
};
