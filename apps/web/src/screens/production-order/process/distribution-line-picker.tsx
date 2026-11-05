import { useMemo, useState } from 'react';
import { Button } from '@crefle/web-ui';
import {
  PickerDialog,
  REFERENCE_PAGE_SIZE,
  type ReferenceSource,
} from '../../../patterns/reference-picker';
import type { PlanLine } from './plan-step';

/** 이미 조회한 오더별 허용 라인 범위를 공통 검색 팝업에 연결한다. */
export const DistributionLinePicker = ({
  label,
  lines,
  value,
  disabled,
  optional = false,
  onChange,
}: {
  label: string;
  lines: readonly PlanLine[];
  value: string;
  disabled: boolean;
  optional?: boolean;
  onChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = lines.find((line) => String(line.id) === value);
  const source = useMemo<ReferenceSource>(
    () => ({
      title: '생산 라인 선택',
      key: ['distribution-line-picker', lines.map((line) => [line.id, line.code, line.name])],
      columns: { code: '라인 코드', name: '라인명' },
      search: async (term, page) => {
        const keyword = term.trim().toLocaleLowerCase();
        const found = lines.filter((line) =>
          `${line.code} ${line.name}`.toLocaleLowerCase().includes(keyword),
        );
        return {
          items: found
            .slice((page - 1) * REFERENCE_PAGE_SIZE, page * REFERENCE_PAGE_SIZE)
            .map((line) => ({ id: line.id, code: line.code, name: line.name })),
          total: found.length,
        };
      },
    }),
    [lines],
  );
  return (
    <div className="erp-wo-distribution-line-field">
      <div className="erp-wo-distribution-line-value">
        {selected
          ? `${selected.name} (${selected.code})`
          : optional
            ? '각 구간의 라인 유지'
            : '생산 라인을 선택하세요.'}
      </div>
      <div className="erp-wo-distribution-line-buttons">
        <Button
          size="sm"
          variant="outlined"
          aria-label={`${label} 선택`}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          {selected ? '라인 변경' : '라인 선택'}
        </Button>
        {optional && value && (
          <Button
            size="sm"
            variant="text"
            aria-label={`${label} 해제`}
            disabled={disabled}
            onClick={() => onChange('')}
          >
            해제
          </Button>
        )}
      </div>
      {open && (
        <PickerDialog
          source={source}
          onClose={() => setOpen(false)}
          onPick={(line) => {
            onChange(String(line.id));
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};
