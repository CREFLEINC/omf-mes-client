import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.productDisposalRequest.confirm;

export interface SubmitConfirmDialogProps {
  /** 고른 대상 건수. */
  count: number;
  /** 합계 수량. 단위가 섞이면 `—` 다 — 셀 수 없는 것을 수로 적지 않는다. */
  qtyText: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 「승인 요청」 확인 창.
 *
 * ⭐ **되돌릴 수 없는 쓰기 앞에 한 겹을 둔다.** 상신 철회 경로가 승인 계약에 없어(§5-6)
 * 잘못 올린 요청은 **결재함의 반려로만** 되돌아온다 — 누르기 전에 무엇이 나가는지 보인다.
 *
 * ⛔ **버튼 문구를 「확인/취소」로 두지 않는다** — 무엇을 누르는지 창을 다시 읽지 않아도
 * 알아야 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */
export const SubmitConfirmDialog = ({
  count,
  qtyText,
  onConfirm,
  onClose,
}: SubmitConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    showCloseButton={false}
    title={t.title}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button onClick={onConfirm}>{t.submit}</Button>
      </>
    }
  >
    <p>{t.target(count, qtyText)}</p>
    <p className="field-note">{t.approvalNote}</p>
    {/* ⛔ 되돌릴 수 없다는 사실을 «누르기 전»에 적는다. 누른 뒤에 적으면 소용이 없다. */}
    <p className="field-note">{t.irreversible}</p>
  </Dialog>
);
