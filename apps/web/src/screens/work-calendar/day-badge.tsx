import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { DayStatus } from './day-status';

const t = messages.workCalendar.grid.status;

/**
 * 상태를 `Chip` 의 결 하나로 옮긴다.
 *
 * ⭐ **색이 좋고 나쁨을 뜻하지 않는다.** 휴무는 잘못된 것이 아니라 정해진 것이다 — 네 결은
 * 「서로 구별되게」 고른 것이지 「나쁜 순서」가 아니다.
 *
 * ⛔ **「미설정」을 「가동」과 같은 결로 그리지 않는다.** 계약이 설정 있는 날만 내려 주므로,
 * 둘이 같아 보이면 아직 정하지 않은 날이 일하기로 정한 날로 읽힌다(공유계약 G-9).
 */
const STATUS: Record<DayStatus, ChipStatus> = {
  /** 아직 정하지 않았다 — 채워야 할 것이라 중립이되 가동과 갈린다. */
  unset: 'idle',
  working: 'success',
  holiday: 'info',
  /** 반일 근무라 눈에 띄어야 한다 — 휴무로 처리하면 조업시간이 통째로 빠진다. */
  partial: 'warning',
};

const LABEL: Record<DayStatus, string> = {
  unset: t.unset,
  working: t.working,
  holiday: t.holiday,
  partial: t.partial,
};

export interface DayBadgeProps {
  status: DayStatus;
}

export const DayBadge = ({ status }: DayBadgeProps) => (
  <Chip variant="status" status={STATUS[status]}>
    {LABEL[status]}
  </Chip>
);
