import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.usersRoles.dialog;

export interface DeactivateDialogProps {
  open: boolean;
  /** 어느 자원을 중지하는지. 자원이 늘면 이 props로 이름만 바꿔 쓴다. */
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
}

/**
 * 사용 중지 확인. 기존 디자인 시스템 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다 —
 * 조합물을 미리 디자인 시스템으로 올리지 않는다.
 *
 * **건수를 내지 않는다**(계획 결정 12). 화면이 쓸 수 있는 건수(`editability.referenceCount`)는
 * 「코드 필드를 고칠 수 있는지」의 근거이지 「이 사용자에게 배정된 자료의 수」가 아니다 —
 * 두 뜻을 섞으면 화면이 지어낸다. 건수를 내려면 계약에 그 값을 담을 자리가 먼저 필요하다.
 *
 * **되돌리는 경로가 없다는 사실을 본문이 먼저 밝힌다.** 계약에 되살리는 오퍼레이션이 없고
 * 수정 본문에도 사용 여부가 없다.
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌릴 수 없는 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const DeactivateDialog = ({
  open,
  title,
  onClose,
  onConfirm,
  isSaving,
  banner,
}: DeactivateDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={title}
    closeOnBackdropClick={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {messages.common.deactivate}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.deactivateDescription}</p>
  </Dialog>
);
