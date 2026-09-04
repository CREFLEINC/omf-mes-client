import { Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ProgressStep } from './progress';

export interface ProgressStepperProps {
  steps: ProgressStep[];
}

/** 진행 단계 — 세로 `Stepper`(스펙 §7). 「시간순으로 쌓이는 것」의 사용처다. */
export const ProgressStepper = ({ steps }: ProgressStepperProps) => {
  const items: StepperItem[] = steps.map((step) => ({ label: step.label, status: step.status }));

  return (
    <div
      className="disposition-request-progress"
      aria-label={messages.dispositionRequest.panes.progress}
    >
      <Stepper orientation="vertical" size="sm" steps={items} />
    </div>
  );
};
