import { Button, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { ShipmentProcessingFilterValues } from './candidate-screen-model';

const t = messages.shipmentProcessing.filter;

export interface ShipmentProcessingFilterBarProps {
  appliedFilters: ShipmentProcessingFilterValues;
  onSearch: (filters: ShipmentProcessingFilterValues) => void;
  onReset: () => void;
}

/**
 * 좌측 목록의 조회 조건 줄 — 출하일 범위(시작 필수, 공유계약 L-3)와 「피킹완료만」 체크.
 *
 * 트리거 모델은 「모아서 적용」이다(work-order-close와 같다) — 조회를 눌러야 적용된다.
 * `pickingCompleteOnly`도 서버 조회 조건이다. 페이지 전체와 총 건수가 같은 조건을 반영하도록
 * 조회를 눌렀을 때 다른 기간 조건과 함께 적용한다.
 */
export const ShipmentProcessingFilterBar = ({
  appliedFilters,
  onSearch,
  onReset,
}: ShipmentProcessingFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const shipDateFromId = useId();
  const pickingCompleteId = useId();
  const { shipDateFrom, shipDateTo, pickingCompleteOnly } = appliedFilters;

  useEffect(() => {
    setDraft({ shipDateFrom, shipDateTo, pickingCompleteOnly });
  }, [shipDateFrom, shipDateTo, pickingCompleteOnly]);

  const validationReasons: string[] = [];
  if (draft.shipDateFrom === '') validationReasons.push(t.shipDateFromRequired);
  if (
    draft.shipDateFrom !== '' &&
    draft.shipDateTo !== '' &&
    draft.shipDateFrom > draft.shipDateTo
  ) {
    validationReasons.push(t.dateRange);
  }
  const searchDisabled = validationReasons.length > 0;
  const validationId = `${shipDateFromId}-validation`;

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!searchDisabled) onSearch({ ...draft });
  };

  return (
    <form className="filter-bar" onSubmit={submit}>
      <div className="field-cell">
        <TextField
          id={shipDateFromId}
          label={t.shipDateFrom}
          required
          type="date"
          value={draft.shipDateFrom}
          onChange={(event) => {
            setDraft((current) => ({ ...current, shipDateFrom: event.target.value }));
          }}
        />
      </div>
      <div className="field-cell">
        <TextField
          label={t.shipDateTo}
          type="date"
          value={draft.shipDateTo}
          onChange={(event) => {
            setDraft((current) => ({ ...current, shipDateTo: event.target.value }));
          }}
        />
      </div>
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          id={pickingCompleteId}
          checked={draft.pickingCompleteOnly}
          onChange={(event) => {
            setDraft((current) => ({ ...current, pickingCompleteOnly: event.target.checked }));
          }}
        >
          {t.pickingCompleteOnly}
        </Checkbox>
        <p className="field-note">{t.pickingCompleteOnlyNote}</p>
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            aria-describedby={searchDisabled ? validationId : undefined}
            disabled={searchDisabled}
            type="submit"
          >
            {t.search}
          </Button>
          <Button type="button" variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
        </div>
        {searchDisabled ? (
          <p className="field-error" id={validationId}>
            {validationReasons.join(' ')}
          </p>
        ) : null}
      </div>
    </form>
  );
};
