import { Button, Checkbox, Select, TextField } from '@crefle/web-ui';
import { useEffect, useId, useState } from 'react';

import type { InspectionInsightFilters } from './filters';

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
  { value: '', label: '전체' },
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
      ? '기간을 선택하세요.'
      : draft.from > draft.to
        ? '종료일은 시작일보다 빠를 수 없습니다.'
        : null;
  const selects = [
    ['검사유형', 'inspectionTypeCode', optional(options.inspectionType), false],
    ['품목', 'itemId', optional(options.item), false],
    ['공정', 'processId', optional(options.process), false],
    ['종합판정', 'overallJudgmentCode', optional(options.judgment), false],
  ] as const;

  return (
    <div className="filter-bar inspection-results-filter">
      <TextField
        type="date"
        label="시작일"
        value={draft.from}
        onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
      />
      <TextField
        type="date"
        label="종료일"
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
            placeholder={required ? '선택' : undefined}
            options={[...values]}
            onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        </div>
      ))}
      <div className="field-cell wide-select">
        <label className="field-label" htmlFor={`${id}-calibration`}>
          교정 상태
        </label>
        <Select
          id={`${id}-calibration`}
          value={draft.calibrationExpired}
          options={[
            { value: '', label: '전체' },
            { value: 'only', label: '검교정 만료만' },
            { value: 'exclude', label: '검교정 만료 제외' },
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
          최종 회차만
        </Checkbox>
        <span className={reason === null ? 'field-note' : 'field-error'} role="status">
          {reason ??
            (draft.inspectionTypeCode === ''
              ? '전체 선택 시 요약·추이는 검사유형별로 분리합니다.'
              : draft.finalRoundOnly
                ? '최종 검사 회차만 조회합니다.'
                : '재검 사슬 전체를 회차 순서로 조회합니다.')}
        </span>
        <div className="form-actions inspection-results-filter-actions">
          <Button variant="outlined" onClick={onReset}>
            초기화
          </Button>
          <Button disabled={reason !== null} onClick={() => onSearch(draft)}>
            조회
          </Button>
        </div>
      </div>
    </div>
  );
};
