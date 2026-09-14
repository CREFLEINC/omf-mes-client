import { Button, Checkbox, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { InspectionInsightFilters } from './filters';

const t = messages.inspectionResultInsights.filter;

export interface InspectionFilterOption {
  value: string;
  label: string;
}

export interface InspectionFilterOptions {
  inspectionType: readonly InspectionFilterOption[];
  item: readonly InspectionFilterOption[];
  process: readonly InspectionFilterOption[];
  judgment: readonly InspectionFilterOption[];
}

interface InspectionInsightFilterBarProps {
  appliedFilters: InspectionInsightFilters;
  options: InspectionFilterOptions;
  onSearch: (filters: InspectionInsightFilters) => void;
  onReset: () => void;
}

const optional = (options: readonly InspectionFilterOption[]): InspectionFilterOption[] => [
  { value: '', label: t.all },
  ...options,
];

export const InspectionInsightFilterBar = ({
  appliedFilters,
  options,
  onSearch,
  onReset,
}: InspectionInsightFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const id = useId();
  const {
    from,
    to,
    inspectionTypeCode,
    itemId,
    processId,
    overallJudgmentCode,
    calibrationExpired,
    finalRoundOnly,
  } = appliedFilters;

  useEffect(() => {
    setDraft({
      from,
      to,
      inspectionTypeCode,
      itemId,
      processId,
      overallJudgmentCode,
      finalRoundOnly,
      calibrationExpired,
    });
  }, [
    from,
    to,
    inspectionTypeCode,
    itemId,
    processId,
    overallJudgmentCode,
    calibrationExpired,
    finalRoundOnly,
  ]);

  const reason =
    draft.from === '' || draft.to === ''
      ? t.periodRequired
      : draft.from > draft.to
        ? t.periodReversed
        : null;
  const selects = [
    [t.inspectionType, 'inspectionTypeCode', optional(options.inspectionType), false],
    [t.item, 'itemId', optional(options.item), false],
    [t.process, 'processId', optional(options.process), false],
    [t.judgment, 'overallJudgmentCode', optional(options.judgment), false],
  ] as const;

  return (
    <div className="filter-bar inspection-results-filter">
      <TextField
        type="date"
        label={t.from}
        value={draft.from}
        onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
      />
      <TextField
        type="date"
        label={t.to}
        value={draft.to}
        onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
      />
      {selects.map(([label, key, values, required]) => (
        <div className="field-cell wide-select" key={key}>
          <label className="field-label" htmlFor={`${id}-${key}`}>
            {label}
          </label>
          <Select
            id={`${id}-${key}`}
            value={draft[key] === '' && required ? null : draft[key]}
            placeholder={required ? t.select : undefined}
            options={[...values]}
            onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        </div>
      ))}
      <div className="field-cell wide-select">
        <label className="field-label" htmlFor={`${id}-calibration`}>
          {t.calibration}
        </label>
        <Select
          id={`${id}-calibration`}
          value={draft.calibrationExpired}
          options={[
            { value: '', label: t.all },
            { value: 'only', label: t.calibrationOnly },
            { value: 'exclude', label: t.calibrationExclude },
          ]}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              calibrationExpired: value as InspectionInsightFilters['calibrationExpired'],
            }))
          }
        />
      </div>
      <div className="inspection-results-filter-footer">
        <Checkbox
          checked={draft.finalRoundOnly}
          onChange={(event) =>
            setDraft((current) => ({ ...current, finalRoundOnly: event.target.checked }))
          }
        >
          {t.finalRoundOnly}
        </Checkbox>
        <span className={reason === null ? 'field-note' : 'field-error'} role="status">
          {reason ??
            (draft.inspectionTypeCode === ''
              ? t.allTypesNote
              : draft.finalRoundOnly
                ? t.finalRoundNote
                : t.allRoundsNote)}
        </span>
        <div className="form-actions inspection-results-filter-actions">
          <Button variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
          <Button disabled={reason !== null} onClick={() => onSearch(draft)}>
            {t.search}
          </Button>
        </div>
      </div>
    </div>
  );
};
