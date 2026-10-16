import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toIssueFailure, type IssueFailure } from './failure';
import type { IssueRunResult } from './mutations';

const t = messages.popMaterialLotLabel.target.outcome;

/**
 * 멈춘 자리마다의 문구. **표로 둔다** — 갈래가 늘 때 분기를 더 깊게 하지 않고 칸만 는다.
 * `next` 는 제목 아래 줄에 서는 «다음에 할 일»이다.
 */
const FAILURE_MESSAGE: Record<IssueFailure, { title: string; next?: string }> = {
  printFailed: { title: t.printFailed, next: t.printFailedNext },
  reportFailedAfterPrint: { title: t.reportFailedAfterPrint },
  issueForbidden: { title: t.issueForbidden },
  registerConflict: { title: t.registerConflict },
  iqcPlanMissing: { title: t.iqcPlanMissing },
  labelStateLocked: { title: t.labelStateLocked, next: t.labelStateLockedNext },
  other: { title: t.failed },
};

/** IQC 라벨 결과 줄 — 자재 라벨 결과(제목)와 따로 선다(2단계 검증 2026-10-16). */
const IQC_MESSAGE = {
  printed: t.iqcPrinted,
  failed: t.iqcFailed,
  notPrinted: t.iqcNotPrinted,
} as const;

export interface IssueOutcomeProps {
  result: IssueRunResult;
}

/**
 * 등록·인쇄 한 번의 결과.
 *
 * ⭐ **성공·실패 둘로 말하지 않는다.** 등록과 발행 기록이 한 트랜잭션이 아니라(변경 통지
 * #534 §3) 중간에서 멈춘 상태가 정상적으로 생기고, **자리마다 다음에 할 일이 다르다.**
 *
 * | 어디까지 갔나 | 무엇을 말하나 |
 * | --- | --- |
 * | 끝까지 | 인쇄했다 · LOT 번호와 회차 |
 * | 인쇄만 실패 | 기록은 남았다 — **재인쇄**로 이어간다 |
 * | LOT 은 생기고 기록이 실패 | ⛔ **새로 등록되지 않는다** — 같은 단추가 인쇄만 이어간다 |
 * | 발행이 403 | 이 단말에서는 못 찍는다 — **다른 단말**로 안내하고 재시도를 권하지 않는다 |
 * | 등록이 409 | 채번 충돌이다 — **다시 누르면 풀린다**(400 과 같이 말하지 않는다) |
 * | 등록도 못 함 | 그대로 다시 시도해도 된다 |
 *
 * ⛔ 「실패」로 뭉뚱그리면 사용자가 처음부터 다시 눌러 같은 자재에 LOT 이 둘 생긴다.
 */
export const IssueOutcome = ({ result }: IssueOutcomeProps) => {
  const { isPrinted, failedAt, hasCreatedLot, issue, error } = result;

  // 아직 아무것도 하지 않았다 — 자리를 미리 차지하지 않는다.
  if (failedAt === null && !isPrinted && error === null) return null;

  const failure = toIssueFailure(result);
  /*
   * 종이가 나온 실패는 **경고**다. 붉게 내면 「아무것도 안 됐다」로 읽혀 다시 찍게 된다.
   */
  const isPaperOut = failure === 'printFailed' || failure === 'reportFailedAfterPrint';
  const variant = isPrinted ? 'success' : isPaperOut ? 'warning' : 'error';
  /*
   * ⛔ **닫기를 주지 않는다.** 스펙 §3·§5 에 이 띠를 닫는 조작이 없다. 닫히면 결과가 지워져
   * 화면의 차단(`screen` 이 이 결과를 본다)도 함께 풀리는데 서버의 답은 그대로다 — 닫기가
   * 「재시도 수단을 주지 않는다」(§5-2)를 무르는 우회로가 된다. 다른 자재를 고르거나 같은
   * 자재를 다시 누르면 자연히 사라진다.
   */

  const message =
    isPrinted && issue !== null
      ? { title: t.printed(issue.lotNo ?? '', issue.issueSeq) }
      : FAILURE_MESSAGE[failure ?? 'other'];
  /*
   * ⚠ **LOT 이 생겼다는 사실은 실패 문구와 «함께» 말한다.** 실패만 보이면 사용자가 다시
   * 등록을 누르고, 그러면 같은 자재에 LOT 이 둘 생긴다.
   *
   * ⛔ 출력 권한이 없는 단말에서는 이어서 찍으라고 하지 않는다 — 그 단추가 막혀 있다.
   */
  const lines = [
    message.next,
    result.iqcLabel === null ? undefined : IQC_MESSAGE[result.iqcLabel],
    !isPrinted && hasCreatedLot && failure !== 'printFailed'
      ? failure === 'issueForbidden'
        ? t.lotCreatedForbidden
        : t.lotCreated
      : undefined,
  ].filter((line): line is string => line !== undefined);

  return (
    /*
     * ⭐ 제목 = 자재 라벨의 결과, 아래 줄 = 다음에 할 일 · IQC 라벨의 결과. 표식은 제목 줄에 맞춘다
     *    (`pop.css` 의 `.pop-material-lot-outcome`).
     */
    <AlertBanner className="pop-material-lot-outcome" variant={variant} title={message.title}>
      {lines.length === 0
        ? null
        : lines.map((line) => (
            <p key={line} className="pop-wide-note">
              {line}
            </p>
          ))}
    </AlertBanner>
  );
};
