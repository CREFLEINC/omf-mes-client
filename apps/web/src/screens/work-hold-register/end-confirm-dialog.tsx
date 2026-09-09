import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.workHoldRegister;

export interface EndConfirmDialogProps {
  sessionNo: number;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 세션 종료 확인 — **되돌릴 수 없다**(스펙 §5-4 · 2026-09-06 게이트 승인).
 *
 * 닫힌 세션에는 사건을 남길 수 없고(§4-A `work_session_id` NOT NULL 은 «열린» 세션을
 * 전제한다) 다시 여는 경로도 없다 — 이어서 일하려면 **새 세션**을 열어야 한다. 그래서 이
 * 조작만 확인을 거친다: 중단·재개는 반대 방향이 있어 되돌릴 수 있다.
 *
 * ⛔ **스크림 클릭으로 닫히는 것을 막는다**(`closeOnBackdropClick={false}`). 장갑 낀 손이
 * 화면을 스치는 일이 잦은 현장 단말이라, 실수로 닫히는 쪽이 아니라 **실수로 눌리는 쪽**을
 * 막아야 한다 — 되돌릴 수 없는 확인 창의 표준 형태다.
 *
 * ⛔ **문구가 「확인/취소」가 아니다** — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const EndConfirmDialog = ({ sessionNo, onConfirm, onClose }: EndConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    closeOnBackdropClick={false}
    title={t.end.confirmTitle}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {t.end.keepWorking}
        </Button>
        <Button onClick={onConfirm}>{t.end.confirmAction}</Button>
      </>
    }
  >
    <p>{t.end.confirmBody(sessionNo)}</p>
  </Dialog>
);
