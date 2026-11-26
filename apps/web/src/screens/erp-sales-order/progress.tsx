import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import type { ProgressFilter } from './filters';

const t = messages.erpSalesOrder;

/* 「전체」 라벨은 두지 않는다 — 고른 라벨을 다시 누르면 전체로 돌아간다(사용자 지시 2026-11-24). */
const OPTIONS = ['open', 'done'] as const;

export interface ProgressHubChipsProps {
  value: ProgressFilter;
  onChange: (value: ProgressFilter) => void;
  /** 지금 조건에서의 미완료 · 완료 건수. 받기 전이면 건수 없이 이름만, 0건 라벨은 감춘다(고른 라벨은 남긴다). */
  counts: Partial<Record<'open' | 'done', number>>;
}

/**
 * 진행 조건 「미완료 N건 · 완료 N건」을 탭 줄 위 라벨로 낸다(사용자 지시 2026-11-24 · #358) — 검사 조회의 판정 라벨과 같은
 * 자리 · 모양이다. 누르는 즉시 건다. 「조건 더보기」 안의 진행 단추는 이 라벨로 옮겼다.
 */
export const ProgressHubChips = ({ value, onChange, counts }: ProgressHubChipsProps) => {
  const target = useHubActionsTarget();
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.progress.group}>
      {OPTIONS.filter((option) => value === option || counts[option] !== 0).map((option) => {
        const count = counts[option];
        return (
          <Chip
            key={option}
            variant="filter"
            size="sm"
            selected={value === option}
            aria-pressed={value === option}
            onSelectedChange={() => {
              onChange(value === option ? 'all' : option);
            }}
          >
            {count === undefined
              ? t.progress[option]
              : t.progress.withCount(t.progress[option], count)}
          </Chip>
        );
      })}
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
