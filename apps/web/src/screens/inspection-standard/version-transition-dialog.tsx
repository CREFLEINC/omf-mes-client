import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.inspectionStandard;

export type VersionTransitionKind = 'confirm' | 'obsolete';

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
 * 확정·폐기 확인. 두 전이 모두 **되돌릴 수 없다** — 확정은 그 버전을 수정 불가로 만들고,
 * 폐기는 그 버전을 쓸 수 없게 한다. 그래서 확인을 한 단계 두고 **무엇이 일어나는지 먼저 밝힌다.**
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
    title={kind === 'confirm' ? t.dialog.confirmTitle : t.dialog.obsoleteTitle}
    closeOnBackdropClick={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {kind === 'confirm' ? t.actions.confirm : t.actions.obsolete}
        </Button>
      </>
    }
  >
    {banner}
    <p>{kind === 'confirm' ? t.dialog.confirmDescription : t.dialog.obsoleteDescription}</p>
  </Dialog>
);
