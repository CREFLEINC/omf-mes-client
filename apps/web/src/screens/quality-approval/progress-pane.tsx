import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { statusBadgeOf } from './code-options';
import type { ApprovalProgressView, ApprovalStepView } from './progress';

const t = messages.qualityApproval;

/**
 * 단계 상태 한 마디 — 결재한 단계는 결정(승인·반려), 차례를 기다리는 단계는 「대기」다(#193).
 * 지금 결재할 단계는 글을 붙이지 않는다(사용자 지시 2026-10-27 — 「결재 대기」 문구 제거).
 */
const stepStateLabel = (step: ApprovalStepView): string | null => {
  if (step.decisionCode !== null) return statusBadgeOf(step.decisionCode).label;

  return step.isCurrent ? null : t.progress.waitingPending;
};

export interface ProgressPaneProps {
  view: ApprovalProgressView;
  /** 요청이 끝났는가(승인·반려). 현재 단계 번호가 남아 와도 요청 상태로 가른다(#193). */
  isFinished: boolean;
}

/**
 * 결재 진행 — 상태에 따라 모양이 다르다(#193 컴팩트형).
 *
 * - 결재 대기(「결재 진행」 카드): 「① 결재자 ── ② 결재자」 단계 표시 + 「n / m 단계 · 차례」 한 줄
 * - 결재 종료(「결재 결과」 카드): 결재한 단계마다 아이콘 · 결재자 · 일시, 그 아래 결재 사유(반려면 붉은 칸)
 */
export const ProgressPane = ({ view, isFinished }: ProgressPaneProps) => {
  const currentStepNo = view.currentStepNo;

  if (isFinished || currentStepNo === null) {
    const decided = view.steps.filter((step) => step.decisionCode !== null);

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
                  label={stepStateLabel(step) ?? undefined}
                  className="quality-approval-decision-icon"
                />
                <span className="quality-approval-step-name">{step.approverName}</span>
                {step.decisionAtText !== null && (
                  <span className="quality-approval-decision-at">{step.decisionAtText}</span>
                )}
                {/* 결재 사유는 결정 색 칸에 담는다 — 반려 붉은 칸 · 승인 초록 칸(#193). */}
                {step.decisionComment !== null && (
                  <div
                    className={`quality-approval-reason is-${step.status}`}
                    role="group"
                    aria-label={
                      step.status === 'rejected'
                        ? t.approval.rejectCommentHeading
                        : t.progress.decisionComment
                    }
                  >
                    <p className="quality-approval-reason-label">
                      {step.status === 'rejected'
                        ? t.approval.rejectCommentHeading
                        : t.progress.decisionComment}
                    </p>
                    <p>{step.decisionComment}</p>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className="quality-approval-progress" role="group" aria-label={t.panes.progress}>
      {view.steps.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        <ol className="quality-approval-steps" aria-label={t.progress.steps}>
          {/*
           * 단계 표시 — 번호 원 · 결재자 · 상태 알약, 다음 단계까지 이어지는 선(#193 · IQC 수입검사 단계 표시와 같은 모양).
           * 선은 지나온 단계(승인)와 지금 단계에서 주 색, 남은 단계에서 회색이다.
           */}
          {view.steps.map((step, index) => (
            <li
              key={step.stepNo}
              className={`quality-approval-step is-${step.status}`}
              aria-current={step.isCurrent ? 'step' : undefined}
              data-status={step.status}
            >
              <span className="quality-approval-step-head">
                <span className="quality-approval-step-no">{step.stepNo}</span>
                <span className="quality-approval-step-name">{step.approverName}</span>
                {stepStateLabel(step) !== null && (
                  <span className={`quality-approval-step-state is-${step.status}`}>
                    {stepStateLabel(step)}
                  </span>
                )}
              </span>
              {index < view.steps.length - 1 && (
                <span className="quality-approval-step-line" aria-hidden="true" />
              )}
              {/* 앞 단계에서 이미 결재했으면 일시·의견도 작게 잇는다 — 결재 대기 중에도 앞 결재의 근거가 보인다. */}
              {(step.decisionAtText !== null || step.decisionComment !== null) && (
                <span className="quality-approval-step-notes">
                  {step.decisionAtText !== null && (
                    <span className="field-note">{step.decisionAtText}</span>
                  )}
                  {step.decisionComment !== null && (
                    <span className="field-note">{step.decisionComment}</span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="quality-approval-progress-summary">
        <span className="quality-approval-progress-position">
          {t.progress.position(currentStepNo, view.totalStepNo)}
        </span>
        {/* 차례는 라벨로 — 내 차례면 주황 시계 라벨, 아니면 회색 라벨(사용자 지시 2026-10-27). */}
        <span className={`quality-approval-turn-label ${view.isMyTurn ? 'is-mine' : 'is-other'}`}>
          {view.isMyTurn && <Icon name="schedule" size={16} />}
          {view.isMyTurn ? t.progress.myTurn : t.progress.notMyTurn}
        </span>
      </p>
    </div>
  );
};
