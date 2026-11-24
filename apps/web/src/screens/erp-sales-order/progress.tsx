import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import type { ProgressFilter } from './filters';

const t = messages.erpSalesOrder;

const OPTIONS: readonly ProgressFilter[] = ['all', 'open', 'done'];

export interface ProgressHubChipsProps {
  value: ProgressFilter;
  onChange: (value: ProgressFilter) => void;
}

/**
 * 진행 조건 「전체 · 미완료 · 완료」를 탭 줄 위 라벨로 낸다(사용자 지시 2026-11-24 · #358) — 검사 조회의 판정 라벨과 같은
 * 자리 · 모양이다. 누르는 즉시 건다. 「조건 더보기」 안의 진행 단추는 이 라벨로 옮겼다.
 */
export const ProgressHubChips = ({ value, onChange }: ProgressHubChipsProps) => {
  const target = useHubActionsTarget();
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.progress.group}>
      {OPTIONS.map((option) => (
        <Chip
          key={option}
          variant="filter"
          size="sm"
          selected={value === option}
          aria-pressed={value === option}
          onSelectedChange={() => {
            onChange(option);
          }}
        >
          {t.progress[option]}
        </Chip>
      ))}
    </div>
  );

  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};

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
