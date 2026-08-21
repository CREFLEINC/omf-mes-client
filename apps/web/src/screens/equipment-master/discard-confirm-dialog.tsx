import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.equipmentMaster;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 편집 중 다른 대상으로 옮겨 갈 때의 확인.
 *
 * **친 값이 확인 없이 사라지지 않게 한다.** 다른 그룹을 고르거나 등록 폼을 열면 지금 폼은
 * 통째로 버려지는데, 그때 사용자가 방금 넣은 이름·코드가 말없이 사라지면 무엇을 잃었는지도
 * 알 수 없다.
 *
 * **스크림 클릭·Escape 로 닫히는 것을 막지 않는다.** 실수로 닫혀도 입력이 그대로 남아
 * 잃는 것이 없다 — 되돌릴 수 없는 실행 확인 창과 갈리는 자리다.
 *
 * **창 안에 선택칸을 두지 않는다.** 창 본문이 선택 목록을 자르는 결함이 아직 남아 있어,
 * 걸릴 자리를 만들지 않는 것으로 피한다. 이 창에 필요한 것은 문장 하나와 버튼 둘뿐이다.
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
        <Button onClick={onConfirm}>{t.actions.discardChanges}</Button>
      </>
    }
  >
    <p>{messages.common.discardChangesConfirm}</p>
  </Dialog>
);
