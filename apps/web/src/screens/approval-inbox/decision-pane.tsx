import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

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
 * 붙이면 승인에는 거짓말이 된다. 어느 쪽에 무엇이 필요한지는 도움말과 반려 버튼의 사유가 말한다.
 *
 * ---
 *
 * **되돌릴 수 없는 조작의 네 겹 중 셋이 이 부품에 보인다.**
 *
 * | 겹 | 여기서 |
 * | :-: | --- |
 * | ① 상시 문구 | 자물쇠 문구가 **버튼 바로 위 상시 자리**에 선다. 버튼이 잠겨 있어도 보인다 |
 * | ② 확인 창 | 버튼은 창을 열 뿐이다 — 이 부품은 요청을 보내지 않는다 |
 * | ③ 전면 잠금 | `isLocked`가 입력칸과 버튼을 함께 잠근다(첫째 겹) |
 *
 * **자물쇠 문구를 성공 알림에 넣지 않는다.** 알림은 사라지지만 이 문장은 결재함을 보는 내내
 * 참인 사실이고, **버튼이 잠겨 있을 때도 참이다** — 그래서 문구의 자리가 버튼의 상태와 무관하다.
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
  const isCommentDisabled = !isMyTurn || isLocked;

  return (
    <div className="approval-inbox-detail-section" role="group" aria-label={t.panes.decision}>
      <h3>{t.panes.decision}</h3>
      {banner}

      <div className="field-cell">
        <TextField
          id={commentId}
          label={t.decision.commentLabel}
          value={comment}
          disabled={isCommentDisabled}
          helperText={t.decision.commentHelp}
          /*
           * 잠긴 이유를 갈라 낸다 — 보내는 중이면 기다리면 되고, 내 차례가 아니면 기다려도
           * 이 화면에서는 열리지 않는다. 디자인 시스템이 잠겼을 때만 이 글자를 낸다.
           */
          disabledReason={
            isLocked ? t.decision.commentSendingReason : t.decision.commentDisabledReason
          }
          error={commentError}
          onChange={(event) => {
            onChangeComment(event.target.value);
          }}
        />
      </div>

      {/*
       * **상시 자리다.** 버튼의 상태와 무관하게 늘 선다 — 승인이 무엇을 하고 무엇을 하지
       * 않는지는 누를 수 있는지와 상관없이 참인 사실이다.
       */}
      <p className="field-note">{t.decision.lockNote}</p>

      <div className="form-actions">
        {/* 되돌리기 쪽(반려)이 왼쪽, 흔한 길(승인)이 오른쪽 — 이 저장소의 액션 줄 차례 그대로다. */}
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
      </div>
    </div>
  );
};
