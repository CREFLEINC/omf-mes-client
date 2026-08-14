import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { PostApproval } from './approval-progress';
import { describeReference, toReference, type ReferenceSource } from './lookups';
import type { IssueView } from './types';

const t = messages.disposalIssue;

/**
 * 그 전표가 **어디로 가는가** — 세 갈래(변경 통지 #128 · 완료 조건 C26).
 *
 * | 전표의 도착지 짝 | 화면이 말하는 것 |
 * | --- | --- |
 * | 둘 다 없다 | **「자체 폐기」** — 외부 업체 없이 직접 폐기한다는 **사용자가 정한 사실**이다 |
 * | 둘 다 있다 | **「코드 · 이름」** — 이름 풀이 조회가 푼 거래처 |
 * | 이름을 못 풀었다 | **그 사실을 적는다** — 번호를 대신 내지 않는다(`omf-mes#44`) |
 *
 * **한쪽만 온 전표를 자체 폐기로 접지 않는다.** 짝은 함께 있거나 함께 없고(#128 ⛔), 유형만
 * 실려 온 전표에서 사실인 것은 「누가 가져갔는지 모른다」다 — 그것을 「외부 업체가 없다」로
 * 접으면 화면이 확인하지 않은 것을 말하게 된다. 그래서 **짝이 통째로 없을 때만** 자체 폐기다.
 *
 * **못 푼 이름·미도착·실패를 갈라 낸다**(`omf-mes#47`) — 이름 풀이의 네 갈래 판정을 그대로
 * 쓴다. 이 자리에서 다시 판정하면 같은 사실이 화면에서 두 낱말로 보인다.
 *
 * 부품이 참조를 **통째로** 받는 것은 이 판정이 네 갈래를 함께 봐야 성립하기 때문이다 —
 * 이름 하나만 받으면 「목록에 없음」과 「아직 오지 않음」이 똑같이 빈 글자로 온다.
 */
export const describeIssueDestination = (
  issue: Pick<IssueView, 'destinationTypeCode' | 'destinationId'>,
  partners: ReferenceSource,
): string => {
  if (issue.destinationTypeCode === null && issue.destinationId === null) {
    return t.values.selfDisposal;
  }

  return describeReference(toReference(partners, issue.destinationId));
};

export interface PostPaneProps {
  /**
   * 승인 판정 네 갈래. **안내를 낼지 가르는 것은 첫째 갈래 하나뿐**이고, 잠글지는
   * `blockReason`이 정한다 — 이 부품이 두 판정을 겹쳐 하면 한쪽만 고쳐질 때 「잠겼는데
   * 판정하지 못한다고 적힌」 화면이 된다.
   */
  approval: PostApproval;
  /**
   * 왜 막혔는지. `null`이면 보낼 수 있다 — 사유 없이 잠그지 않는다(배치 규범 4).
   *
   * **판정을 여기서 만들지 않는다.** 미상신인가·승인 전인가는 `validation.ts` 한 곳에서 나오고
   * 그 사유를 **그대로** 낸다 — 두 곳이 각자 판정하면 잠긴 이유와 적힌 사유가 갈린다.
   */
  blockReason: string | null;
  /**
   * 그 전표가 어디로 가는가 — **글자만 받는다**(`describeIssueDestination`이 만든다).
   *
   * 제목줄이 창고 이름을 받는 것과 같은 형태다: 참조의 실패 안내와 복구는 그 이름이 실제로
   * 실패로 보이는 자리가 소유하고, 이 부품에는 번호를 문자열로 만드는 자리가 없다(`omf-mes#44`).
   */
  destination: string;
  /** 전송 중인가. **첫째 겹**이다 — 핸들러 가드(둘째 겹)와 짝이다 */
  isLocked: boolean;
  onOpenConfirm: () => void;
}

