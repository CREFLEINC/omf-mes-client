import { Button, Dialog, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.shipmentConfirm.cancelDialog;

/** 취소 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const CANCEL_REASON_MAX = 500;

export const cancelReasonError = (raw: string): string | undefined => {
  const value = raw.trim();

  if (value === '') return t.reasonRequired;
  if (value.length > CANCEL_REASON_MAX) return t.reasonTooLong;

  return undefined;
};

export interface CancelRequestDialogProps {
  shipmentNo: string;
  reason: string;
  showError: boolean;
  banner: ReactNode;
  isSubmitting: boolean;
  onChangeReason: (reason: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * 취소 «요청» 창.
 *
 * ⭐ **요청과 실행이 다른 액션이다**(§5-8) — 이 창이 취소를 실행하지 않는다는 사실을 **요청하는
 * 자리에서** 말한다. 안 적으면 눌러 놓고 재고가 돌아온 줄 안다.
 *
 * ⚠ **사유가 필수인 이유가 있다**(A-12) — 승인자가 이것 하나를 읽고 판단한다. 그리고 취소한
 * 사람·시각을 담을 컬럼이 없어(§5-8) **결재 기록이 이력을 대신한다.**
 */
export const CancelRequestDialog = ({
  shipmentNo,
  reason,
  showError,
  banner,
  isSubmitting,
  onChangeReason,
  onClose,
  onSubmit,
}: CancelRequestDialogProps) => (
  <Dialog
    closeOnBackdropClick={false}
    footer={
      <>
        <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button loading={isSubmitting} variant="filled" onClick={onSubmit}>
          {t.submit}
        </Button>
      </>
    }
    open
    showCloseButton={false}
    title={t.title}
    onClose={() => {
      if (!isSubmitting) onClose();
    }}
  >
    {banner === null || banner === undefined ? null : <div>{banner}</div>}
    <p>{t.target(shipmentNo)}</p>
    <p className="dialog-lead">{t.approvalNote}</p>
    <TextArea
      label={t.reasonLabel}
      value={reason}
      required
      fullWidth
      rows={3}
      maxLength={CANCEL_REASON_MAX}
      error={showError ? cancelReasonError(reason) : undefined}
      helperText={`${t.reasonHelp} ${t.traceWithdrawn}`}
      onChange={(event) => onChangeReason(event.target.value)}
    />
  </Dialog>
);
