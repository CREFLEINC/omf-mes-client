import { Button, Dialog, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoLabel } from '../../patterns/info-tip';

const t = messages.shipmentConfirm.cancelDialog;

/** 취소 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const CANCEL_REASON_MAX = 500;

export const cancelReasonError = (raw: string): string | undefined => {
  const value = raw.trim();

  if (value === '') return t.reasonRequired;
  if (value.length > CANCEL_REASON_MAX) return t.reasonTooLong;

  return undefined;
};

/**
 * 취소가 실행되면 일어나는 것(POP 완료 출하만 · 시안 W0412-After 취소 요청 창). 옛 흐름 미확정
 * 출하는 재고·전표가 아직 확정 전이라 이 목록을 두지 않는다.
 */
export interface CancelConsequences {
  qty: number | null;
  warehouses: string;
  shipmentRequestNo: string | null;
}

export interface CancelRequestDialogProps {
  shipmentNo: string;
  consequences: CancelConsequences | null;
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
 * ⚠ **사유가 필수인 이유가 있다**(A-12) — 승인자가 이것 하나를 읽고 판단한다. 그 말은 사유 라벨 옆
 * ⓘ 로 둔다(관리웹 정리 시안 A). 취소한 사람·시각을 담을 컬럼이 없어(§5-8) 결재 기록이 이력을
 * 대신하지만, 사용자가 할 일이 아니라 창에 적지 않는다.
 */
export const CancelRequestDialog = ({
  shipmentNo,
  consequences,
  reason,
  showError,
  banner,
  isSubmitting,
  onChangeReason,
  onClose,
  onSubmit,
}: CancelRequestDialogProps) => {
  const reasonId = useId();

  return (
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
      {consequences !== null && (
        <>
          {/* FR-024 — 상신 중에는 러너가 그 출하를 보내지 않는다. 요청하는 자리에서 말한다. */}
          <p>{t.hold}</p>
          <h3 className="field-label">{t.whatTitle}</h3>
          <ul className="ship-history-consequences">
            {consequences.qty !== null && (
              <li>{t.what.stock(consequences.qty, consequences.warehouses)}</li>
            )}
            <li>{t.what.documents}</li>
            <li>{t.what.salesOrder}</li>
            {consequences.shipmentRequestNo !== null && (
              <li>{t.what.request(consequences.shipmentRequestNo)}</li>
            )}
          </ul>
        </>
      )}
      <InfoLabel htmlFor={reasonId} label={t.reasonLabel} info={t.reasonHelp} required />
      <TextArea
        id={reasonId}
        value={reason}
        required
        fullWidth
        rows={3}
        maxLength={CANCEL_REASON_MAX}
        error={showError ? cancelReasonError(reason) : undefined}
        onChange={(event) => onChangeReason(event.target.value)}
      />
    </Dialog>
  );
};
