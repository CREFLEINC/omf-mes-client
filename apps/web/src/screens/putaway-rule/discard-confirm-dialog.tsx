import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.putawayRule;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 파기 확인.
 *
 * **고른 규칙이 바뀔 때 친 값이 확인 없이 사라지지 않게 한다.** 고친 값을 서버 값으로
 * 되돌리는 조작이라 눌린 순간 되돌릴 수 없다 — 되돌릴 수 없는 조작 앞에 한 걸음을 둔다.
 * 편집 중에 다른 규칙을 고르거나 새 규칙을 만들려는 길이 같은 걸음을 지난다(C3-15).
 *
 * ⚠ **조건 변경·조건 칩 ×·초기화·쪽 이동은 이 걸음을 지나지 않는다.** 그 넷은 보이는 행이
 * 통째로 달라지는 조작이라 조작별 상태 표가 편집 대상을 **비우는 것**으로 정해 두었다 —
 * 걸음을 넓히면 조건을 만질 때마다 창이 서서 조회 자체가 번거로워진다. 넓혀야 한다는
 * 판단이 서면 상태 표의 1~3행을 먼저 고친다.
 *
 * **창 안에 선택칸을 두지 않는다**(`design-system-v2-webui#68`). 여기 필요한 것은 문장 하나와
 * 버튼 둘뿐이다.
 *
 * **스크림 클릭으로 닫히는 것을 막지 않는다.** 실수로 닫혀도 초안이 그대로 남아 잃는 것이
 * 없다 — 나가는 요청이 걸린 확인 창(끄기·켜기)과 갈리는 자리다.
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
    <p>{t.dialog.discardBody}</p>
  </Dialog>
);
