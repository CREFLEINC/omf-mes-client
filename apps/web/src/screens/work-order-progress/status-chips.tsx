import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { DelayState } from './delay';
import { statusTone } from './status-tone';

const t = messages.workOrderProgress.list;

/** 상태 칩 — 이름은 마스터의 표시명, 색은 상태 하나에 하나(C-19). */
export const StatusChip = ({ statusCode, label }: { statusCode: string; label: string }) => (
  <Chip size="sm" status={statusTone(statusCode)} variant="status">
    {label}
  </Chip>
);

/**
 * 지연 칩.
 *
 * ⛔ **「모름」을 빈칸으로 두지 않는다.** 계획 종료가 없는 지시는 늦었는지 아닌지 판정할 수 없는 것이라
 * 「판정 불가」로 적는다(스펙 §5-3). 정상인 줄만 비운다 — 예외만 보인다.
 */
export const DelayChip = ({ delay }: { delay: DelayState }) => {
  if (delay === 'delayed') {
    return (
      <Chip size="sm" status="error" variant="status">
        {t.delayed}
      </Chip>
    );
  }

  return delay === 'unknown' ? (
    <Chip size="sm" status="idle" variant="status">
      {t.delayUnknown}
    </Chip>
  ) : null;
};
