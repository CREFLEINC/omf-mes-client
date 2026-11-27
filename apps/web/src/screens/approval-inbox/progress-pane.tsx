import { Chip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 * 결재 진행 — 「요청 정보」 상자와 같은 짜임(이름 왼쪽 · 값 오른쪽 한 줄씩 · #361).
 *
 * 단계마다 「n단계 | 승인자 [상태 라벨] 일시 · 의견」 한 줄이다. 번호는 **서버가 매긴 단계 번호**이고,
 * 결과 코드는 서버 값 그대로 라벨에 싣는다(화면 낱말로 바꾸지 않는다). 서버가 준 전체 단계가 여럿일 때만 맨 위에
 * 「n / m 단계」를 낸다 — 하나면 그 한 줄로 충분하다.
 *
 * **왜 내 차례가 아닌지는 말하지 않는다.** 화면은 그 까닭을 판정할 수 없다 — 내 차례일 때만 라벨을 붙인다.
 */
export const ProgressPane = ({ view, isMyTurn = false }: ProgressPaneProps) => (
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
      <dl className="approval-inbox-info-list">
        {view.isMultiStep && (
          <div>
            <dt className="field-label">{t.progress.positionLabel}</dt>
            <dd>{view.positionText}</dd>
          </div>
        )}
        {view.steps.map((step) => (
          <div key={step.stepNo}>
            <dt className="field-label">{t.progress.stepNo(step.stepNo)}</dt>
            <dd
              className="approval-inbox-step-line"
              data-status={step.status}
              aria-current={step.status === 'current' ? 'step' : undefined}
            >
              {/* 승인자 이름. 비어 오면 그 사실을 적은 글자가 오고 **번호가 오지 않는다**. */}
              <span>{step.approverLabel}</span>
              <Chip size="sm" status={STEP_TONE[step.status]}>
                {step.decisionCode ?? step.waitingText}
              </Chip>
              {step.decisionAtText !== null && (
                <span className="field-note">{step.decisionAtText}</span>
              )}
              {step.decisionComment !== null && (
                <span className="field-note">{step.decisionComment}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);
