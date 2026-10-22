import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

export interface WorkOrderCloseConfirmDetail {
  label: string;
  value: string;
}

/** ERP 송신 결과를 보는 화면의 경로. 메뉴 이름이 바뀌어도 어긋나지 않게 그 화면의 문구로 짓는다. */
export const erpResultMenuPath = (): string =>
  `${messages.integrationSync.breadcrumbRoot} › ${messages.integrationSync.title}`;

export interface WorkOrderCloseConfirmDialogProps {
  workOrderNo: string;
  /** 고른 내용을 한 줄에 한 값씩 되풀이한다 — 되돌릴 수 없으니 누르기 전에 다시 본다 */
  details: readonly WorkOrderCloseConfirmDetail[];
  /** 마감과 함께 일어나는 일(폐번·남는 LOT) */
  warnings: readonly string[];
  banner: ReactNode;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const WorkOrderCloseConfirmDialog = ({
  workOrderNo,
  details,
  warnings,
  banner,
  isSubmitting,
  onClose,
  onConfirm,
}: WorkOrderCloseConfirmDialogProps) => {
  const t = messages.workOrderClose.confirm;

  return (
    <Dialog
      closeOnBackdropClick={false}
      footer={
        <>
          <Button disabled={isSubmitting} variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button loading={isSubmitting} variant="filled" onClick={onConfirm}>
            {t.confirm}
          </Button>
        </>
      }
      open
      showCloseButton={false}
      title={t.title(workOrderNo)}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      {banner === null || banner === undefined ? null : <div>{banner}</div>}
      <p>{t.target(workOrderNo)}</p>
      {details.length === 0 ? null : (
        <dl className="work-order-close-confirm-details">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {warnings.map((warning) => (
        <p key={warning}>{warning}</p>
      ))}
      <p>{t.irreversible}</p>
      <p>{t.erp(erpResultMenuPath())}</p>
    </Dialog>
  );
};
