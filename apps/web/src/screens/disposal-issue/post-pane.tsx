import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { PostApproval } from './approval-progress';

const t = messages.disposalIssue;

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
export const PostPane = ({ approval, blockReason, isLocked, onOpenConfirm }: PostPaneProps) => {
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
