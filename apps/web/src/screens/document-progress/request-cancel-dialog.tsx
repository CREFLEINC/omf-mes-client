import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.documentProgress;

export interface RequestCancelDialogProps {
  /** 어느 문서인가 — **업무 번호다.** 내부 번호를 창에 들이지 않는다(omf-mes#44). */
  documentNo: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. **창을 닫지 않고** 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 취소 요청 확인 창 — **되돌릴 수 없는 상신 앞의 마지막 층이다.**
 *
 * ## 창이 말하는 세 가지
 *
 * | # | 무엇 | 왜 |
 * | :-: | --- | --- |
 * | ⓐ | **승인을 탄다** | 지금 취소되는 것이 아니다. 「취소 요청」을 눌렀는데 문서가 그대로인 것을 결함으로 읽지 않게 한다 |
 * | ⓑ | ⛔ **철회할 수 없다** | 상신을 되무르는 오퍼레이션이 승인 계약에 **없다**(omf-mes#87). 잘못 올렸으면 승인자가 반려한다 — 무를 수 있다고 읽히면 사용자가 가볍게 누른다 |
 * | ⓒ | **어느 문서인가** | 목록에서 고른 뒤 창이 뜨기까지 사이가 있고, 이 화면은 여러 문서를 오가며 본다 |
 *
 * ⚠ **전례(`putaway-rule/activation-dialog.tsx`)와 갈리는 자리가 ⓑ다.** 그 창은 「다시 켤 수
 * 있습니다」라고 되돌릴 수 있음을 함께 말하는데, 여기서는 되돌리는 경로가 **없다.**
 *
 * ## 창의 경계
 *
 * - **나가는 길을 바닥 버튼 둘로 좁힌다** — 스크림(`closeOnBackdropClick={false}`)뿐 아니라
 *   **창 머리의 X 손잡이**(`showCloseButton={false}`)도 막는다. 그 손잡이는 진행 상태를 받지
 *   않아 전송 중에도 눌리며, 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
 * - **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기
 *   요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라 **「닫혀도 나가는
 *   요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`)에 있다.
 * - **창 안에 사유 칸을 두지 않는다.** 이 창은 값을 고치는 자리가 아니라 확인하는 자리다 —
 *   고칠 것이 있으면 닫고 구획에서 고친다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const RequestCancelDialog = ({
  documentNo,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: RequestCancelDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.cancelDialog.title}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {t.cancelDialog.keepEditing}
        </Button>
        {/* 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.cancelDialog.confirm}
        </Button>
      </>
    }
  >
    {banner}

    <p>{t.cancelDialog.target(documentNo)}</p>
    <p>{t.cancelDialog.approval}</p>
    <p>{t.cancelDialog.noWithdraw}</p>
  </Dialog>
);
