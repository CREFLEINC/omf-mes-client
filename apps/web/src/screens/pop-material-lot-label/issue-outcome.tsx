import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { toIssueFailure } from './failure';
import type { IssueRunResult } from './mutations';
import { formatLotNo } from './types';

const t = messages.popMaterialLotLabel.target.outcome;

export interface IssueOutcomeProps {
  result: IssueRunResult;
  onClose: () => void;
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
 * | LOT 은 생기고 기록이 실패 | ⛔ **다시 등록하지 말 것** — 「인쇄」로 이어간다 |
 * | 발행이 403 | 이 단말에서는 못 찍는다 — **다른 단말**로 안내하고 재시도를 권하지 않는다 |
 * | 등록이 409 | 채번 충돌이다 — **다시 누르면 풀린다**(400 과 같이 말하지 않는다) |
 * | 등록도 못 함 | 그대로 다시 시도해도 된다 |
 *
 * ⛔ 「실패」로 뭉뚱그리면 사용자가 처음부터 다시 눌러 같은 자재에 LOT 이 둘 생긴다.
 */
export const IssueOutcome = ({ result, onClose }: IssueOutcomeProps) => {
  const { isPrinted, failedAt, hasCreatedLot, issue, error } = result;

  // 아직 아무것도 하지 않았다 — 자리를 미리 차지하지 않는다.
  if (failedAt === null && !isPrinted && error === null) return null;

  const failure = toIssueFailure(result);
  const variant = isPrinted ? 'success' : failure === 'printFailed' ? 'warning' : 'error';

  return (
    <AlertBanner
      variant={variant}
      action={
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onClose}>
          {t.close}
        </Button>
      }
    >
      {isPrinted && issue !== null
        ? t.printed(issue.lotNo === null ? '' : formatLotNo(issue.lotNo), issue.issueSeq)
        : failure === 'printFailed'
          ? t.printFailed
          : failure === 'issueForbidden'
            ? t.issueForbidden
            : failure === 'registerConflict'
              ? t.registerConflict
              : t.failed}
      {/*
       * ⚠ **LOT 이 생겼다는 사실은 실패 문구와 «함께» 말한다.** 실패만 보이면 사용자가 다시
       * 등록을 누르고, 그러면 같은 자재에 LOT 이 둘 생긴다.
       *
       * ⛔ 출력 권한이 없는 단말에서는 「인쇄」로 이어가라고 하지 않는다 — 그 단추가 막혀 있다.
       */}
      {!isPrinted && hasCreatedLot ? (
        <p className="pop-wide-note">
          {failure === 'issueForbidden' ? t.lotCreatedForbidden : t.lotCreated}
        </p>
      ) : null}
    </AlertBanner>
  );
};
