import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type VersionTransitionKind = 'confirm' | 'obsolete' | 'discard';

const TEXT: Record<VersionTransitionKind, { title: string; action: string; description: string }> =
  {
    confirm: {
      title: t.dialog.confirmTitle,
      action: t.actions.confirm,
      description: t.dialog.confirmDescription,
    },
    obsolete: {
      title: t.dialog.obsoleteTitle,
      action: t.actions.obsolete,
      description: t.dialog.obsoleteDescription,
    },
    discard: {
      title: t.dialog.discardTitle,
      action: t.actions.discard,
      description: t.dialog.discardDescription,
    },
  };

export interface VersionTransitionDialogProps {
  open: boolean;
  kind: VersionTransitionKind;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 사용자가 다음 행동을 정할 수 있다. */
  banner: ReactNode;
}

/**
 * 확정·폐기·작성 취소 확인. 셋 모두 **되돌릴 수 없다** — 확정은 그 버전을 수정 불가로 만들고,
 * 폐기는 그 버전을 쓸 수 없게 하고, 작성 취소는 그 버전을 지운다. 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const VersionTransitionDialog = ({
  open,
  kind,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: VersionTransitionDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={TEXT[kind].title}
    closeOnBackdropClick={false}
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {TEXT[kind].action}
        </Button>
      </>
    }
  >
    {banner}
    <p>{TEXT[kind].description}</p>
  </Dialog>
);
