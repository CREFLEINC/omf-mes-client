import { Button } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { TextArea } from '@omf-mes/ui';

import { SaveErrorBanner } from '../../patterns/master';

export interface ApprovalActionPaneProps {
  comment: string;
  commentError: string | undefined;
  lockReason: string | undefined;
  lockReasonId: string;
  writeError: ApiError | null;
  onApprove: () => void;
  onCommentChange: (value: string) => void;
  onReject: () => void;
  onReload: () => void;
  onReloadUnknown: () => void;
}

export const ApprovalActionPane = ({
  comment,
  commentError,
  lockReason,
  lockReasonId,
  writeError,
  onApprove,
  onCommentChange,
  onReject,
  onReload,
  onReloadUnknown,
}: ApprovalActionPaneProps) => {
  const t = messages.qualityApproval;
  const isLocked = lockReason !== undefined;

  return (
    <div role="group" aria-label={t.approval.title}>
      <SaveErrorBanner error={writeError} onReload={onReload} />
      {writeError?.kind === 'network' && (
        <div className="form-actions">
          <p className="field-note">{t.approval.deliveryUnknown}</p>
          <Button variant="outlined" size="sm" onClick={onReloadUnknown}>
            {t.approval.reloadTarget}
          </Button>
        </div>
      )}
      <TextArea
        label={t.approval.commentLabel}
        value={comment}
        required
        fullWidth
        rows={4}
        disabled={isLocked}
        aria-describedby={isLocked ? lockReasonId : undefined}
        error={commentError}
        helperText={t.approval.commentHelp}
        onChange={(event) => onCommentChange(event.target.value)}
      />
      {isLocked && (
        <p id={lockReasonId} className="field-note">
          {lockReason}
        </p>
      )}
      <div className="form-actions">
        <Button
          variant="outlined"
          disabled={isLocked}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onReject}
        >
          {t.approval.reject}
        </Button>
        <Button
          disabled={isLocked}
          aria-describedby={isLocked ? lockReasonId : undefined}
          onClick={onApprove}
        >
          {t.approval.approve}
        </Button>
      </div>
    </div>
  );
};
