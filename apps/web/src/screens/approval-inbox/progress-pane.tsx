import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { requestStatusLabelOf } from './code-options';
import type { RequestProgressView, StepProgressView } from './progress';

const t = messages.approvalInbox;

export interface ProgressPaneProps {
  view: RequestProgressView;
  /** 제목 옆 「내 결재 차례」 라벨(#361). 서버가 준 `isMyTurn` 그대로 — 단계 배열로 다시 세지 않는다. */
  isMyTurn?: boolean;
}

/** 단계 상태 → 라벨 색. 상태는 색에만 싣지 않는다 — 라벨 글자(결과 코드 · 대기 글자)가 함께 말한다. */
const STEP_TONE: Record<StepProgressView['status'], ChipStatus> = {
  complete: 'success',
  current: 'info',
  pending: 'idle',
  rejected: 'error',
};

/**
 * 결재 진행 — 「단계 · 결재자 · 상태 · 처리 일시」 표, 의견은 표 아래 줄로(#361).
 *
 * 번호는 **서버가 매긴 단계 번호**이고, 결과 코드는 서버 값 그대로 라벨에 싣는다(화면 낱말로 바꾸지 않는다).
 * 서버가 준 전체 단계가 여럿일 때만 표 위에 「n / m 단계」를 낸다 — 하나면 표 한 줄로 충분하다.
 *
 * **왜 내 차례가 아닌지는 말하지 않는다.** 화면은 그 까닭을 판정할 수 없다 — 내 차례일 때만 라벨을 붙인다.
 */
export const ProgressPane = ({ view, isMyTurn = false }: ProgressPaneProps) => {
  const commented = view.steps.filter((step) => step.decisionComment !== null);

  return (
    <div className="approval-inbox-detail-section" role="group" aria-label={t.panes.progress}>
      <h3 className="approval-inbox-progress-head">
        {t.panes.progress}
        {isMyTurn && (
          <Chip size="sm" status="info">
            {t.progress.myTurnBadge}
          </Chip>
        )}
      </h3>

      {view.steps.length === 0 ? (
        <p className="field-note">{t.progress.noSteps}</p>
      ) : (
        <>
          {view.isMultiStep && (
            <dl className="approval-inbox-info-list">
              <div>
                <dt className="field-label">{t.progress.positionLabel}</dt>
                <dd>{view.positionText}</dd>
              </div>
            </dl>
          )}
          <table className="approval-inbox-progress-table">
            <thead>
              <tr>
                <th scope="col">{t.progress.columns.step}</th>
                <th scope="col">{t.progress.columns.approver}</th>
                <th scope="col">{t.progress.columns.status}</th>
                <th scope="col">{t.progress.columns.decidedAt}</th>
              </tr>
            </thead>
            <tbody>
              {view.steps.map((step) => (
                <tr
                  key={step.stepNo}
                  data-status={step.status}
                  aria-current={step.status === 'current' ? 'step' : undefined}
                >
                  <td>{t.progress.stepNo(step.stepNo)}</td>
                  {/* 승인자 이름. 비어 오면 그 사실을 적은 글자가 오고 **번호가 오지 않는다**. */}
                  <td>{step.approverLabel}</td>
                  <td>
                    <Chip size="sm" status={STEP_TONE[step.status]}>
                      {/* 결정 코드(APPROVED 등)는 상태 이름으로 — 모르는 코드는 그대로(#360). */}
                      {step.decisionCode === null
                        ? step.waitingText
                        : requestStatusLabelOf(step.decisionCode)}
                    </Chip>
                  </td>
                  <td>{step.decisionAtText ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {commented.length > 0 && (
            <dl className="approval-inbox-info-list">
              {commented.map((step) => (
                <div key={step.stepNo}>
                  <dt className="field-label">
                    {view.isMultiStep
                      ? t.progress.stepCommentLabel(step.stepNo)
                      : t.progress.commentLabel}
                  </dt>
                  <dd>{step.decisionComment}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </div>
  );
};
