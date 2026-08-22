import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CalibrationJudgment } from './calibration-status';

const t = messages.gaugeMaster.calibration;

/**
 * 판정을 `Chip` 의 결 하나로 옮긴다.
 *
 * ⛔ **「아직 안 함」과 「대상 아님」을 같은 결로 그리지 않는다**(스펙 §5-5).
 * 앞은 **채워야 할 것**이라 경고이고, 뒤는 **정상**이라 중립이다. 둘을 같은 회색으로 그리면
 * 채워야 할 것이 정상으로 보이고, 그 계측기로 검사가 나간다.
 */
const STATUS: Record<CalibrationJudgment['status'], ChipStatus> = {
  /** 정상이라 결을 두지 않는다 — 눈길을 끌 이유가 없다. */
  notRequired: 'idle',
  /** ⛔ 「대상 아님」과 갈리는 자리다. 채워야 할 것이라 경고다. */
  never: 'warning',
  valid: 'success',
  expired: 'error',
};

/**
 * 문구. **유효와 만료는 날수를 함께 말한다** — 「유효」만으로는 내일 만료인 것과
 * 반년 남은 것이 같아 보인다.
 */
const label = (judgment: CalibrationJudgment): string => {
  switch (judgment.status) {
    case 'notRequired':
      return t.notRequired;
    case 'never':
      return t.never;
    case 'valid':
      return t.valid(judgment.days ?? 0);
    case 'expired':
      return t.expired(judgment.days ?? 0);
  }
};

export interface CalibrationBadgeProps {
  judgment: CalibrationJudgment;
}

export const CalibrationBadge = ({ judgment }: CalibrationBadgeProps) => (
  <Chip variant="status" status={STATUS[judgment.status]}>
    {label(judgment)}
  </Chip>
);
