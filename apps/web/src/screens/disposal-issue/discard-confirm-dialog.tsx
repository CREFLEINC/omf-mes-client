import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.disposalIssue;

export interface DiscardConfirmDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 파기 확인 — **두 초안이 함께 쓴다.**
 *
 * 「품의 발의」 탭의 초안은 두 벌이다(줄 선택·폐기 수량 / 품의 정보와 상신 사유). 「입력 지우기」는
 * **둘을 함께** 버리므로, 친 값이 말없이 사라지면 무엇을 잃었는지도 알 수 없다 — 줄마다 친
 * 수량과 여러 줄로 적은 상신 사유는 특히 되찾는 비용이 크다.
 *
 * **서버를 부르지 않는다.** 이 조작은 보내기 전 복귀다 — 만들어진 전표를 되돌리는 것이 아니다.
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`). 여기 필요한 것은 문장 하나와 버튼 둘뿐이다.
 *
 * **스크림 클릭으로 닫히는 것을 막지 않는다.** 실수로 닫혀도 초안이 그대로 남아 잃는 것이
 * 없다 — 되돌릴 수 없는 상신 확인 창과 갈리는 자리다.
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
        <Button onClick={onConfirm}>{t.actions.confirmDiscard}</Button>
      </>
    }
  >
    <p>{messages.common.discardChangesConfirm}</p>
  </Dialog>
);
