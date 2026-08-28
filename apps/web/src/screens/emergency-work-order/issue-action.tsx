import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import type { IssueLock } from './issue-lock';
import type { PendingWorkOrder } from './mutations';

export interface IssueActionProps {
  lock: IssueLock;
  /** 발행·배포가 끝까지 간 W/O 번호. */
  releasedNo: string | null;
  /** 만들어졌으나 배포가 끝나지 않은 W/O. */
  pending: PendingWorkOrder | null;
  /**
   * 서버가 되돌린 오류.
   *
   * ⛔ **잠금 사유만으로는 부족하다.** 잠금은 화면이 아는 사실(권한 없음·결과 불명)만 말하는데,
   * 발행이 **거절**당하는 경우가 따로 있다 — 고른 개정이 조회와 저장 사이에 폐기되면 서버가
   * 반려한다. 그 문구를 내지 않으면 사용자는 **누른 적 없는 일이 일어난 줄 안다**: 버튼을
   * 눌렀는데 화면이 그대로다.
   */
  error: ApiError | null;
  onIssue: () => void;
  onRetryRelease: () => void;
}

/**
 * 발행 액션과 그 결과.
 *
 * ⛔ **막힌 사유를 말하는 유일한 자리다.** 구획마다 되풀이하면 한쪽만 고쳐질 때 화면이
 * 스스로와 어긋난다.
 *
 * ⛔ **결과를 아는 만큼만 말한다.** 배포를 보내지도 못한 것은 「배포되지 않았습니다」로
 * 단언해도 되지만, 보냈는데 답을 못 받은 것을 그렇게 말하면 거짓일 수 있다 — 실제로
 * 배포됐는데 사용자가 다시 눌러 이중 배포를 시도하게 된다.
 */
export const IssueAction = ({
  lock,
  releasedNo,
  pending,
  error,
  onIssue,
  onRetryRelease,
}: IssueActionProps) => {
  const t = messages.emergencyWorkOrder;
  const reasonId = useId();

  return (
    <section aria-label={t.action}>
      {/*
       * ⛔ **서버가 되돌린 문구를 그대로 낸다.** 화면이 뭉뚱그리면 「왜 반려됐는지」가 사라져
       * 사용자가 같은 조건으로 다시 누른다. ⛔ **「최신 불러오기」를 내주지 않는다** — 이
       * 화면의 재조회는 발행 실패가 알아서 하고, 사용자가 눌러야 할 것은 다시 «발행»이다.
       */}
      <SaveErrorBanner error={error} />

      {releasedNo !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success">{t.outcome.released(releasedNo)}</AlertBanner>
        </div>
      )}

      {pending !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">
            {pending.failedAt === 'unknown'
              ? t.outcome.releaseUnknown(pending.workOrderNo)
              : t.outcome.notSent(pending.workOrderNo)}
          </AlertBanner>
        </div>
      )}

      <Button
        disabled={lock.reason !== undefined}
        /* ⛔ 사유를 버튼에 «묶는다» — 화면에 적어 두기만 하면 버튼만 보는 사람에게 닿지 않는다. */
        aria-describedby={lock.reason === undefined ? undefined : reasonId}
        onClick={onIssue}
      >
        {t.action}
      </Button>

      {/* ⛔ 사유를 감추지 않는다 — 잠긴 이유가 보여야 무엇을 하면 되는지 안다. */}
      {lock.reason !== undefined && (
        <p id={reasonId} role="status">
          {lock.reason}
        </p>
      )}

      {lock.canRetryRelease && (
        <Button variant="tonal" onClick={onRetryRelease}>
          {t.outcome.retryRelease}
        </Button>
      )}
    </section>
  );
};
