import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ProcessState, WorklistReason } from './worklist-model';

const t = messages.erpWorkOrderFlow;

/** 상태 하나에 색 하나(C-19): 확인 필요 경고, 자동 계획 완료 성공, 배포 완료 정보, 전 중립, 취소 오류. 조건 칩과 같은 이름과 색이다(C-16). */
export const STATE_TONE: Record<ProcessState, ChipStatus> = {
  NOT_PLANNED: 'idle',
  NEEDS_REVIEW: 'warning',
  DONE: 'success',
  RELEASED: 'info',
  CANCELLED: 'error',
};

export const ProcessStateChip = ({
  state,
  cancelledName,
}: {
  state: ProcessState;
  cancelledName: string;
}) => (
  <Chip variant="status" size="sm" status={STATE_TONE[state]}>
    {state === 'CANCELLED' ? cancelledName : t.status[state]}
  </Chip>
);

/** C-17 사유 칩. 첫 사유와 「외 N」 칩, 전체는 툴팁. */
export const ReasonChips = ({ reasons }: { reasons: readonly WorklistReason[] }) => {
  const first = reasons[0];
  if (first === undefined) return null;
  const all = reasons.map((reason) => t.reasons[reason]).join(', ');
  return (
    <span className="reason-chips" title={all}>
      <Chip variant="status" size="sm" status="warning">
        {t.reasons[first]}
      </Chip>
      {reasons.length > 1 && (
        <Chip variant="status" size="sm" status="idle">
          {t.reasons.more(reasons.length - 1)}
        </Chip>
      )}
    </span>
  );
};

/**
 * 페이지 머리 상태별 건수(C-17). 누르면 그 조건으로 바뀐다. 모양은 선택과 관계없이 같고, 선택된 것만 테두리가 굵다(C-19).
 */
export const CountChip = ({
  state,
  label,
  selected,
  onSelect,
}: {
  state: ProcessState;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <button
    type="button"
    className={`count-chip count-chip-${STATE_TONE[state]}${selected ? ' is-selected' : ''}`}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {label}
  </button>
);
