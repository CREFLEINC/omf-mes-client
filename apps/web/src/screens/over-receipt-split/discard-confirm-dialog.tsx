import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.overReceiptSplit;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 파기 확인.
 *
 * **친 수량이 확인 없이 사라지지 않게 한다.** 대상을 바꾸거나 조건을 다시 걸면 초안은
 * 뜻을 잃어 비워야 하는데(수명 표 1·3·4행), 그때 사용자가 방금 친 값이 말없이 사라지면
 * 무엇을 잃었는지도 알 수 없다.
 *
 * **창 안에 선택칸을 두지 않는다.** 창 본문이 선택 목록을 자르는 결함(#45 ·
 * DS `design-system-v2-webui#68`)이 아직 고쳐지지 않았다 — 고칠 수 없는 결함은
 * **걸릴 자리를 만들지 않는 것**으로 피한다. 이 창에 필요한 것은 문장 하나와 버튼 둘뿐이다.
 *
 * **스크림 클릭으로 닫히는 것을 막지 않는다.** 실수로 닫혀도 초안이 그대로 남아
 * 잃는 것이 없다 — 되돌릴 수 없는 확인 창과 다른 자리다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DiscardConfirmDialog = ({ onConfirm, onClose }: DiscardConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.dialog.discardTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.discardDraft}</Button>
      </>
    }
  >
    <p>{messages.common.discardChangesConfirm}</p>
  </Dialog>
);
