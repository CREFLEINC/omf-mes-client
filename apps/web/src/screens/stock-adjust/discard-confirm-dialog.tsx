import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.stockAdjust;

export interface DiscardConfirmDialogProps {
  /**
   * 등록이 나가는 중인가.
   *
   * **버리기를 막지 않는다.** 이 창은 화면의 초안을 비우는 조작이고 서버에 간 요청을 취소하는
   * 조작이 아니다 — 대신 그 사실을 **글자로 밝힌다.** 막아 버리면 사용자가 응답이 올 때까지
   * 아무것도 할 수 없고, 밝히지 않으면 등록이 취소된 줄 안다.
   */
  isSaving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 초안 버리기 확인 — **서버를 부르지 않는다.**
 *
 * **무엇이 사라지고 무엇이 남는지 적는다.** 표의 줄과 고른 사유가 사라지고, 실사 차이는 다시
 * 부를 수 있다 — 「버릴까요?」만으로는 어디까지 돌아가는지 알 수 없다.
 *
 * **스크림 클릭과 X를 막지 않는다**(D-17 · 전례 우선 판정 · 사본 체크리스트 5번).
 * 실수로 닫혀도 **아무것도 버리지 않으므로** 잃는 것이 없다. 규칙은 「막는다」가 아니라
 * **「되돌릴 수 없는 창은 막고 버리기 창은 연다」**로 읽혀야 한다 — **등록 확인 창과 갈리는
 * 자리다**(그쪽은 되돌릴 수 없는 조작이라 둘 다 막는다).
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45`) — 문장과 버튼뿐이다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DiscardConfirmDialog = ({
  isSaving,
  onConfirm,
  onClose,
}: DiscardConfirmDialogProps) => (
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
    <p>{t.dialog.discardLead}</p>

    {/* 나가는 요청이 있을 때만 적는다 — 없을 때 적으면 없는 위험을 말하게 된다. */}
    {isSaving && <p className="field-note">{t.dialog.discardWhileSaving}</p>}
  </Dialog>
);
