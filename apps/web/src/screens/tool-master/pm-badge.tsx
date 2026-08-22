import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PM_AXIS } from './code-options';
import type { PmJudgment } from './pm-status';

const t = messages.toolMaster.pm;

/**
 * 판정을 `Chip` 의 결 하나로 옮긴다.
 *
 * ⛔ **「판정 없음」을 정상과 같은 결로 그리지 않는다.** 모르는 것은 정상이 아니다(G-9) —
 * 같은 회색으로 그리면 도래했는지 알 수 없는 툴이 도래 전과 구별되지 않는다.
 * ⛔ **「대상 아님」은 중립이다** — 예방보전을 하지 않기로 한 것이라 눈길을 끌 이유가 없다.
 */
const STATUS: Record<PmJudgment['status'], ChipStatus> = {
  notRequired: 'idle',
  due: 'error',
  beforeDue: 'success',
  /** 채워야 할 것이라 경고다 — 정상과 갈리는 자리다. */
  unknown: 'warning',
};

/**
 * 먼저 도달한 축의 이름. **아는 두 값에만 이름을 준다** — 계약이 뜻과 함께 못박은 값이다.
 * ⛔ 모르는 값이 오면 코드를 그대로 보인다. 이름을 지어내면 그 뜻도 화면이 지어낸 것이 된다.
 */
const axisLabel = (axis: string): string => {
  if (axis === PM_AXIS.shot) return t.axis.shot;
  if (axis === PM_AXIS.date) return t.axis.date;

  return axis;
};

/**
 * 문구. **도래는 축을 함께 말한다** — 둘 다 쓰는 툴에서 「왜 도래했는가」가 갈린다.
 * 축이 없으면 축을 지어내지 않고 도래만 말한다.
 */
const label = (judgment: PmJudgment): string => {
  switch (judgment.status) {
    case 'notRequired':
      return t.notRequired;
    case 'due':
      return judgment.axis === null ? t.due : t.dueByAxis(axisLabel(judgment.axis));
    case 'beforeDue':
      return t.beforeDue;
    case 'unknown':
      return t.unknown;
  }
};

export interface PmBadgeProps {
  judgment: PmJudgment;
}

export const PmBadge = ({ judgment }: PmBadgeProps) => (
  <Chip variant="status" status={STATUS[judgment.status]}>
    {label(judgment)}
  </Chip>
);
