import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.poRegister;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 버리기 확인 — **서버를 부르지 않는다.** 보내기 전 복귀이고, 만들어진 전표를 되돌리는
 * 것이 아니다.
 *
 * **무엇이 사라지는지 적는다.** 이 화면의 「취소」는 친 글자만 지우는 것이 아니라 **승계된 라인
 * 1행까지 되세운다**(수명 표 9행) — 「파기할까요?」만으로는 어디까지 돌아가는지 알 수 없다.
 *
 * **세 방어를 등록 확인 창과 같은 강도로 둔다**(계획 결정 15 · 사본 체크리스트 5번).
 * 전례의 버리기 창들은 스크림 클릭을 열어 두었다 — 잃는 것이 없다는 근거였다. 여기서 갈리는
 * 이유는 위와 같다: 이 창의 「버리기」는 사용자가 치지 않은 승계값까지 되세우므로, 스치는
 * 클릭으로 창이 사라지면 무엇을 취소했는지 알 수 없다.
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 문장 하나와 버튼 둘뿐이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DiscardConfirmDialog = ({ onConfirm, onClose }: DiscardConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
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
    <p>{t.dialog.discardLead}</p>
  </Dialog>
);
