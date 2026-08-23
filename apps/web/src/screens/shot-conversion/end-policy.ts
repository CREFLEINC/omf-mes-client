import { messages } from '@omf-mes/i18n';

import type { OperationPolicy } from './types';

const t = messages.shotConversion.end;

/**
 * 정책을 끝내는 일.
 *
 * ⛔ **지우지 않는다** — 계약에 삭제 경로가 없고 그것은 실수가 아니다. **과거 실적이 그때의
 * 비율로 계산됐다**(스펙 §5-5 · 공유계약 A-18). 「종료」는 **유효 종료일을 지정하는 수정**이다.
 */

/**
 * 지금 끝낼 수 있는가. **못 하면 사유가 함께 온다**(공유계약 G-2) —
 * 감추면 「왜 이 줄에는 종료가 없지」가 되고 그 답이 화면에 없다.
 */
export interface EndAvailability {
  can: boolean;
  reason: string | null;
}

const AVAILABLE: EndAvailability = { can: true, reason: null };

/**
 * 이미 끝난 정책은 끝낼 것이 없다.
 *
 * ⚠ **「끝났는가」는 오늘이 아니라 «종료일이 있는가»로 잰다.** 오늘로 재면 오늘 이후로
 * 끝나기로 예정된 정책이 「아직 안 끝났으니 끝낼 수 있다」가 되어, 사용자가 이미 정해 둔
 * 종료일을 모른 채 덮어쓴다. 기간을 «옮기는» 것은 수정의 일이다.
 */
export const endAvailability = (policy: OperationPolicy): EndAvailability => {
  const to = policy.effectiveTo;

  return to === null || to === undefined || to === ''
    ? AVAILABLE
    : { can: false, reason: t.alreadyEnded };
};

/**
 * 고른 종료일이 쓸 수 있는 값인가. 쓸 수 없으면 사유를 돌려준다.
 *
 * ⭐ **시작일보다 앞설 수 없다**(계약의 `ck_operation_policy_dates`). 문구에 **그 시작일을
 * 담는다** — 「시작일보다 뒤여야 합니다」만으로는 그 시작일이 언제인지 창에서 알 수 없다.
 */
export const validateEndDate = (policy: OperationPolicy, endOn: string): string | null => {
  if (endOn === '') return t.dateRequired;

  return endOn < policy.effectiveFrom ? t.dateBeforeStart(policy.effectiveFrom) : null;
};
