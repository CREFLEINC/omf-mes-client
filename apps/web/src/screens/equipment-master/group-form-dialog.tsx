import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.equipmentMaster;

export interface GroupFormDialogProps {
  /** 팝업 안 입력 칸 — 화면이 `GroupFormPane`(단추 줄 없이)을 넣는다. */
  children: ReactNode;
  /** 필수 칸이 모두 찼는가. 차지 않으면 [등록]이 꺼진다. */
  canRegister: boolean;
  isSaving: boolean;
  /** [취소]·Escape — 입력이 있으면 화면이 「입력한 내용을 버릴까요?」를 먼저 묻는다. */
  onCancel: () => void;
  onRegister: () => void;
}

/**
 * 설비 그룹 등록 팝업(omf-all-around#360 「그룹 추가 시엔 팝업으로 등록」).
 *
 * 보내는 값·검증·저장 뒤 동작은 본문 폼일 때와 같다 — 여는 자리만 팝업이다.
 * 설비 등록 팝업과 같이 팝업 밖을 눌러도 닫히지 않게 한다(친 값을 지킨다).
 */
export const GroupFormDialog = ({
  children,
  canRegister,
  isSaving,
  onCancel,
  onRegister,
}: GroupFormDialogProps) => (
  <Dialog
    open
    onClose={onCancel}
    closeOnBackdropClick={false}
    title={t.form.createTitle}
    footer={
      <>
        <Button variant="outlined" disabled={isSaving} onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={!canRegister || isSaving} onClick={onRegister}>
          {t.actions.register}
        </Button>
      </>
    }
  >
    {children}
  </Dialog>
);
