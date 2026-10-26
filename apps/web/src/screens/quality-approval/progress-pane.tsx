import { Icon, Stepper, type StepperItem } from '@crefle/web-ui';
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
    label: <span className="quality-approval-step-name">{step.approverName}</span>,
    status: step.status,
    icon: step.stepNo,
    description: describeStep(step),
  }));

  return (
    <div className="quality-approval-progress" role="group" aria-label={t.panes.progress}>
      {/* 결재 단계는 가로로 잇고(#144), 몇 단계째인지·내 차례인지는 그 아래 안내 줄로 말한다. */}
      {steps.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        <Stepper aria-label={t.progress.steps} orientation="horizontal" size="md" steps={steps} />
      )}
      <div className="quality-approval-progress-summary">
        <Icon name="info" size={20} />
        <p>
          {view.currentStepNo === null
            ? t.progress.finished(view.totalStepNo)
            : t.progress.position(view.currentStepNo, view.totalStepNo)}
        </p>
        <p>{view.isMyTurn ? t.progress.myTurn : t.progress.notMyTurn}</p>
      </div>
    </div>
  );
};
