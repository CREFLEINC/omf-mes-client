import { Icon, Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { statusBadgeOf } from './code-options';
import type { ApprovalProgressView, ApprovalStepView } from './progress';

const t = messages.qualityApproval;

/**
 * 단계 상태 한 마디 — 결재한 단계는 결정(승인·반려), 차례를 기다리는 단계는 「대기」다(#193).
 * 지금 결재할 단계는 붉은 번호 원이 이미 말해 글을 붙이지 않는다(사용자 지시 2026-10-27).
 */
const stepStateLabel = (step: ApprovalStepView): string | null => {
  if (step.decisionCode !== null) return statusBadgeOf(step.decisionCode).label;

  return step.isCurrent ? null : t.progress.waitingPending;
};

/* 앞 단계에서 이미 결재했으면 일시·의견도 작게 잇는다 — 결재 대기 중에도 앞 결재의 근거가 보인다. */
const describeStep = (step: ApprovalStepView) => (
  <>
    {stepStateLabel(step) !== null && (
      <span className={`quality-approval-step-state is-${step.status}`}>
        {stepStateLabel(step)}
      </span>
    )}
    {step.decisionAtText !== null && <span className="field-note">{step.decisionAtText}</span>}
    {step.decisionComment !== null && <span className="field-note">{step.decisionComment}</span>}
  </>
);

export interface ProgressPaneProps {
  view: ApprovalProgressView;
  /** 요청이 끝났는가(승인·반려). 현재 단계 번호가 남아 와도 요청 상태로 가른다(#193). */
  isFinished: boolean;
}

/**
 * 결재 진행 — 상태에 따라 모양이 다르다(#193 컴팩트형).
 *
 * - 결재 대기: 가로 단계 + 「n / m 단계 · 차례」 한 줄
 * - 결재 종료(승인·반려): 결재한 단계를 한 줄씩(아이콘 · 결재자 · 결정 · 일시)
 */
export const ProgressPane = ({ view, isFinished }: ProgressPaneProps) => {
  const currentStepNo = view.currentStepNo;
  const decided = view.steps.filter((step) => step.decisionCode !== null);

  if (isFinished || currentStepNo === null) {
    return (
      <div className="quality-approval-progress" role="group" aria-label={t.panes.progress}>
        {decided.length === 0 ? (
          <p className="field-note">{t.progress.noSteps}</p>
        ) : (
          <ol className="quality-approval-decisions" aria-label={t.progress.steps}>
            {decided.map((step) => (
              <li key={step.stepNo} className={`quality-approval-decision is-${step.status}`}>
                <Icon
                  name={step.status === 'rejected' ? 'cancel' : 'check_circle'}
                  size={20}
                  className="quality-approval-decision-icon"
                />
                <span className="quality-approval-step-name">{step.approverName}</span>
                <span className={`quality-approval-step-state is-${step.status}`}>
                  {stepStateLabel(step)}
                </span>
                {step.decisionAtText !== null && (
                  <span className="quality-approval-decision-at">{step.decisionAtText}</span>
                )}
                {/* 반려 사유는 요청 상세 끝 붉은 칸이 말한다 — 승인 의견만 여기 둔다. */}
                {step.status !== 'rejected' && step.decisionComment !== null && (
                  <p className="quality-approval-decision-comment">{step.decisionComment}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  const steps: StepperItem[] = view.steps.map((step) => ({
    label: <span className="quality-approval-step-name">{step.approverName}</span>,
    status: step.status,
    icon: step.stepNo,
    description: describeStep(step),
  }));

  return (
    <div className="quality-approval-progress" role="group" aria-label={t.panes.progress}>
      {steps.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        <Stepper aria-label={t.progress.steps} orientation="horizontal" size="sm" steps={steps} />
      )}
      <p className="quality-approval-progress-summary">
        <span className="quality-approval-progress-position">
          {t.progress.position(currentStepNo, view.totalStepNo)}
        </span>
        <span aria-hidden="true">·</span>
        <span>{view.isMyTurn ? t.progress.myTurn : t.progress.notMyTurn}</span>
      </p>
    </div>
  );
};
