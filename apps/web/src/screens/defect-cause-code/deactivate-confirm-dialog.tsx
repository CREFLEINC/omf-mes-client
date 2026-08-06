import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.defectCauseCode.deactivate;

export interface DeactivateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving: boolean;
  /**
   * 대분류이고 하위가 있을 때만 그 건수. 그 밖에는 null.
   * 목록이 잘렸으면 실제보다 적을 수 있어 문구가 「표시된 목록 기준」이라고 밝힌다.
   */
  childCount: number | null;
  /** 저장 실패 배너 슬롯. 다이얼로그를 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
}

/**
 * 사용 중지 확인. 기존 디자인 시스템 컴포넌트의 조합이므로 이 화면 슬라이스가 소유한다 —
 * 조합물을 미리 디자인 시스템으로 올리지 않는다.
 *
 * 스크림 클릭으로 닫히지 않게 한다. 되돌리기 어려운 액션의 확인 창이 실수로 사라지면
 * 사용자는 자기가 무엇을 취소했는지 모른다.
 */
export const DeactivateConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  isSaving,
  childCount,
  banner,
}: DeactivateConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onClose}
    size="sm"
    title={t.title}
    closeOnBackdropClick={false}
    footer={
      <>
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
          {t.confirm}
        </Button>
      </>
    }
  >
    {banner}
    <p>{t.description}</p>
    {/* 하위가 딸린 대분류를 중지하면 영향 범위가 넓다. 누르기 전에 그 사실을 보인다. */}
    {childCount !== null && <p>{t.childCount(childCount)}</p>}
  </Dialog>
);
