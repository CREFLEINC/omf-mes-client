import type { StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { Stage } from './codes';

/**
 * 진행 단계 넷 — 등록 → 의뢰 → 판정 → 후속(스펙 §7 `Stepper`). 판정은 이 화면이 하지 않으므로
 * 라벨에 그 사실을 적는다(§5-1).
 *
 * 단계는 부적합 상태에서 도출한다 — 화면이 따로 세지 않는다. 모르는 상태(`null`)면 등록까지만
 * 확정으로 두고 나머지는 대기로 둔다 — 짓지 않는다.
 */
export interface ProgressStep {
  key: 'register' | 'request' | 'decide' | 'followUp';
  label: string;
  status: StepStatus;
}

export const toProgressSteps = (stage: Stage | null, hasTarget: boolean): ProgressStep[] => {
  const t = messages.dispositionRequest.progress;
  const rank =
    stage === 'NONE' || stage === null
      ? 0
      : stage === 'NOT_REQUESTED'
        ? 1
        : stage === 'PENDING_DECISION'
          ? 2
          : 3;

  const statusAt = (index: number): StepStatus => {
    if (!hasTarget) return 'pending';
    if (index < rank) return 'complete';
    if (index === rank) return 'current';
    return 'pending';
  };

  return [
    { key: 'register', label: t.register, status: statusAt(0) },
    { key: 'request', label: t.request, status: statusAt(1) },
    { key: 'decide', label: t.decide, status: statusAt(2) },
    { key: 'followUp', label: t.followUp, status: statusAt(3) },
  ];
};
