import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface RejectDialogProps {
  approvalTypeCode: string;
  comment: string;
  isSaving: boolean;
  requestNo: string;
  targetName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const RejectDialog = ({
  approvalTypeCode,
  comment,
  isSaving,
  requestNo,
  targetName,
  onCancel,
  onConfirm,
}: RejectDialogProps) => {
  const t = messages.qualityApproval;

  return (
    <Dialog
      open
      title={t.approval.rejectDialogTitle}
      size="sm"
      closeOnBackdropClick={false}
      showCloseButton={false}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {t.approval.reject}
          </Button>
        </>
      }
    >
      <p>{`${t.fields.approvalRequestNo}: ${requestNo}`}</p>
      <p>{`${t.fields.approvalTypeCode}: ${approvalTypeCode}`}</p>
      <p>{`${t.fields.target}: ${targetName}`}</p>
      <p className="field-label">{t.approval.rejectCommentHeading}</p>
      <p>{comment}</p>
      <p>{t.approval.rejectStateOnly}</p>
      <p>{t.approval.rejectIrreversible}</p>
    </Dialog>
  );
};
