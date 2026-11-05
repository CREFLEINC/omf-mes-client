import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.routing.values;

export interface SetDefaultDialogProps {
  /** 기본으로 지정할 개정(「Rev N」). 묻는 문장에 담아 대상을 못 박는다 */
  revisionLabel: string;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다 */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 기본 Rev 지정 확인(#231) — 이력 관리의 「기본 Rev」 고르기 칸이 연다.
 * 확인 창을 두는 이유: 서버가 지정과 함께 지금 기본인 개정을 해제한다 — 사용자가 고르지 않은 줄도 바뀐다.
 */
export const SetDefaultDialog = ({
  revisionLabel,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: SetDefaultDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="sm"
    title={t.setDefaultTitle}
    /* 취소 단추가 이미 닫기라 우상단 X 는 두지 않는다(사용자 지시 · #231). */
    showCloseButton={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.setDefaultConfirm}
        </Button>
      </>
    }
  >
    {banner}
    <p className="routing-set-default-question">{t.setDefaultQuestion(revisionLabel)}</p>
    <p>{t.setDefaultDescription}</p>
  </Dialog>
);