/**
 * 기타출고 처리 구획 — **이 화면에서 재고가 실제로 움직이는 유일한 자리다.**
 *
 * ### 《처리하면 일어나는 일》이 상시 자리에 있는 이유 (계획 결정 14의 첫째 겹)
 *
 * 세 문장은 **버튼이 잠겨 있을 때도** 선다. 잠금과 함께 감추면 정작 눌릴 수 있는 상태에서만
 * 경고가 뜨는데, 그때는 이미 사용자가 누르러 온 순간이라 읽지 않는다. **성공 뒤에 사라지는
 * 자리(토스트)로 옮기지 않는 이유도 같다** — 사라지는 글자는 되돌릴 수 없는 조작 앞에서
 * 아무것도 막지 못한다(감지기 M66·M67).
 *
 * ### 잠그는 것과 밝히는 것 (승인 기록 §13-2 안 1)
 *
 * | 사정 | 화면이 아는가 | 이 구획 |
 * | --- | :-: | --- |
 * | **미상신 전표** | **안다**(승인 요청 값이 없다) | **잠근다** + 사유 |
 * | 승인 완료 코드가 미확정 | **모른다** | **잠그지 않고 밝힌다** |
 * | 결재 진행을 못 읽었다 | 모른다 | 잠그지 않는다 — 그 사실은 확인 창이 적는다 |
 * | 자리표시가 찼고 승인 전 | 안다 | **잠근다** + 사유 |
 *
 * 모르는 것을 잠금으로 접으면 **승인된 건까지 처리할 수 없어** 화면이 통째로 무용해진다 —
 * 잠금이 위험을 줄이는 것이 아니라 옮긴다. 잠금의 정본은 서버이고 계약이 그것을 명시했다
 * (승인이 끝나기 전 전기는 400). 화면은 **아는 것만 말한다.**
 *
 * **이미 상신·승인된 전표에서만 서는 구획이 아니다.** 미상신 전표에서도 잠긴 채로 선다 —
 * 감추면 「왜 여기서는 처리할 수 없는가」에 화면이 답하지 못한다(재상신 구획과 같은 판단).
 *
 * **상신 사유·수량을 여기서 되보이지 않는다** — 그것은 확인 창의 일이다. 이 구획은
 * 「무엇이 일어나는가」와 「지금 누를 수 있는가」만 말한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PostPane = ({
  approval,
  blockReason,
  destination,
  isLocked,
  onOpenConfirm,
}: PostPaneProps) => {
  const paneId = useId();
  const blockReasonId = `${paneId}-block`;
  const lockedReasonId = `${paneId}-locked`;

  /*
   * **잠금 사유와 전송 중 사유를 갈라 둔다.** 전송 중에는 무엇이 막혔는지가 아니라 「끝나면
   * 열린다」가 사용자가 알아야 할 것이고, 앞의 사유를 그대로 두면 이미 갖춰진 조건을 다시
   * 갖추라고 말하는 것이 된다.
   */
  const reasonId = isLocked ? lockedReasonId : blockReasonId;
  const reasonText = isLocked ? t.actionReasons.postLocked : blockReason;

  return (
    <section className="pane" aria-label={t.post.label}>
      <p>{t.post.lead}</p>

      {/*
       * **도착지를 처리 직전에 읽어 보인다**(변경 통지 #128 · 완료 조건 C26). 재고가 실제로
       * 움직이는 자리라 「누가 가져가는가」가 여기서 확인돼야 하고, **잠겨 있을 때도** 보인다 —
       * 잠금과 함께 감추면 승인 전에는 도착지를 확인할 길이 사라진다.
       *
       * 여기에 **고르는 컨트롤을 두지 않는다**(승인 기록 D-1 안 A). 계약에 전표 헤더를 고치는
       * 경로가 없어 이 시점에 고른 값은 보낼 통로가 없다 — 두면 사용자가 고른 거래처가
       * 조용히 사라진다.
       */}
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.post.destinationLabel}</dt>
          <dd>{destination}</dd>
        </div>
      </dl>

      {/*
       * **상시 문구는 버튼보다 앞에 둔다.** 뒤에 두면 누르고 난 뒤에야 눈에 들어온다.
       * 구획으로 감싸 이름을 붙이는 것은 스크린리더가 세 문장을 한 덩어리로 읽게 하기 위해서다.
       */}
      <section className="banner-slot" aria-label={t.post.effectsLabel}>
        <p className="field-label">{t.post.effectsLabel}</p>
        <p>{t.post.effectDeducts}</p>
        <p>{t.post.effectApprovalIsNotPosting}</p>
        <p>{t.post.effectNoUndoHere}</p>
      </section>

      {/*
       * **모른다는 사실을 화면에 남긴다**(`omf-mes#64`). 자리표시가 채워지면 이 안내가 사라지고
       * 승인 전 전표의 버튼이 잠긴다 — 그 전환을 재는 것이 이 줄의 값어치다.
       */}
      {approval.kind === 'judgePending' && <p className="field-note">{t.post.unjudgeableNote}</p>}

      <div className="form-actions">
        <div className="field-cell">
          <Button
            disabled={blockReason !== null || isLocked}
            loading={isLocked}
            aria-describedby={reasonText === null ? undefined : reasonId}
            onClick={onOpenConfirm}
          >
            {t.actions.postIssue}
          </Button>
          {reasonText !== null && (
            <span id={reasonId} className="field-note">
              {reasonText}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
