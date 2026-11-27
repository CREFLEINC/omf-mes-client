import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';

import { decisionBlockedReason } from './decision-draft';
import { DisabledAction } from './disabled-action';

const t = messages.approvalInbox;

export interface DecisionPaneProps {
  /** 서버가 준 `isMyTurn` 그대로. **단계 배열을 훑어 얻은 값이 아니다**(계획 결정 7). */
  isMyTurn: boolean;
  /** 적고 있는 의견. 값의 주인은 화면이다 — 고른 요청이 바뀌면 화면이 비운다. */
  comment: string;
  onChangeComment: (value: string) => void;
  /** 입력칸 옆에 낼 오류. 로컬 판정과 서버의 필드 오류가 같은 자리에 온다. */
  commentError?: string;
  /** 결재가 나가는 중인가. **입력칸과 버튼이 함께 잠긴다**(첫째 겹). */
  isLocked: boolean;
  onApprove: () => void;
  onReject: () => void;
  /** 실패 배너 슬롯. 오류 갈래를 아는 것은 화면이라 부품은 자리만 내준다. */
  banner: ReactNode;
}

/**
 * 결재 구획 — **의견을 적고 승인·반려를 시작하는 자리.**
 *
 * **의견 입력칸이 창이 아니라 여기 있다.** 사용자가 무엇을 결재하는지(사유·대상·진행)를 보면서
 * 의견을 써야 하고, 확인 창은 「정말 보낼 것인가」만 묻는 자리로 남아야 한다.
 *
 * **입력칸은 하나뿐이다.** 승인이면 선택이고 반려면 필수라 라벨에 필수 표시를 붙이지 않는다 —
 * 붙이면 승인에는 거짓말이 된다. 어느 쪽에 무엇이 필요한지는 라벨 옆 ⓘ 와 반려 버튼의 사유가 말한다.
 *
 * ---
 *
 * **되돌릴 수 없는 조작의 네 겹 중 셋이 이 부품에 보인다.**
 *
 * | 겹 | 여기서 |
 * | :-: | --- |
 * | ① 상시 문구 | 자물쇠 문구가 **구획 제목 옆 ⓘ** 에 늘 있다. 버튼이 잠겨 있어도 있다 — 확인 창이 한 번 더 펼쳐 보인다 |
 * | ② 확인 창 | 버튼은 창을 열 뿐이다 — 이 부품은 요청을 보내지 않는다 |
 * | ③ 전면 잠금 | `isLocked`가 입력칸과 버튼을 함께 잠근다(첫째 겹) |
 *
 * **자물쇠 문구를 성공 알림에 넣지 않는다.** 알림은 사라지지만 이 문장은 결재함을 보는 내내
 * 참인 사실이고, **버튼이 잠겨 있을 때도 참이다** — 그래서 문구의 자리가 버튼의 상태와 무관하다.
 * 늘 펼쳐 두지는 않고 제목 옆 ⓘ 로 둔다(관리웹 정리 시안 A).
 *
 * **잠금 사유가 갈린다.** 「내 차례가 아니다」는 서버가 준 사실이고 「보내는 중이다」는 지금
 * 이 화면의 상태다 — 한 문구로 뭉개면 사용자가 기다려야 할지 물어봐야 할지 알 수 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DecisionPane = ({
  isMyTurn,
  comment,
  onChangeComment,
  commentError,
  isLocked,
  onApprove,
  onReject,
  banner,
}: DecisionPaneProps) => {
  const commentId = useId();
  const state = { isMyTurn, comment };
  const approveBlocked = decisionBlockedReason('approve', state);
  const rejectBlocked = decisionBlockedReason('reject', state);
  const isNotMyTurn = !isMyTurn;
  const isCommentDisabled = isNotMyTurn || isLocked;
  const turnNoteId = useId();

  return (
    <div className="approval-inbox-detail-section" role="group" aria-label={t.panes.decision}>
      {/* 「승인해도 처리는 원 화면에서」는 겹치지 않는 안내라 남긴다(#361). */}
      <h3 className="info-label">
        {t.panes.decision}
        <InfoTip text={t.decision.lockNote} />
      </h3>
      {banner}

      <div className="field-cell">
        {/* 「(반려 시 필수)」가 이름표에 있어 ⓘ 는 두지 않는다(#361). */}
        <label className="field-label" htmlFor={commentId}>
          {t.decision.commentLabel}
        </label>
        {/* 칸 아래 도움말이 칸 폭을 넓혀 주던 자리 — 걷은 뒤에도 좁아지지 않게 칸(최대 44rem)을 채운다. */}
        <TextField
          id={commentId}
          fullWidth
          value={comment}
          disabled={isCommentDisabled}
          aria-describedby={isNotMyTurn ? turnNoteId : undefined}
          /*
           * 잠긴 이유를 갈라 낸다 — 보내는 중이면 여기 적고, 내 차례가 아니면 단추 줄 아래 한 줄
           * (`turnNoteId`)이 말한다. 같은 문장을 칸 · 단추마다 되풀이하지 않는다.
           */
          disabledReason={isLocked ? t.decision.commentSendingReason : undefined}
          error={commentError}
          onChange={(event) => {
            onChangeComment(event.target.value);
          }}
        />
      </div>

      <div className="form-actions approval-inbox-actions">
        {/* 되돌리기 쪽(반려)이 왼쪽, 흔한 길(승인)이 오른쪽 — 이 저장소의 액션 줄 차례 그대로다. */}
        {isNotMyTurn ? (
          <>
            <Button variant="outlined" disabled aria-describedby={turnNoteId}>
              {t.decision.reject}
            </Button>
            <Button variant="filled" disabled aria-describedby={turnNoteId}>
              {t.decision.approve}
            </Button>
            {/* 잠긴 까닭은 단추 옆 ⓘ 에 올리면 보인다(#361). */}
            <InfoTip text={t.decision.blockedNotMyTurn(t.decision.approve)} />
          </>
        ) : (
          <>
            {rejectBlocked === null ? (
              <Button variant="outlined" disabled={isLocked} onClick={onReject}>
                {t.decision.reject}
              </Button>
            ) : (
              <DisabledAction label={t.decision.reject} reason={rejectBlocked} />
            )}

            {approveBlocked === null ? (
              <Button variant="filled" disabled={isLocked} onClick={onApprove}>
                {t.decision.approve}
              </Button>
            ) : (
              <DisabledAction variant="filled" label={t.decision.approve} reason={approveBlocked} />
            )}
          </>
        )}
      </div>
      {isNotMyTurn && (
        <p id={turnNoteId} className="visually-hidden">
          {t.decision.blockedNotMyTurn(t.decision.approve)}
        </p>
      )}
    </div>
  );
};
