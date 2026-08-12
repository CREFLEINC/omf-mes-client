import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.approvalInbox;

export interface ApproveDialogProps {
  /** 업무 번호. **무엇을 승인하는지 창 안에서도 밝힌다** — 내부 번호는 오지 않는다. */
  approvalRequestNo: string;
  /**
   * **보낼 의견 그대로.** 비었으면 `undefined`이고, 그때 본문에도 `comment` 키가 없다 —
   * 화면이 보여 주는 것과 나가는 것이 같은 값에서 온다.
   */
  comment: string | undefined;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 승인 확인 창 — **입력받지 않고 확인만 한다.**
 *
 * 의견은 아래 구획에서 이미 적었다(설계 스펙의 배치). 이 창이 하는 일은 셋이다:
 * 무엇을 승인하는지 · 무엇이 함께 기록되는지 · **되돌릴 수 없다는 사실**을 말한다.
 *
 * **자물쇠 문구를 여기서 되풀이한다.** 구획에도 상시로 서 있지만, 승인을 확정하는 순간이
 * 「그래서 전기·출고는 언제 되나」가 가장 궁금해지는 자리다(전례 `approval-route`의 진행 중 건수).
 *
 * **창 안에 선택칸을 두지 않는다.** 창 본문이 펼침 목록을 자르는 결함(`omf-mes#45`)이 아직
 * 고쳐지지 않았다 — 걸릴 자리를 만들지 않는 것으로 피한다. 여기 필요한 것은 문장 넷과 버튼 둘뿐이다.
 *
 * **나가는 길을 바닥 버튼 둘로 좁힌다.** 되돌릴 수 없는 확인 창이 스크림 클릭이나 X 손잡이로
 * 사라지면 사용자는 자기가 무엇을 취소했는지 모른다. 디자인 시스템은 X를 기본으로 그리고
 * **진행 상태를 받지 않아 전송 중에도 눌린다** — 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
 *
 * **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기
 * 요청으로 무조건 잇는다. 그래서 규율은 「닫히지 않게」가 아니라 **「닫혀도 나가는 요청이
 * 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`)에 있다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ApproveDialog = ({
  approvalRequestNo,
  comment,
  isSaving,
  onClose,
  onConfirm,
}: ApproveDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.dialog.approveTitle}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        {/* 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.decision.approve}
        </Button>
      </>
    }
  >
    <p>{t.dialog.subject(approvalRequestNo)}</p>
    <p>{t.decision.lockNote}</p>

    {comment === undefined ? (
      /* 승인은 의견이 선택이다. 빈 칸을 내지 않고 **무엇이 기록되지 않는지**를 적는다. */
      <p>{t.dialog.noComment}</p>
    ) : (
      <>
        <p className="field-label">{t.dialog.commentHeading}</p>
        {/* 보낼 값 그대로다 — 여기 보이는 것과 나가는 것이 갈리면 확인의 뜻이 없다. */}
        <p>{comment}</p>
        <p className="field-note">{t.dialog.commentRecorded}</p>
      </>
    )}

    {/* 되돌릴 수 없다는 사실이 이 결정의 무게를 정한다 — 번복은 새 요청이다. */}
    <p>{t.dialog.irreversible}</p>
  </Dialog>
);
