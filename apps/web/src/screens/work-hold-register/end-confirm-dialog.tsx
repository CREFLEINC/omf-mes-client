import { messages } from '@omf-mes/i18n';

import { PuConfirm } from '../../patterns/pop-uniform';

const t = messages.workHoldRegister;

export interface EndConfirmDialogProps {
  sessionNo: number;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * 세션 종료 확인 — **되돌릴 수 없다**(스펙 §5-4 · 2026-09-06 게이트 승인).
 *
 * 닫힌 세션에는 사건을 남길 수 없고 다시 여는 경로도 없다 — 이어서 일하려면 **새 세션**을 열어야
 * 한다. 그래서 이 조작만 확인을 거친다: 중단·재개는 반대 방향이 있어 되돌릴 수 있다.
 *
 * ⭐ POP 통일 창(`PuConfirm`) — 머리 X 없이 아래 [계속 작업] · [종료] 두 단추. 창 바깥을 눌러 닫히지 않는다.
 * ⛔ **문구가 「확인/취소」가 아니다** — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다.
 */
export const EndConfirmDialog = ({ sessionNo, onConfirm, onClose }: EndConfirmDialogProps) => (
  <PuConfirm
    title={t.end.confirmTitle}
    confirmLabel={t.end.confirmAction}
    cancelLabel={t.end.keepWorking}
    onConfirm={onConfirm}
    onCancel={onClose}
  >
    {t.end.confirmBody(sessionNo)}
  </PuConfirm>
);
