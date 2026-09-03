import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { describeError } from './error-lines';
import type { IssuePhase, IssueRunResult } from './mutations';

const t = messages.shippingPackingLabel.outcome;

export interface IssueOutcomeProps {
  phase: IssuePhase;
  result: IssueRunResult;
  issuedCount: number;
  onClose: () => void;
  onRetryRendition: () => void;
}

/**
 * 발행·인쇄 한 번의 결과.
 *
 * ⭐ **성공·실패 둘로 말하지 않는다.** 발행과 인쇄가 한 트랜잭션이 아니라(공유계약 K-4)
 * 중간에서 멈춘 상태가 정상적으로 생기고, **자리마다 다음에 할 일이 다르다.**
 *
 * | 어디까지 갔나 | 무엇을 말하나 |
 * | --- | --- |
 * | 발행까지 | 미리보기로 확인한 뒤 인쇄하라 |
 * | 끝까지 | 몇 건 인쇄했다 |
 * | 인쇄만 실패 | **기록은 남았다** — 「인쇄 실패」 사유로 재발행 |
 * | 기록은 남고 그리기 실패 | ⛔ **다시 발행하지 말 것** — 회차가 하나 더 오른다 |
 * | 발행도 못 함 | 그대로 다시 시도해도 된다 |
 *
 * ⛔ 「실패」로 뭉뚱그리면 사용자가 처음부터 다시 눌러 **회차가 이유 없이 오른다.** 발행 취소
 * 경로가 없어 그 회차는 지워지지 않는다.
 */
export const IssueOutcome = ({
  phase,
  result,
  issuedCount,
  onClose,
  onRetryRendition,
}: IssueOutcomeProps) => {
  const { printed, failedAt, error } = result;

  // 아직 아무것도 하지 않았다 — 자리를 미리 차지하지 않는다.
  if (phase === 'idle' && failedAt === null) return null;
  if (phase === 'issuing' || phase === 'printing') return null;

  const isPrintFailure = failedAt === 'print';
  const isRenderFailure = failedAt === 'render';
  const isReportFailure = failedAt === 'report';
  const isIssueFailure = failedAt === 'issue';

  const variant = failedAt === null ? 'success' : isIssueFailure ? 'error' : 'warning';

  const body = ((): string => {
    if (isIssueFailure) return t.issueFailed;
    if (isRenderFailure) return t.renderFailed;
    if (isPrintFailure) return t.printFailed(printed);
    if (isReportFailure) return t.reportFailed;

    return phase === 'printed' ? t.printed(printed) : t.issued(issuedCount);
  })();

  return (
    <AlertBanner
      variant={variant}
      action={
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          onClick={isRenderFailure ? onRetryRendition : onClose}
        >
          {isRenderFailure ? t.retryRendition : t.close}
        </Button>
      }
    >
      {body}
      {/*
       * ⚠ **서버가 말한 것을 삼키지 않는다.** 발행이 막힌 이유(권한 없음·재발행 사유 누락)는
       * 서버만 아는 것이라, 화면이 「실패했습니다」로 덮으면 사용자가 무엇을 고쳐야 할지 모른다.
       */}
      {error === null ? null : <p className="pop-slabel-wide-note">{describeError(error)}</p>}
    </AlertBanner>
  );
};
