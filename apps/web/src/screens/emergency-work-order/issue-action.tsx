import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
/**
 * 막힌 사유와 발행 단추를 잇는 id. 이 화면에 발행 자리는 하나뿐이라 고정값으로 둔다 —
 * 단추(발행 정보 구획 머리)와 사유(아래 결과 구획)가 서로 다른 부품에 서기 때문이다.
 */
const REASON_ID = 'emergency-work-order-issue-reason';

/**
 * ⛔ **「아직 안 채웠다」는 여기서 말하지 않는다**(사용자 결정 2026-09-21). 빈 품목 칸과
 * 붉은 테두리가 이미 그 사실을 말하고 있어, 화면 아래에서 또 적으면 같은 말을 두 번 읽는다.
 * 사용자가 스스로 풀 수 없는 사유(권한·전개·배포 결과)는 그대로 낸다.
 */
const SILENT_REASONS: readonly string[] = [
  messages.emergencyWorkOrder.lock.itemNotChosen,
  messages.emergencyWorkOrder.lock.inputIncomplete,
];

const visibleReason = (reason: string | undefined): string | undefined =>
  reason !== undefined && SILENT_REASONS.includes(reason) ? undefined : reason;

export interface IssueActionButtonsProps {
  lock: IssueLock;
  onIssue: () => void;
  onRetryRelease: () => void;
}

/**
 * 발행 단추 — **발행 정보 구획의 머리 오른쪽**에 선다(사용자 결정 2026-09-21). 입력을 다 채운
 * 자리에서 바로 누르게 하려는 것이고, 결과·사유는 아래 `IssueAction` 이 그대로 맡는다.
 */
export const IssueActionButtons = ({ lock, onIssue, onRetryRelease }: IssueActionButtonsProps) => {
  const t = messages.emergencyWorkOrder;

  return (
    <div className="emergency-work-order-action-buttons">
      {lock.canRetryRelease && (
        <Button variant="tonal" onClick={onRetryRelease}>
          {t.outcome.retryRelease}
        </Button>
      )}

      <Button
        disabled={lock.reason !== undefined}
        /* ⛔ 사유를 버튼에 «묶는다» — 화면에 적어 두기만 하면 버튼만 보는 사람에게 닿지 않는다. */
        aria-describedby={visibleReason(lock.reason) === undefined ? undefined : REASON_ID}
        onClick={onIssue}
      >
        {t.action}
      </Button>
    </div>
  );
};

export const IssueAction = ({ lock, releasedNo, pending, error }: IssueActionProps) => {
  const t = messages.emergencyWorkOrder;
  const reason = visibleReason(lock.reason);

  return (
    <section
      className="pane emergency-work-order-pane emergency-work-order-action-pane"
      aria-label={t.actionTitle}
    >
      <h2 className="pane-title">{t.actionTitle}</h2>

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

      {/* ⛔ 사유를 감추지 않는다 — 잠긴 이유가 보여야 무엇을 하면 되는지 안다. */}
      {reason !== undefined && (
        <div className="emergency-work-order-action-row">
          <p id={REASON_ID} role="status">
            {reason}
          </p>
        </div>
      )}
    </section>
  );
};
