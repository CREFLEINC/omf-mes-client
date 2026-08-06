import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type PlanActionKind = 'approve' | 'deactivate';

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
 * 승인·사용 중지 확인.
 *
 * 두 액션 모두 **되돌릴 수 없다** — 계약이 승인 해제를 제공하지 않고, 물리 삭제도 없어
 * 사용 중지가 마지막 상태다. 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 *
 * 두 액션을 한 부품으로 두는 이유는 다른 것이 문구뿐이기 때문이다 —
 * 창을 둘로 나누면 확인 단계의 규칙이 두 곳에서 갈린다.
 */
export const PlanActionDialog = ({
  open,
  kind,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: PlanActionDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={kind === 'approve' ? t.dialog.approveTitle : t.dialog.deactivateTitle}
    closeOnBackdropClick={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {kind === 'approve' ? t.actions.approve : messages.common.deactivate}
        </Button>
      </>
    }
  >
    {banner}
    <p>{kind === 'approve' ? t.dialog.approveDescription : t.dialog.deactivateDescription}</p>
  </Dialog>
);
