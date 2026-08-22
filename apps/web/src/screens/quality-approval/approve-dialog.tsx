import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface ApproveDialogProps {
  approvalTypeCode: string;
  comment: string;
  isSaving: boolean;
  requestNo: string;
  targetName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ApproveDialog = ({
  approvalTypeCode,
  comment,
  isSaving,
  requestNo,
  targetName,
  onCancel,
  onConfirm,
}: ApproveDialogProps) => {
  const t = messages.qualityApproval;

  return (
    <Dialog
      open
      title={t.approval.dialogTitle}
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
            {t.approval.approve}
          </Button>
        </>
      }
    >
      <p>{`${t.fields.approvalRequestNo}: ${requestNo}`}</p>
      <p>{`${t.fields.approvalTypeCode}: ${approvalTypeCode}`}</p>
      <p>{`${t.fields.target}: ${targetName}`}</p>
      <p className="field-label">{t.approval.commentHeading}</p>
      <p>{comment}</p>
      <p>{t.approval.stateOnly}</p>
      <p>{t.approval.irreversible}</p>
    </Dialog>
  );
};
