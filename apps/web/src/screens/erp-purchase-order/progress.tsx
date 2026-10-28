import { Button, Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ProgressFilter } from './filters';

const t = messages.erpPurchaseOrder;

const OPTIONS: readonly ProgressFilter[] = ['all', 'open', 'done'];

export interface ProgressFilterFieldProps {
  value: ProgressFilter;
  onChange: (value: ProgressFilter) => void;
}

/**
 * 진행 조건 「전체 · 미완료 · 완료」(사용자 지시 2026-10-28) — 누르는 즉시 건다. 다른 조건은 「조회」로 걸지만 셋 중 하나를
 * 고르는 단추라 미리 고칠 것이 없다. ERP 송신 탭의 생성일 단추와 같은 모양이다.
 */
export const ProgressFilterField = ({ value, onChange }: ProgressFilterFieldProps) => (
  <div className="field-cell">
    <span className="field-label">{t.fields.progress}</span>
    <div className="filter-actions" role="group" aria-label={t.progress.group}>
      {OPTIONS.map((option) => (
        <Button
          key={option}
          variant={value === option ? 'filled' : 'outlined'}
          size="sm"
          aria-pressed={value === option}
          onClick={() => {
            onChange(option);
          }}
        >
          {t.progress[option]}
        </Button>
      ))}
    </div>
  </div>
);

type ProgressCode = keyof typeof t.progress.status;

const CHIP_STATUS: Record<ProgressCode, ChipStatus> = {
  NOT_STARTED: 'idle',
  PARTIAL: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const isProgressCode = (code: string): code is ProgressCode => Object.hasOwn(CHIP_STATUS, code);

/** 목록의 진행 칸. 모르는 코드는 받은 그대로, 칸이 없으면(서버가 싣기 전) 「없음」이다. */
export const ProgressChip = ({ code }: { code: string | null | undefined }) => {
  if (code === null || code === undefined || code === '') return <>{t.values.missing}</>;
  if (!isProgressCode(code)) {
    return (
      <Chip variant="status" size="sm">
        {code}
      </Chip>
    );
  }
  return (
    <Chip variant="status" size="sm" status={CHIP_STATUS[code]}>
      {t.progress.status[code]}
    </Chip>
  );
};
