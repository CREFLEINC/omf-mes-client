import { Button, Checkbox, DatePicker } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { FieldLabel } from './field-label';
import { periodLockReason, STATUS_CODES, type FailureFilters } from './filters';
import { SelectField } from './select-field';
import { statusLabel, type SelectOption } from './types';

const t = messages.equipmentFailure;

export interface FailureFilterBarProps {
  /** 주소에 반영된(= 조회에 쓰인) 조건. 편집 중인 값은 이 부품 안에만 있다. */
  appliedFilters: FailureFilters;
  equipmentOptions: SelectOption[];
  equipmentNote?: string;
  onSearch: (filters: FailureFilters) => void;
  onReset: () => void;
}

/**
 * 조회 조건 줄. 트리거 모델은 「모아서 적용」이다.
 *
 * ⭐ **기본이 「미처리만」 켜짐이다** — 이 화면은 밀린 것을 보는 자리다. 그 사실을 조건 줄에
 * 적는다: 적지 않으면 완료된 건이 왜 안 보이는지 알 수 없고, 사용자는 자료가 없다고 읽는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const FailureFilterBar = ({
  appliedFilters,
  equipmentOptions,
  equipmentNote,
  onSearch,
  onReset,
}: FailureFilterBarProps) => {
  const periodId = useId();
  const reasonId = `${periodId}-reason`;

  const [filters, setFilters] = useState<FailureFilters>(appliedFilters);

  /* 주소가 정본이다 — 되돌림을 참조가 아니라 값으로 판정한다. */
  const {
    equipment: appliedEquipment,
    status: appliedStatus,
    openOnly: appliedOpenOnly,
    withoutOrder: appliedWithoutOrder,
    from: appliedFrom,
    to: appliedTo,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      equipment: appliedEquipment,
      status: appliedStatus,
      openOnly: appliedOpenOnly,
      withoutOrder: appliedWithoutOrder,
      from: appliedFrom,
      to: appliedTo,
    });
  }, [
    appliedEquipment,
    appliedStatus,
    appliedOpenOnly,
    appliedWithoutOrder,
    appliedFrom,
    appliedTo,
  ]);

  const lockReason = periodLockReason(filters);

  const search = (): void => {
    if (lockReason !== null) return;

    onSearch(filters);
  };

  return (
    <>
      <div className="filter-bar equipment-failure-filter">
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
          label={t.filters.status}
          options={[
            { value: '', label: t.filters.all },
            ...STATUS_CODES.map((code) => ({ value: code, label: statusLabel(code) })),
          ]}
          value={filters.status}
          placeholder={t.filters.all}
          wide
          onChange={(value) => {
            setFilters((prev) => ({ ...prev, status: value }));
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
              setFilters((prev) => ({ ...prev, from: value?.[0] ?? '', to: value?.[1] ?? '' }));
            }}
          />
        </div>

        <div className="field-cell field-cell-unlabeled check-group equipment-failure-filter-options">
          <Checkbox
            checked={filters.openOnly}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, openOnly: event.target.checked }));
            }}
          >
            {t.filters.openOnly}
          </Checkbox>
          <Checkbox
            checked={filters.withoutOrder}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, withoutOrder: event.target.checked }));
            }}
          >
            {t.filters.withoutOrder}
          </Checkbox>
        </div>

        <div className="field-cell field-cell-unlabeled equipment-failure-filter-actions">
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
      </div>

      {lockReason === null ? (
        <p className="pane-lead">{t.filters.defaultNote}</p>
      ) : (
        <p id={reasonId} className="pane-lead">
          {lockReason}
        </p>
      )}
    </>
  );
};
