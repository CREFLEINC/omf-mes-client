import { Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ApprovalProgressView, ApprovalStepView } from './progress';

const t = messages.qualityApproval;

const describeStep = (step: ApprovalStepView): ReactNode => (
  <>
    <span className="field-note">
      {step.decisionCode ??
        (step.isCurrent ? t.progress.waitingCurrent : t.progress.waitingPending)}
    </span>
    {step.decisionAtText !== null && <span className="field-note">{step.decisionAtText}</span>}
    {step.decisionComment !== null && <span className="field-note">{step.decisionComment}</span>}
    {step.isMine && <span className="field-note">{t.progress.mine}</span>}
  </>
);

export interface ProgressPaneProps {
  view: ApprovalProgressView;
}

export const ProgressPane = ({ view }: ProgressPaneProps) => {
  const steps: StepperItem[] = view.steps.map((step) => ({
    label: step.approverName,
    status: step.status,
    icon: step.stepNo,
    description: describeStep(step),
  }));

  return (
    <div role="group" aria-label={t.panes.progress}>
      <p>
        {view.currentStepNo === null
          ? t.progress.finished(view.totalStepNo)
          : t.progress.position(view.currentStepNo, view.totalStepNo)}
      </p>
      <p>{view.isMyTurn ? t.progress.myTurn : t.progress.notMyTurn}</p>
      {steps.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        <Stepper aria-label={t.progress.steps} orientation="vertical" size="sm" steps={steps} />
      )}
    </div>
  );
};
