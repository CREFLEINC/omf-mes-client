import { AlertBanner, Button, Dialog, Stepper, type StepperItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { formatIssuedAt, type IssueView, type PrintOutcome } from './types';

const t = messages.shippingPackingLabel.history;

/**
 * 회차 하나의 단계 상태 — **인쇄 결과로 가른다.**
 *
 * 발행 기록 자체는 언제나 「일어난 일」이라 되돌아가지 않는다. 갈리는 것은 그 회차의 종이가
 * 나왔는가다 — 실패한 회차를 성공한 회차와 같은 모양으로 그리면 어느 라벨이 현장에 있는지
 * 알 수 없다.
 */
const STEP_STATUS: Record<PrintOutcome, StepperItem['status']> = {
  SUCCEEDED: 'complete',
  FAILED: 'rejected',
  PENDING: 'current',
};

export interface HistoryDialogProps {
  issues: IssueView[];
  isLoading: boolean;
  isError: boolean;
  onClose: () => void;
}

/**
 * 발행 이력 — **세로 `Stepper` 로 그린다**(스펙 §7).
 *
 * 회차가 오르면 새 행이고 이전 회차는 남는다(계약 명시). 「회차로 쌓이는 것」이라 단계가
 * 그 모양에 그대로 맞는다 — 결재 진행·검사 회차에 이은 세 번째 사용처다.
 *
 * ⛔ **화면이 회차를 세지 않는다.** 서버가 준 `issueSeq` 를 그대로 단계 이름으로 쓴다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const HistoryDialog = ({ issues, isLoading, isError, onClose }: HistoryDialogProps) => {
  const steps: StepperItem[] = issues.map((issue) => ({
    label: t.step(issue.issueSeq),
    status: STEP_STATUS[issue.printOutcome],
    description: (
      <span className="stacked-cell">
        <span>{formatIssuedAt(issue.issuedAt)}</span>
        <span>{t.outcome[issue.printOutcome]}</span>
        {/* 재발행 사유는 회차가 2 이상일 때만 있다 — 없는 자리에 빈 줄을 두지 않는다. */}
        {issue.reissueReasonName === null ? null : <span>{t.reason(issue.reissueReasonName)}</span>}
      </span>
    ),
  }));

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t.title}
      footer={
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {isError ? <AlertBanner variant="error">{t.loadFailed}</AlertBanner> : null}
      {!isError && !isLoading && issues.length === 0 ? (
        <p className="field-note">{t.empty}</p>
      ) : null}
      {steps.length === 0 ? null : <Stepper steps={steps} orientation="vertical" />}
    </Dialog>
  );
};
