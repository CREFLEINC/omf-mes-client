import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type PlanActionKind = 'deactivate';

export interface PlanActionDialogProps {
  open: boolean;
  kind: PlanActionKind;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 사용자가 다음 행동을 정할 수 있다. */
  banner: ReactNode;
}

/**
 * 사용 중지 확인. 승인 단추는 걷었다 — 승인이 현장 검사에 효력이 없는 기록뿐이라(사용자 지시 · #208).
 *
 * **되돌릴 수 없다** — 물리 삭제가 없어 사용 중지가 마지막 상태다.
 * 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const PlanActionDialog = ({
  open,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: PlanActionDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={t.dialog.deactivateTitle}
    closeOnBackdropClick={false}
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {messages.common.deactivate}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.dialog.deactivateDescription}</p>
  </Dialog>
);
